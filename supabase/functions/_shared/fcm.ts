import { SignJWT } from 'npm:jose@5'

export interface FcmServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })

export function serviceAccount(): FcmServiceAccount | null {
  try {
    return JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') ?? '') as FcmServiceAccount
  } catch {
    return null
  }
}

async function fcmOAuthToken(sa: FcmServiceAccount): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000)
    const jwt = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(sa.client_email)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(await importKey(sa.private_key))

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })
    const parsed = await res.json()
    return parsed.access_token ?? null
  } catch {
    return null
  }
}

function importKey(pem: string): Promise<CryptoKey> {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    bytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

// Minimal shape of the Supabase client the edge functions pass in.
interface Db {
  from: (table: string) => {
    delete: () => { eq: (column: string, value: string) => Promise<unknown> }
  }
}

/**
 * Sends a push to every token via the FCM HTTP v1 API and removes unregistered
 * tokens from the DB. `build` returns the message body for a given token.
 */
export async function pushToTokens(
  db: Db,
  tokens: Array<{ token: string }>,
  build: (token: string) => object,
): Promise<{ sent: number; failed: number }> {
  const sa = serviceAccount()
  if (!sa) return { sent: 0, failed: 0 }
  const oauth = await fcmOAuthToken(sa)
  if (!oauth) return { sent: 0, failed: 0 }

  let sent = 0
  let failed = 0
  for (const { token } of tokens) {
    try {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
        {
          method: 'POST',
          headers: { authorization: `Bearer ${oauth}`, 'content-type': 'application/json' },
          body: JSON.stringify({ message: { token, ...build(token) } }),
        },
      )
      if (res.ok) {
        sent += 1
      } else {
        failed += 1
        await db.from('push_tokens').delete().eq('token', token)
      }
    } catch {
      failed += 1
    }
  }
  return { sent, failed }
}
// ============================================================================
// SideQuest — notify-user
//
// Pushes a notification to ONE user's Android devices. Called by the database
// triggers in migration 0006 whenever a friend request or challenge is sent,
// so the recipient hears about it even when the app is fully closed.
//
// Flow: verify secret → read the recipient's FCM tokens (service role) → mint
// a short-lived OAuth token from the FCM service account → send one message
// per device via the Firebase HTTP v1 API.
//
// Required secrets (Supabase → Edge Functions → Secrets):
//   NOTIFY_WEBHOOK_SECRET — shared with the DB triggers (app_config table)
//   FCM_SERVICE_ACCOUNT    — the full JSON of a Firebase service-account key
//                            (same one the notify-update function uses)
//
// Body: { userId: string, title: string, body: string, data?: object }
//   data.type is 'friend-request' or 'challenge' — the app uses it to
//   deep-link when the notification is tapped.
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SignJWT } from 'npm:jose@5'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

interface FcmServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

function sa(): FcmServiceAccount | null {
  try {
    return JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') ?? '') as FcmServiceAccount
  } catch {
    return null
  }
}

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })

Deno.serve(async (req) => {
  const secret = Deno.env.get('NOTIFY_WEBHOOK_SECRET')
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return json({ error: 'forbidden' }, 403)
  }
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: { userId?: unknown; title?: unknown; body?: unknown; data?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid body' }, 400)
  }
  const userId = String(body.userId ?? '')
  const title = String(body.title ?? '').slice(0, 100)
  const text = String(body.body ?? '').slice(0, 200)
  const data = (body.data && typeof body.data === 'object' ? body.data : {}) as Record<string, string>
  if (!userId) return json({ error: 'missing userId' }, 400)

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('profile_id', userId)
    .eq('platform', 'android')
  if (!tokens || tokens.length === 0) return json({ sent: 0 })

  const service = sa()
  if (!service) return json({ error: 'FCM_SERVICE_ACCOUNT not configured' }, 500)
  const oauth = await fcmOAuthToken(service)
  if (!oauth) return json({ error: 'could not mint FCM token' }, 500)

  let sent = 0
  let failed = 0
  for (const { token } of tokens) {
    const ok = await sendFcm(oauth, service.project_id, token, title, text, data)
    if (ok) {
      sent += 1
    } else {
      failed += 1
      // Unregistered tokens (app uninstalled / FCM reset) — clean them up.
      await supabase.from('push_tokens').delete().eq('token', token)
    }
  }
  return json({ sent, failed })
})

/** Mints a short-lived OAuth access token from the service account JWT. */
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

async function sendFcm(
  oauth: string,
  projectId: string,
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${oauth}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title, body },
            data: { type: data.type ?? 'general', ...data },
          },
        }),
      },
    )
    return res.ok
  } catch {
    return false
  }
}

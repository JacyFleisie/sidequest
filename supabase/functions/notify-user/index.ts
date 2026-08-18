// ============================================================================
// SideQuest - notify-user
//
// Pushes a notification to ONE user's Android devices. Called by the database
// triggers in migration 0006 whenever a friend request or challenge is sent, so
// the recipient hears about it even when the app is fully closed.
//
// Required secrets (Supabase -> Edge Functions -> Secrets):
//   NOTIFY_WEBHOOK_SECRET - shared with the DB triggers (app_config table)
//   FCM_SERVICE_ACCOUNT  - the full JSON of a Firebase service-account key
//
// Body: { userId, title, body, data? }
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'
import { json, pushToTokens, serviceAccount } from '../_shared/fcm.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

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
  if (!serviceAccount()) return json({ error: 'FCM_SERVICE_ACCOUNT not configured' }, 500)

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('profile_id', userId)
    .eq('platform', 'android')
  if (!tokens || tokens.length === 0) return json({ sent: 0 })

  const result = await pushToTokens(supabase, tokens, () => ({
    notification: { title, body: text },
    data: { type: data.type ?? 'general', ...data },
  }))
  return json(result)
})
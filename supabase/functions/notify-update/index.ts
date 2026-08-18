// ============================================================================
// SideQuest - notify-update
//
// Pushes a notification to every registered Android device when a new release is
// published. Invoked by the GitHub release workflow
// (.github/workflows/notify-release.yml) with a shared webhook secret.
//
// Required secrets (Supabase -> Edge Functions -> Secrets):
//   UPDATE_WEBHOOK_SECRET - shared with the GitHub workflow
//   FCM_SERVICE_ACCOUNT  - the full JSON of a Firebase service-account key
//                          (Firebase console -> Project settings -> Service
//                          accounts -> Generate new private key)
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'
import { json, pushToTokens, serviceAccount } from '../_shared/fcm.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  const secret = Deno.env.get('UPDATE_WEBHOOK_SECRET')
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return json({ error: 'forbidden' }, 403)
  }
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let body: { tag?: unknown; notes?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    // empty body is fine - a generic update message is sent
  }
  const tag = String(body.tag ?? '').replace(/^v/, '')
  const notes = String(body.notes ?? '').trim().slice(0, 200)
  if (!serviceAccount()) return json({ error: 'FCM_SERVICE_ACCOUNT not configured' }, 500)

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('platform', 'android')
  if (!tokens || tokens.length === 0) return json({ sent: 0 })

  const result = await pushToTokens(supabase, tokens, () => ({
    notification: {
      title: tag ? 'SideQuest v' + tag + ' is here!' : 'New SideQuest update!',
      body: notes || 'Tap to install the latest version.',
    },
    data: { type: 'update', version: tag },
  }))
  return json(result)
})
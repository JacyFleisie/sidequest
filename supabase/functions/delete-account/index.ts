// ============================================================================
// SideQuest — delete-account
//
// Permanently deletes the signed-in user: ALL server-side data AND their auth
// credentials, so the email can never sign in again (POPIA "right to erasure").
//
// Why an edge function? Deleting the auth user (auth.users) requires the
// service role — the app's anon key is not allowed to touch it. The profile
// row is deleted first: every table that holds user data (friend requests,
// friendships, quest/chain completions, badge earnings, custom quests, quest
// reports, push tokens) cascades off it via ON DELETE CASCADE, so nothing can
// be orphaned.
//
// Security: the platform verifies the caller's JWT (verify_jwt) — an invalid
// or missing token never reaches this code. The user id comes from the token's
// `sub` claim, so a user can only ever delete their own account.
//
// Caller: src/lib/sync.ts → deleteAccount() via supabase.functions.invoke().
// No extra secrets needed — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are
// injected automatically for edge functions.
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

    // The platform already verified the JWT — extract the user id from it.
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    let uid = ''
    try {
      // JWTs are base64url; atob needs base64 (the payload can contain - and _).
      const payload = JSON.parse(
        atob((token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')),
      ) as { sub?: unknown }
      uid = String(payload.sub ?? '')
    } catch {
      return json({ error: 'unauthorized' }, 401)
    }
    if (!uid) return json({ error: 'unauthorized' }, 401)

    // 1. Delete the profile → cascades to every table holding this user's data.
    const { error: profErr } = await supabase.from('profiles').delete().eq('id', uid)
    if (profErr) {
      return json({ error: `profile delete failed: ${profErr.message}` }, 500)
    }

    // 2. Delete the auth user so the account can never be signed into again.
    const { error: authErr } = await supabase.auth.admin.deleteUser(uid)
    if (authErr) {
      console.error('[delete-account] admin.deleteUser failed:', authErr.status, authErr.message)
      return json({ error: `auth delete failed: ${authErr.status} ${authErr.message}` }, 500)
    }

    return json({ ok: true })
  } catch (e) {
    console.error('[delete-account] uncaught:', (e as Error).stack ?? String(e))
    return json({ error: `uncaught: ${(e as Error).message ?? e}` }, 500)
  }
})

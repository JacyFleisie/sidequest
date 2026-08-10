// Sends a friend request from a fresh anonymous identity to the web preview's
// profile, so the incoming-request → accept → friend-sheet flow can be tested in the UI.
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const supabase = createClient(url, key)
const recipientId = process.argv[2]
if (!recipientId) {
  console.error('Usage: node scripts/make-friend.mjs <recipient-uid>')
  process.exit(1)
}

const { data: { user }, error: signInErr } = await supabase.auth.signInAnonymously()
if (signInErr || !user) {
  console.error('Anonymous sign-in failed:', signInErr?.message ?? 'no user')
  process.exit(1)
}

const name = process.argv[3] ?? 'Zane'
const emoji = process.argv[4] ?? '🦁'
const { error: profileErr } = await supabase
  .from('profiles')
  .upsert({ id: user.id, name, emoji, xp: 240, streak: 3 })
if (profileErr) {
  console.error('Profile upsert failed:', profileErr.message)
  process.exit(1)
}

const { error: reqErr } = await supabase
  .from('friend_requests')
  .insert({ id: crypto.randomUUID(), sender_id: user.id, recipient_id: recipientId, status: 'pending' })
if (reqErr) {
  console.error('Friend request insert failed:', reqErr.message)
  process.exit(1)
}

console.log(`Request sent: ${emoji} ${name} (${user.id}) → ${recipientId}`)

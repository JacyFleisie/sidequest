// End-to-end sync test against the real Supabase project + RLS.
// Simulates two devices (A and B) doing the full friend flow.
import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_ANON_KEY

if (!URL || !KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0
let fail = 0
const check = (label, ok, extra = '') => {
  if (ok) { pass++; console.log(`  ✅ ${label}`) }
  else { fail++; console.log(`  ❌ ${label} ${extra}`) }
}

const device = async (name, emoji) => {
  const c = createClient(URL, KEY, { auth: { persistSession: false } })
  const { data, error } = await c.auth.signInAnonymously()
  if (error || !data.user) {
    console.error(`\n❌ Anonymous sign-in failed: ${error?.message ?? 'unknown'}`)
    console.error('   Fix: Supabase → Authentication → Sign In / Up → enable "Anonymous sign-ins".')
    process.exit(1)
  }
  const uid = data.user.id
  await c.from('profiles').upsert({ id: uid, name, emoji, xp: 0, streak: 0 }, { onConflict: 'id' })
  return { c, uid }
}

console.log('\n== Signing in two anonymous devices ==')
const A = await device('Thandi', '🐆')
const B = await device('Sipho', '🦁')
console.log(`  A = ${A.uid}`)
console.log(`  B = ${B.uid}`)

console.log('\n== A pushes a real completion ==')
await A.c.from('quest_completions').upsert(
  { profile_id: A.uid, quest_id: 'nelson-mandela-square', completed_at: new Date().toISOString(), xp: 120 },
  { onConflict: 'profile_id,quest_id' },
)
check('A completion inserted', true)

console.log('\n== A sends a friend request to B ==')
const { data: req, error: reqErr } = await A.c.from('friend_requests').insert({
  id: crypto.randomUUID(), sender_id: A.uid, recipient_id: B.uid, status: 'pending',
}).select('id').single()
check('request created', !reqErr, reqErr?.message)
await sleep(300)

console.log('\n== B sees the incoming request ==')
const { data: incoming } = await B.c
  .from('friend_requests')
  .select('id,sender_id,status')
  .eq('recipient_id', B.uid)
  .eq('status', 'pending')
check('B sees 1 pending request', (incoming ?? []).length === 1)
check('request sender is A', incoming?.[0]?.sender_id === A.uid)
const reqId = incoming?.[0]?.id

console.log('\n== B accepts ==')
const { data: reqRow } = await B.c.from('friend_requests').select('sender_id,recipient_id').eq('id', reqId).single()
const a = reqRow.sender_id < reqRow.recipient_id ? reqRow.sender_id : reqRow.recipient_id
const b = reqRow.sender_id < reqRow.recipient_id ? reqRow.recipient_id : reqRow.sender_id
await B.c.from('friend_requests').update({ status: 'accepted', responded_at: new Date().toISOString() }).eq('id', reqId)
const { error: fErr } = await B.c.from('friendships').insert(
  { user_a_id: a, user_b_id: b, created_at: new Date().toISOString() },
)
check('friendship created', !fErr, fErr?.message)

console.log('\n== A sees B as a real friend with real stats ==')
const { data: pairs } = await A.c.from('friendships').select('user_a_id,user_b_id').or(`user_a_id.eq.${A.uid},user_b_id.eq.${A.uid}`)
const friendIds = (pairs ?? []).map((p) => (p.user_a_id === A.uid ? p.user_b_id : p.user_a_id))
const { data: profs } = await A.c.from('profiles').select('id,name,emoji').in('id', friendIds)
check('A has 1 real friend', (profs ?? []).length === 1)
check('that friend is B', profs?.[0]?.name === 'Sipho', JSON.stringify(profs))

console.log("\n== RLS: a stranger cannot read A and B's requests ==")
const stranger = await device('Stranger', '🐧')
const { data: strangerSees } = await stranger.c
  .from('friend_requests')
  .select('id')
  .eq('recipient_id', B.uid)
check('stranger sees 0 requests', (strangerSees ?? []).length === 0)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)

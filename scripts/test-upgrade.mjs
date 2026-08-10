// Tests the anonymous → email+password upgrade flow against the real project.
// Simulates exactly what the app does in SignIn.tsx, so we can see whether
// "User from sub claim JWT does not exist" is an app bug or a Supabase config issue.
import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const KEY = process.env.VITE_SUPABASE_ANON_KEY
if (!URL || !KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

const email = `test-${Date.now()}@sidequest.app`
const password = 'testpass123'

console.log('== Step 1: anonymous sign-in ==')
const c = createClient(URL, KEY, { auth: { persistSession: false } })
const { data: anon, error: anonErr } = await c.auth.signInAnonymously()
if (anonErr || !anon.user) {
  console.error('❌ Anonymous sign-in failed:', anonErr?.message)
  process.exit(1)
}
console.log(`✅ Anonymous uid = ${anon.user.id}`)

console.log('\n== Step 2: upgrade to email+password (auth.updateUser) ==')
const { error: upErr } = await c.auth.updateUser({ email, password })
if (upErr) {
  console.error('❌ updateUser failed:', upErr.message)
  console.error('   (this is the exact call SignIn.tsx makes)')
  process.exit(1)
}
console.log('✅ updateUser succeeded')

console.log('\n== Step 3: session identity after upgrade ==')
const { data: sess } = await c.auth.getSession()
const u = sess.session?.user
console.log(`✅ Same uid? ${u?.id === anon.user.id ? 'YES' : 'NO'} (${u?.id})`)
console.log(`✅ email = ${u?.email}`)
console.log(`✅ is_anonymous = ${u?.is_anonymous}`)

console.log('\n== Step 4: sign out and sign back in with email+password ==')
await c.auth.signOut()
const { data: signin, error: signinErr } = await c.auth.signInWithPassword({ email, password })
if (signinErr || !signin.user) {
  console.error('❌ signInWithPassword failed:', signinErr?.message)
  process.exit(1)
}
console.log(`✅ Signed back in as ${signin.user.email} (${signin.user.id})`)
console.log(`✅ uid preserved: ${signin.user.id === anon.user.id ? 'YES' : 'NO'}`)

console.log('\nAll upgrade steps passed ✔')

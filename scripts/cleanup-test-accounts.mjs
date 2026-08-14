// Removes test/shell accounts from the live database (profile + auth user),
// following the same two-step pattern as the delete-account edge function:
//   1. delete the profiles row  (cascades to all the user's data)
//   2. auth.admin.deleteUser()  (so the identity is gone from Supabase Auth)
//
// Requires the service role key — the anon key is not allowed to touch auth
// users. Provide it via the SUPABASE_SERVICE_ROLE_KEY environment variable
// (or add it to your local .env, which is gitignored). Never commit it.
//
// Usage:
//   node scripts/cleanup-test-accounts.mjs <uid...>            # dry run (list)
//   node scripts/cleanup-test-accounts.mjs --delete <uid...>   # actually delete
//
// Deleting is destructive and irreversible — only pass uids you are sure are
// test accounts. Always run the dry-run first.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const deleting = args[0] === '--delete'
const uids = (deleting ? args.slice(1) : args).filter(Boolean)
if (uids.length === 0) {
  console.error('Usage: node scripts/cleanup-test-accounts.mjs [--delete] <uid...>')
  process.exit(1)
}

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)

const url = env.VITE_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (add the key to .env or export it).')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

// Show what these uids are before touching anything.
const { data: profiles, error: listErr } = await supabase
  .from('profiles')
  .select('id,name,xp,created_at')
  .in('id', uids)
if (listErr) {
  console.error('Could not read profiles:', listErr.message)
  process.exit(1)
}
for (const p of profiles) {
  console.log(`${p.id}  ${p.name}  xp=${p.xp}  created=${p.created_at}`)
}

if (!deleting) {
  console.log(`\nDry run: ${profiles.length} profile(s) match. Re-run with --delete to remove them.`)
  process.exit(0)
}

// Delete profile rows (cascade wipes all their data), then the auth users.
let failed = 0
for (const uid of uids) {
  const { error: profErr } = await supabase.from('profiles').delete().eq('id', uid)
  const { error: authErr } = await supabase.auth.admin.deleteUser(uid)
  if (profErr || authErr) {
    failed++
    console.error(`  FAILED ${uid}: profile=${profErr?.message ?? 'ok'} auth=${authErr?.message ?? 'ok'}`)
  } else {
    console.log(`  deleted ${uid}`)
  }
}
console.log(failed === 0 ? '\nDone — all accounts removed.' : `\n${failed} account(s) failed; see errors above.`)

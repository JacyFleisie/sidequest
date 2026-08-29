import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * RLS authorization regression test.
 *
 * This is a STATIC policy test — it parses the SQL migrations and locks the
 * critical "cross-user" clauses in place. It does NOT execute RLS against a
 * live database (that needs a running Postgres), but it guarantees a future
 * migration cannot silently weaken or delete an authz policy and ship
 * undetected. The audit flagged exactly this gap: "no test asserts cross-user
 * read/write is blocked."
 *
 * The guarantees below mirror the app's trust model in src/lib/sync.ts:
 *   - a user may only WRITE rows keyed to their own profile_id
 *   - private tables (push_tokens, friendships, friend_requests, challenges)
 *     are never world-readable (no `USING (true)`)
 */

const migrationsDir = join(process.cwd(), 'supabase', 'migrations')
const raw = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
  .join('\n')

// Strip SQL comments and collapse whitespace so formatting changes don't break
// the assertions. Lowercase for case-insensitive matching.
const sql = raw.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').toLowerCase()

function has(substr: string): boolean {
  return sql.includes(substr)
}

describe('RLS — write ownership (no cross-user writes)', () => {
  it('quest_completions can only be inserted for the caller’s own profile_id', () => {
    expect(has('create policy "completions_insert_own" on quest_completions for insert with check (auth.uid() = profile_id)')).toBe(true)
    // A permissive insert policy would let anyone write another user's completions.
    expect(has('on quest_completions for insert with check (true)')).toBe(false)
  })

  it('chain_completions can only be inserted for the caller’s own profile_id', () => {
    expect(has('create policy "chains_insert_own" on chain_completions for insert with check (auth.uid() = profile_id)')).toBe(true)
    expect(has('on chain_completions for insert with check (true)')).toBe(false)
  })

  it('badge_earnings can only be inserted for the caller’s own profile_id', () => {
    expect(has('create policy "badges_insert_own" on badge_earnings for insert with check (auth.uid() = profile_id)')).toBe(true)
    expect(has('on badge_earnings for insert with check (true)')).toBe(false)
  })

  it('profiles can only be updated by the owner', () => {
    expect(has('create policy "profiles_update_own" on profiles for update using (auth.uid() = id) with check (auth.uid() = id)')).toBe(true)
    expect(has('on profiles for update with check (true)')).toBe(false)
  })

  it('push_tokens are fully owner-scoped (no world write)', () => {
    expect(has('create policy "tokens_insert_own" on push_tokens for insert with check (auth.uid() = profile_id)')).toBe(true)
    expect(has('create policy "tokens_delete_own" on push_tokens for delete using (auth.uid() = profile_id)')).toBe(true)
    expect(has('on push_tokens for insert with check (true)')).toBe(false)
  })
})

describe('RLS — read privacy (no cross-user reads of private data)', () => {
  it('push_tokens are not world-readable', () => {
    expect(has('create policy "tokens_select_own" on push_tokens for select using (auth.uid() = profile_id)')).toBe(true)
    expect(has('on push_tokens for select using (true)')).toBe(false)
  })

  it('friendships are only visible to the two members', () => {
    expect(has('create policy "friendship_select_members" on friendships for select using (auth.uid() in (user_a_id, user_b_id))')).toBe(true)
    expect(has('on friendships for select using (true)')).toBe(false)
  })

  it('friend_requests are only visible to sender/recipient', () => {
    expect(has('create policy "req_select_involved" on friend_requests for select using (auth.uid() in (sender_id, recipient_id))')).toBe(true)
    expect(has('on friend_requests for select using (true)')).toBe(false)
  })

  it('challenges are only visible to the two players', () => {
    expect(has('create policy "challenge_select_involved" on challenges for select using (auth.uid() in (challenger_id, opponent_id))')).toBe(true)
    expect(has('on challenges for select using (true)')).toBe(false)
  })
})

describe('RLS — row level security is enabled on every sensitive table', () => {
  const tables = [
    'profiles', 'friend_requests', 'friendships', 'quest_completions',
    'chain_completions', 'badge_earnings', 'challenges', 'push_tokens',
    'custom_quests', 'moderation_blocks', 'quest_reports', 'quest_reviews',
    'review_reports', 'squads', 'squad_members',
  ]
  for (const t of tables) {
    it(`RLS enabled on ${t}`, () => {
      expect(has(`alter table ${t} enable row level security`)).toBe(true)
    })
  }
})

import { describe, expect, it, vi } from 'vitest'

// No client configured (fresh checkout / web build without env vars) — the
// leaderboard must no-op instead of throwing.
vi.mock('./supabase', () => ({ supabase: null, supabaseConfigured: false }))

import { fetchLeaderboard } from './leaderboard'

describe('fetchLeaderboard — offline', () => {
  it('returns null without a Supabase client', async () => {
    expect(await fetchLeaderboard('u1', 'global', 'jhb')).toBeNull()
    expect(await fetchLeaderboard('u1', 'regional', 'jhb')).toBeNull()
    expect(await fetchLeaderboard('u1', 'friends', 'jhb')).toBeNull()
  })
})

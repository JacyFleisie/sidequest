import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureIdentity, syncCompletions, __setTestClient } from './sync'
import type { PersistedState } from './store'

// A minimal fake of the bits of the Supabase client that sync.ts touches.
// It records the calls so we can assert on auth + sync behaviour without a backend.
function makeFakeClient(overrides: Record<string, any> = {}) {
  const calls = {
    signInAnonymously: 0,
    signOut: 0,
    profileUpserts: [] as any[],
    questUpserts: [] as any[],
    badgeUpserts: [] as any[],
  }
  const client = {
    calls,
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInAnonymously: vi.fn().mockImplementation(async () => {
        calls.signInAnonymously++
        return { data: { user: { id: 'anon-' + calls.signInAnonymously } }, error: null }
      }),
      signOut: vi.fn().mockImplementation(async () => {
        calls.signOut++
        return { error: null }
      }),
    },
    from: (table: string) => ({
      upsert: (rows: any, _opts?: any) => {
        if (table === 'profiles') calls.profileUpserts.push(rows)
        else if (table === 'quest_completions') calls.questUpserts.push(rows)
        else if (table === 'badge_earnings') calls.badgeUpserts.push(rows)
        return Promise.resolve({ error: null })
      },
    }),
    ...overrides,
  }
  return client
}

const baseState = (overrides: Partial<PersistedState> = {}): PersistedState =>
  ({
    playerName: 'Tester',
    xp: 120,
    streak: 3,
    completed: {
      'gold-reef-city': { at: new Date('2026-09-01T10:00:00.000Z').toISOString(), xp: 120, weather: 'sunny', distFromHomeKm: 2.5 },
    },
    customQuests: [],
    ...overrides,
  }) as unknown as PersistedState

describe('ensureIdentity — anonymous sign-in', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => __setTestClient(null))

  it('signs in anonymously when there is no existing session', async () => {
    const client = makeFakeClient()
    __setTestClient(client)
    const uid = await ensureIdentity()
    expect(uid).toMatch(/^anon-/)
    expect(client.calls.signInAnonymously).toBe(1)
  })

  it('reuses an existing valid session without re-signing-in', async () => {
    const client = makeFakeClient({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'existing-uid' } } } }),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'existing-uid' } }, error: null }),
        signInAnonymously: vi.fn(),
        signOut: vi.fn(),
      },
    })
    __setTestClient(client)
    const uid = await ensureIdentity()
    expect(uid).toBe('existing-uid')
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled()
  })

  it('self-heals a stale session (deleted auth user) by signing out and re-signing in', async () => {
    const signIn = vi.fn().mockImplementation(async () => ({ data: { user: { id: 'anon-fresh' } }, error: null }))
    const signOut = vi.fn().mockResolvedValue({ error: null })
    const client = makeFakeClient({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'ghost-uid' } } } }),
        // getUser reports the user is gone — the classic "sub claim JWT does not exist"
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'User from sub claim JWT does not exist' } }),
        signInAnonymously: signIn,
        signOut,
      },
    })
    __setTestClient(client)
    const uid = await ensureIdentity()
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(signIn).toHaveBeenCalledTimes(1)
    expect(uid).toBe('anon-fresh')
  })

  it('returns null (no identity) when Supabase is unconfigured', async () => {
    __setTestClient(null)
    const uid = await ensureIdentity()
    expect(uid).toBeNull()
  })
})

describe('syncCompletions — pushing finished quests', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => __setTestClient(null))

  it('upserts the player\'s quest completions keyed by profile_id', async () => {
    const client = makeFakeClient()
    __setTestClient(client)
    await syncCompletions('uid-123', baseState())
    expect(client.calls.questUpserts).toHaveLength(1)
    const rows = client.calls.questUpserts[0]
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ profile_id: 'uid-123', quest_id: 'gold-reef-city', xp: 120 })
  })

  it('records earned badges alongside completions', async () => {
    const client = makeFakeClient()
    __setTestClient(client)
    // xp 120 + a single completion should earn the first-quest badge.
    await syncCompletions('uid-123', baseState())
    expect(client.calls.badgeUpserts).toHaveLength(1)
    expect(client.calls.badgeUpserts[0].some((b: any) => b.badge_id === 'first-quest')).toBe(true)
  })

  it('is a no-op (no network calls) when there is no client', async () => {
    __setTestClient(null)
    await expect(syncCompletions('uid-123', baseState())).resolves.toBeUndefined()
  })
})

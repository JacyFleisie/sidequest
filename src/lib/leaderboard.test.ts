import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchLeaderboard } from './leaderboard'

// ── In-memory stand-in for the Supabase client ───────────────────────────────
// Implements just the query surface fetchLeaderboard() uses (profiles +
// friendships reads) so the real filtering/ranking logic runs against
// deterministic rows instead of a database.
const { setTableRows, fakeSupabase } = vi.hoisted(() => {
  class FakeQuery {
    private baseRows: Record<string, unknown>[]
    private filters: ((r: Record<string, unknown>) => boolean)[] = []
    private orders: { key: string; asc: boolean }[] = []
    private limitN: number | null = null
    private countMode = false

    constructor(baseRows: Record<string, unknown>[]) {
      this.baseRows = baseRows
    }

    eq(col: string, val: unknown): this {
      this.filters.push((r) => r[col] === val)
      return this
    }

    in(col: string, vals: unknown[]): this {
      this.filters.push((r) => vals.includes(r[col]))
      return this
    }

    or(expr: string): this {
      const clauses = expr.split(',').map((c) => c.trim())
      this.filters.push((r) =>
        clauses.some((c) => {
          const m = c.match(/^(\w+)\.eq\.(.+)$/)
          return m ? String(r[m[1]]) === m[2] : false
        }),
      )
      return this
    }

    order(col: string, opts?: { ascending?: boolean }): this {
      this.orders.push({ key: col, asc: opts?.ascending ?? false })
      return this
    }

    limit(n: number): this {
      this.limitN = n
      return this
    }

    gt(col: string, val: number): this {
      this.filters.push((r) => (r[col] as number) > val)
      return this
    }

    select(_cols?: string, opts?: { count?: 'exact'; head?: boolean }): this {
      if (opts?.count === 'exact' && opts?.head) this.countMode = true
      return this
    }

    maybeSingle(): { data: Record<string, unknown> | null; error: null } {
      return { data: this.matched()[0] ?? null, error: null }
    }

    then(
      resolve: (value: { data?: Record<string, unknown>[] | null; count?: number; error: null }) => void,
    ): Promise<void> {
      if (this.countMode) resolve({ count: this.matched().length, error: null })
      else resolve({ data: this.matched(), error: null })
      return Promise.resolve()
    }

    /** Applies filters, then orders (last .order() wins), then limits. */
    private matched(): Record<string, unknown>[] {
      let out = this.baseRows.filter((r) => this.filters.every((f) => f(r)))
      for (const { key, asc } of [...this.orders].reverse()) {
        out = [...out].sort((a, b) => {
          const av = a[key] as number | undefined
          const bv = b[key] as number | undefined
          if (av === bv) return 0
          if (av == null) return 1
          if (bv == null) return -1
          const cmp = av < bv ? -1 : 1
          return asc ? cmp : -cmp
        })
      }
      if (this.limitN !== null) out = out.slice(0, this.limitN)
      return out
    }
  }

  const tables = new Map<string, Record<string, unknown>[]>()
  return {
    fakeSupabase: {
      from: (name: string) => new FakeQuery(tables.get(name) ?? []),
    },
    setTableRows: (name: string, rows: Record<string, unknown>[]) => {
      tables.set(name, rows)
    },
  }
})

vi.mock('./supabase', () => ({ supabase: fakeSupabase, supabaseConfigured: true }))

// ── Fixtures ─────────────────────────────────────────────────────────────────
const profile = (id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id,
  name: `Player ${id}`,
  emoji: '🌱',
  xp: 0,
  streak: 0,
  home_base_id: null,
  last_active_at: '2026-08-01T00:00:00Z',
  ...overrides,
})

const friendship = (a: string, b: string): Record<string, unknown> => ({
  user_a_id: a,
  user_b_id: b,
})

// ── Global scope ─────────────────────────────────────────────────────────────
describe('fetchLeaderboard — global scope', () => {
  beforeEach(() => {
    setTableRows('friendships', [])
    setTableRows('profiles', [
      profile('me', { xp: 300, home_base_id: 'jhb' }),
      profile('a', { xp: 900, name: 'Alice', streak: 7, home_base_id: 'pretoria' }),
      profile('b', { xp: 900, name: 'Bob', home_base_id: 'jhb' }),
      profile('c', { xp: 100, home_base_id: null }),
    ])
  })

  it('returns every player sorted by XP descending (ties by name)', async () => {
    const res = await fetchLeaderboard('me', 'global', 'jhb')
    expect(res).not.toBeNull()
    expect(res!.entries.map((e) => e.id)).toEqual(['a', 'b', 'me', 'c'])
  })

  it('ranks the player inside the top list', async () => {
    const res = await fetchLeaderboard('me', 'global', 'jhb')
    expect(res!.youInTop).toBe(true)
    expect(res!.yourRank).toBe(3)
  })

  it('carries streak and home-base label through to entries', async () => {
    const res = await fetchLeaderboard('me', 'global', 'jhb')
    const alice = res!.entries.find((e) => e.id === 'a')!
    expect(alice.streak).toBe(7)
    expect(alice.homeBaseLabel).toBe('Pretoria')
    expect(res!.entries.find((e) => e.id === 'c')!.homeBaseLabel).toBeNull()
  })

  it('keeps players outside the top 100 out of the list but ranks them', async () => {
    const rows = Array.from({ length: 100 }, (_, i) => profile(`p${i}`, { xp: 5000 + i, name: `P${i}` }))
    rows.push(profile('me', { xp: 0, name: 'Me' }))
    setTableRows('profiles', rows)
    const res = await fetchLeaderboard('me', 'global', 'jhb')
    expect(res!.entries).toHaveLength(100)
    expect(res!.youInTop).toBe(false)
    expect(res!.yourRank).toBe(101)
    expect(res!.entries.some((e) => e.id === 'me')).toBe(false)
  })

  it('does not set a regional label', async () => {
    const res = await fetchLeaderboard('me', 'global', 'jhb')
    expect(res!.regionLabel).toBeNull()
  })
})

// ── Regional scope ───────────────────────────────────────────────────────────
describe('fetchLeaderboard — regional scope', () => {
  beforeEach(() => {
    setTableRows('friendships', [])
    setTableRows('profiles', [
      profile('me', { xp: 300, home_base_id: 'jhb' }),
      profile('near', { xp: 500, home_base_id: 'pretoria' }), // jhb neighbour
      profile('far', { xp: 700, home_base_id: 'durban' }), // other region
      profile('custom', { xp: 900, home_base_id: null }), // custom base — unplaced
    ])
  })

  it('includes only the player’s region and its neighbours', async () => {
    const res = await fetchLeaderboard('me', 'regional', 'jhb')
    expect(res!.entries.map((e) => e.id).sort()).toEqual(['me', 'near'])
    expect(res!.regionLabel).toBe('Johannesburg')
  })

  it('ranks the player when their home base is in the region', async () => {
    const res = await fetchLeaderboard('me', 'regional', 'jhb')
    expect(res!.youInTop).toBe(true)
    expect(res!.yourRank).toBe(2) // near (500) sits above me (300)
  })

  it('leaves the player unranked with a custom (unplaced) home base', async () => {
    setTableRows('profiles', [
      profile('me', { xp: 300, home_base_id: null }),
      profile('near', { xp: 500, home_base_id: 'jhb' }),
    ])
    const res = await fetchLeaderboard('me', 'regional', 'jhb')
    expect(res!.youInTop).toBe(false)
    expect(res!.yourRank).toBeNull()
    expect(res!.entries.some((e) => e.id === 'me')).toBe(false)
  })

  it('labels home bases from HOME_BASES', async () => {
    const res = await fetchLeaderboard('me', 'regional', 'jhb')
    expect(res!.entries.find((e) => e.id === 'near')!.homeBaseLabel).toBe('Pretoria')
  })
})

// ── Friends scope ────────────────────────────────────────────────────────────
describe('fetchLeaderboard — friends scope', () => {
  beforeEach(() => {
    setTableRows('profiles', [
      profile('me', { xp: 300, name: 'Me' }),
      profile('f1', { xp: 900, name: 'Friend One' }),
      profile('f2', { xp: 600, name: 'Friend Two' }),
      profile('stranger', { xp: 999, name: 'Stranger' }),
    ])
    setTableRows('friendships', [
      friendship('f1', 'me'),
      friendship('me', 'f2'),
    ])
  })

  it('includes the player and their friends only, ranked by XP', async () => {
    const res = await fetchLeaderboard('me', 'friends', 'jhb')
    expect(res!.entries.map((e) => e.id)).toEqual(['f1', 'f2', 'me'])
    expect(res!.youInTop).toBe(true)
    expect(res!.yourRank).toBe(3)
  })

  it('shows just the player with no friends', async () => {
    setTableRows('friendships', [])
    const res = await fetchLeaderboard('me', 'friends', 'jhb')
    expect(res!.entries.map((e) => e.id)).toEqual(['me'])
    expect(res!.yourRank).toBe(1)
  })

  it('still ranks friends when the player has no profile row yet', async () => {
    setTableRows('profiles', [profile('f1', { xp: 900, name: 'Friend One' })])
    setTableRows('friendships', [friendship('me', 'f1')])
    const res = await fetchLeaderboard('me', 'friends', 'jhb')
    expect(res!.you).toBeNull()
    expect(res!.entries.map((e) => e.id)).toEqual(['f1'])
  })
})

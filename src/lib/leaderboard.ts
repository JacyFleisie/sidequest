// ============================================================================
// SideQuest leaderboard — reads real player stats from Supabase.
//
// Three scopes:
//   * global   — every player in South Africa (the whole profiles table)
//   * regional — players whose city home base is in the player's region or a
//                neighbouring region (the same "nearby" concept the generator
//                uses). Players with a custom map-picked home base store no
//                city base (home_base_id is null) and are excluded here.
//   * friends  — the player plus their accepted friendships.
//
// profiles is publicly readable by design (that's how players find each
// other), so all queries work with the anon key. friendships is RLS-scoped to
// the two members, so the friends query can only ever see the caller's own
// friendships.
//
// All functions no-op (return null / empty) when Supabase isn't configured,
// matching the app's offline-first sync pattern.
// ============================================================================

import { supabase } from './supabase'
import { HOME_BASES } from '../data/quests'

export type LeaderboardScope = 'global' | 'regional' | 'friends'

/** How many rows the global/regional leaderboards show before capping. */
const TOP_N = 100

export interface LeaderboardEntry {
  id: string
  name: string
  emoji: string
  xp: number
  streak: number
  /** The player's city home base label (null for custom map-picked bases). */
  homeBaseLabel: string | null
  lastActiveAt: string | null
}

export interface LeaderboardData {
  /** The leaderboard rows, sorted by XP (then name) descending. */
  entries: LeaderboardEntry[]
  /** The signed-in player's own row, straight from the database. */
  you: LeaderboardEntry | null
  /** The player's 1-based rank within the scope, or null when not rankable. */
  yourRank: number | null
  /** True when `you` is already part of `entries` (not appended below it). */
  youInTop: boolean
  /** Human label for the regional scope, e.g. "Johannesburg & nearby". */
  regionLabel: string | null
}

interface ProfileRow {
  id: string
  name: string
  emoji: string
  xp: number
  streak: number
  home_base_id: string | null
  last_active_at: string | null
}

const rowToEntry = (row: ProfileRow): LeaderboardEntry => {
  const base = row.home_base_id ? HOME_BASES.find((b) => b.id === row.home_base_id) : null
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    xp: row.xp,
    streak: row.streak,
    homeBaseLabel: base?.label ?? null,
    lastActiveAt: row.last_active_at,
  }
}

const sortEntries = (entries: LeaderboardEntry[]): LeaderboardEntry[] =>
  [...entries].sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name))

/** The profile columns the leaderboard reads. */
const PROFILE_COLS = 'id,name,emoji,xp,streak,home_base_id,last_active_at'

/** Fetches one profile row (the signed-in player). */
async function fetchProfile(uid: string): Promise<ProfileRow | null> {
  const { data } = await supabase!.from('profiles').select(PROFILE_COLS).eq('id', uid).maybeSingle()
  return (data as ProfileRow | null) ?? null
}

/** Fetches rows ordered by XP, newest activity first on ties. */
async function fetchTopProfiles(count: number): Promise<ProfileRow[]> {
  const { data } = await supabase!
    .from('profiles')
    .select(PROFILE_COLS)
    .order('xp', { ascending: false })
    .order('last_active_at', { ascending: false })
    .limit(count)
  return (data as ProfileRow[] | null) ?? []
}

/** The ids of regions the player's home base considers "nearby". */
function regionIds(homeBaseId: string): string[] {
  const base = HOME_BASES.find((b) => b.id === homeBaseId) ?? HOME_BASES[0]
  return [base.region, ...base.neighbors]
}

/** The player's rank within `entries` (1-based), or null when absent. */
function rankOf(entries: LeaderboardEntry[], uid: string): number | null {
  const idx = entries.findIndex((e) => e.id === uid)
  return idx === -1 ? null : idx + 1
}

/**
 * Fetches the leaderboard for one scope. Returns null when Supabase isn't
 * configured or the fetch failed (callers fall back to an offline message).
 */
export async function fetchLeaderboard(
  uid: string,
  scope: LeaderboardScope,
  homeBaseId: string,
): Promise<LeaderboardData | null> {
  if (!supabase) return null
  try {
    const you = await fetchProfile(uid)
    const regionLabel =
      scope === 'regional' ? (HOME_BASES.find((b) => b.id === homeBaseId)?.label ?? null) : null

    let entries: LeaderboardEntry[] = []
    let yourRank: number | null = null
    let youInTop = false

    if (scope === 'friends') {
      const { data: pairs } = await supabase
        .from('friendships')
        .select('user_a_id,user_b_id')
        .or(`user_a_id.eq.${uid},user_b_id.eq.${uid}`)
      const friendIds = (pairs ?? []).map((p) => (p.user_a_id === uid ? p.user_b_id : p.user_a_id))
      // The friends board always includes the player themselves.
      const ids = you ? [...new Set([...friendIds, you.id])] : friendIds
      if (ids.length > 0) {
        const { data: rows } = await supabase
          .from('profiles')
          .select(PROFILE_COLS)
          .in('id', ids)
          .order('xp', { ascending: false })
        entries = sortEntries((rows as ProfileRow[] | null ?? []).map(rowToEntry))
      }
      if (you) {
        yourRank = rankOf(entries, you.id)
        youInTop = yourRank !== null
      }
    } else if (scope === 'regional') {
      const { data: rows } = await supabase
        .from('profiles')
        .select(PROFILE_COLS)
        .in('home_base_id', regionIds(homeBaseId))
        .order('xp', { ascending: false })
        .order('last_active_at', { ascending: false })
        .limit(TOP_N)
      entries = sortEntries((rows as ProfileRow[] | null ?? []).map(rowToEntry))
      // The player appears only when their home base belongs to the region —
      // a custom map-picked base has no city region and can't be placed.
      if (you && entries.some((e) => e.id === you.id)) {
        yourRank = rankOf(entries, you.id)
        youInTop = true
      }
    } else {
      entries = (await fetchTopProfiles(TOP_N)).map(rowToEntry)
      if (you) {
        const idx = entries.findIndex((e) => e.id === you.id)
        if (idx !== -1) {
          yourRank = idx + 1
          youInTop = true
        } else {
          // Outside the top list: count everyone ahead to get the true rank.
          const { count } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .gt('xp', you.xp)
          yourRank = (count ?? 0) + 1
        }
      }
    }

    return { entries, you: you ? rowToEntry(you) : null, yourRank, youInTop, regionLabel }
  } catch {
    return null
  }
}

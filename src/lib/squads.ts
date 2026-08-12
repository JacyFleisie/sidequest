import { supabase } from './supabase'
import { levelFromXp } from './game'

// ============================================================================
// SideQuest squads — co-op groups.
//
// A squad is a small crew with ONE leader (the creator). The leader invites
// friends; members can leave anytime; the leader can remove members or
// disband. The roster is realtime (postgres_changes on squad_members).
// Every member earns a +20% XP bonus on quest completions while in a squad —
// the store reads inSquad() at award time, so the bonus is applied app-side.
//
// RLS rules (see migrations 0012/0013):
//   * squads:   visible to members, created by the founder, managed by leader
//   * members:  leader invites (profile_id <> auth.uid()), anyone leaves by
//               deleting their own row, leader removes
//   * create:   SECURITY DEFINER fn create_squad() inserts squad + leader row
// ============================================================================

export const SQUAD_BONUS = 0.2
export const SQUAD_BONUS_PCT = Math.round(SQUAD_BONUS * 100)

// ── Bonus state (module-level; the store consults it at award time) ─────────
let squadStatus: { id: string } | null = null

/** True while the player is a member of any squad (drives the +XP bonus). */
export const inSquad = (): boolean => squadStatus !== null

/** Keeps the store's bonus flag in sync with the live squad membership. */
export const setSquadStatus = (squadId: string | null): void => {
  squadStatus = squadId ? { id: squadId } : null
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface SquadMember {
  profileId: string
  name: string
  emoji: string
  role: 'leader' | 'member'
  joinedAt: string
  xp: number
  level: number
  questsDone: number
}

export interface Squad {
  id: string
  name: string
  emoji: string
  createdBy: string
  createdAt: string
  members: SquadMember[]
  /** True when the signed-in player created (leads) this squad. */
  isLeader: boolean
}

// ── Fetch ────────────────────────────────────────────────────────────────────

/** Fetches the player's squad with the full live roster and real stats, or
 * null when they're not in one / offline. Also refreshes the bonus flag. */
export async function fetchMySquad(uid: string): Promise<Squad | null> {
  if (!supabase) {
    setSquadStatus(null)
    return null
  }
  try {
    const { data: myRow, error } = await supabase
      .from('squad_members')
      .select('squad_id,role')
      .eq('profile_id', uid)
      .maybeSingle()
    if (error || !myRow) {
      setSquadStatus(null)
      return null
    }
    const squadId = myRow.squad_id

    const [{ data: squad }, { data: rows }] = await Promise.all([
      supabase.from('squads').select('id,name,emoji,created_by,created_at').eq('id', squadId).maybeSingle(),
      supabase
        .from('squad_members')
        .select('profile_id,role,joined_at')
        .eq('squad_id', squadId)
        .order('joined_at', { ascending: true }),
    ])
    if (!squad || !rows) {
      setSquadStatus(null)
      return null
    }

    const memberIds = rows.map((r) => r.profile_id)
    const [{ data: profs }, { data: counts }] = await Promise.all([
      supabase.from('profiles').select('id,name,emoji,xp').in('id', memberIds),
      supabase.from('quest_completions').select('profile_id,quest_id').in('profile_id', memberIds),
    ])
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]))
    const questCount = new Map<string, number>()
    for (const c of counts ?? []) questCount.set(c.profile_id, (questCount.get(c.profile_id) ?? 0) + 1)

    const members: SquadMember[] = rows.map((r) => {
      const p = profMap.get(r.profile_id)
      const xp = p?.xp ?? 0
      return {
        profileId: r.profile_id,
        name: p?.name ?? 'SideQuester',
        emoji: p?.emoji ?? '🌱',
        role: r.role as 'leader' | 'member',
        joinedAt: r.joined_at,
        xp,
        level: levelFromXp(xp),
        questsDone: questCount.get(r.profile_id) ?? 0,
      }
    })

    setSquadStatus(squadId)
    return {
      id: squad.id,
      name: squad.name,
      emoji: squad.emoji,
      createdBy: squad.created_by,
      createdAt: squad.created_at,
      members,
      isLeader: myRow.role === 'leader',
    }
  } catch {
    setSquadStatus(null)
    return null
  }
}

// ── Mutations ────────────────────────────────────────────────────────────────

/** Creates a squad via the SECURITY DEFINER function (squad + leader row). */
export async function createSquad(
  _uid: string,
  name: string,
  emoji: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Not connected to the sync server.' }
  try {
    const { data, error } = await supabase.rpc('create_squad', { p_name: name.trim(), p_emoji: emoji })
    if (error) return { ok: false, error: friendlySquadError(error.message) }
    setSquadStatus(typeof data === 'string' ? data : null)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not create the squad — try again.' }
  }
}

/** The leader invites a friend by inserting their member row (RLS-scoped). */
export async function inviteToSquad(
  _uid: string,
  squadId: string,
  friendUid: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Not connected to the sync server.' }
  try {
    const { error } = await supabase.from('squad_members').insert({
      squad_id: squadId,
      profile_id: friendUid,
      role: 'member',
    })
    if (error) return { ok: false, error: friendlySquadError(error.message) }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not invite — try again.' }
  }
}

/** Leaves the squad (deletes your own member row — RLS permits self-delete). */
export async function leaveSquad(uid: string, squadId: string): Promise<boolean> {
  if (!supabase) return false
  try {
    const { error } = await supabase.from('squad_members').delete().eq('squad_id', squadId).eq('profile_id', uid)
    if (!error) setSquadStatus(null)
    return !error
  } catch {
    return false
  }
}

/** The leader removes a member (RLS-scoped to the leader). */
export async function removeFromSquad(_uid: string, squadId: string, memberUid: string): Promise<boolean> {
  if (!supabase) return false
  try {
    const { error } = await supabase
      .from('squad_members')
      .delete()
      .eq('squad_id', squadId)
      .eq('profile_id', memberUid)
    return !error
  } catch {
    return false
  }
}

/** The leader disbands the squad (deletes the squad row; members cascade). */
export async function disbandSquad(_uid: string, squadId: string): Promise<boolean> {
  if (!supabase) return false
  try {
    const { error } = await supabase.from('squads').delete().eq('id', squadId)
    if (!error) setSquadStatus(null)
    return !error
  } catch {
    return false
  }
}

// ── Realtime ─────────────────────────────────────────────────────────────────

/** Refetches the roster whenever squad_members changes (join/leave/remove).
 * Also fires when the squad itself changes (disband). RLS keeps the channel
 * scoped to the player's own squads. */
export function subscribeSquad(uid: string, cb: () => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`squad-${uid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'squad_members' }, cb)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'squads' }, cb)
    .subscribe()
  return () => {
    supabase?.removeChannel(channel)
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Turns raw Postgres error text into something a teenager would read calmly. */
function friendlySquadError(msg: string): string {
  if (/unique|already in a squad|one squad/i.test(msg))
    return 'They’re already in a squad — a player can only be in one at a time.'
  if (/row-level security|policy/i.test(msg)) return 'Only the squad leader can do that.'
  if (/char_length|too long/i.test(msg)) return 'Squad name needs to be 2–40 characters.'
  return 'Something went wrong — try again.'
}

import { supabase, supabaseConfigured } from './supabase'
import { ALL_QUESTS } from '../data/quests'
import { BADGES, levelFromXp, type Progress } from './game'
import type { CompletedEntry, PersistedState } from './store'

// ============================================================================
// SideQuest sync engine — the bridge between the local game and Supabase.
//
// Design: the app stays fully playable offline. Sync is a progressive layer:
// every function here no-ops (returns null/false) when Supabase isn't
// configured or sign-in failed, and the UI falls back to the local demo.
//
// Identity: the app signs in ANONYMOUSLY on first launch. Supabase persists
// the session, so the device keeps the same uid forever. The uid IS the
// profile id (profiles.id = auth.uid()), which is what the RLS policies
// enforce.
// ============================================================================

// ── Identity ────────────────────────────────────────────────────────────────

let cachedUid: string | null | undefined

/** Returns the device's stable uid, or null when offline/unconfigured. */
export async function ensureIdentity(): Promise<string | null> {
  if (!supabase) return null
  if (cachedUid !== undefined) return cachedUid
  try {
    const { data } = await supabase.auth.getSession()
    let uid = data.session?.user.id ?? null
    if (!uid) {
      const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously()
      if (anonErr) console.warn('[sync] anonymous sign-in unavailable (enable it in Supabase → Authentication → Sign In / Up):', anonErr.message)
      uid = anon.user?.id ?? null
    }
    cachedUid = uid
    return uid
  } catch {
    cachedUid = null
    return null
  }
}

export const syncEnabled = (): boolean => supabaseConfigured

// ── Profile push ────────────────────────────────────────────────────────────

/** Upserts the player's real stats into `profiles` (id = the auth uid). */
export async function syncProfile(uid: string, state: PersistedState): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: uid,
        name: state.playerName,
        emoji: playerEmoji(state),
        xp: state.xp,
        streak: state.streak,
        last_quest_at: state.lastQuestDate ? new Date(state.lastQuestDate).toISOString() : null,
        home_base_id: state.startPlace ? null : state.homeBaseId,
        start_place: state.startPlace ?? null,
        last_active_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
  if (error) console.warn('[sync] profile push failed', error.message)
}

// ── Completions push ────────────────────────────────────────────────────────

/**
 * Pushes everything the player has finished: quests, chains, and badges.
 * Idempotent — safe to call on every launch and after every completion.
 */
export async function syncCompletions(uid: string, state: PersistedState): Promise<void> {
  if (!supabase) return

  const questRows: { profile_id: string; quest_id: string; completed_at: string; xp: number; weather: string | null; dist_from_home_km: number | null }[] = []
  const chainRows: { profile_id: string; chain_id: string; completed_at: string; xp: number; is_custom: boolean }[] = []

  for (const [id, entry] of Object.entries(state.completed)) {
    if (ALL_QUESTS.some((q) => q.id === id)) {
      questRows.push({
        profile_id: uid,
        quest_id: id,
        completed_at: entry.at,
        xp: entry.xp,
        weather: entry.weather ?? null,
        dist_from_home_km: entry.distFromHomeKm ?? null,
      })
    } else if (id.startsWith('chain-') || id.startsWith('s-') || id.startsWith('c-')) {
      chainRows.push({
        profile_id: uid,
        chain_id: id,
        completed_at: entry.at,
        xp: entry.xp,
        is_custom: id.startsWith('s-') || id.startsWith('c-'),
      })
    }
  }

  if (questRows.length > 0) {
    const { error } = await supabase
      .from('quest_completions')
      .upsert(questRows, { onConflict: 'profile_id,quest_id' })
    if (error) console.warn('[sync] quest push failed', error.message)
  }
  if (chainRows.length > 0) {
    const { error } = await supabase
      .from('chain_completions')
      .upsert(chainRows, { onConflict: 'profile_id,chain_id' })
    if (error) console.warn('[sync] chain push failed', error.message)
  }

  // Badges: evaluate the same rules as the local game and record what's earned.
  const progress: Progress = {
    completedIds: questRows.map((r) => r.quest_id),
    completedChainIds: chainRows.map((r) => r.chain_id),
    xp: state.xp,
    streak: state.streak,
    entries: Object.fromEntries(
      Object.entries(state.completed).map(([id, e]) => [id, e as CompletedEntry]),
    ) as Record<string, import('./game').CompletionMeta>,
  }
  const earned = BADGES.filter((b) => b.earned(progress)).map((b) => ({
    profile_id: uid,
    badge_id: b.id,
    earned_at: new Date().toISOString(),
  }))
  if (earned.length > 0) {
    const { error } = await supabase.from('badge_earnings').upsert(earned, { onConflict: 'profile_id,badge_id' })
    if (error) console.warn('[sync] badge push failed', error.message)
  }
}

// ── Friend requests ─────────────────────────────────────────────────────────

export interface IncomingRequest {
  id: string
  senderId: string
  senderName: string
  senderEmoji: string
  senderXp: number
  createdAt: string
}

/** Sends a real friend request to another profile's uid. */
export async function sendFriendRequest(uid: string, recipientUid: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('friend_requests').insert({
    id: crypto.randomUUID(),
    sender_id: uid,
    recipient_id: recipientUid,
    status: 'pending',
  })
  if (error) {
    console.warn('[sync] request failed', error.message)
    return false
  }
  return true
}

/** Accepts a pending request: flips status and creates the friendship. */
export async function acceptFriendRequest(uid: string, requestId: string): Promise<boolean> {
  if (!supabase) return false
  try {
    const { data: req } = await supabase
      .from('friend_requests')
      .select('sender_id,recipient_id')
      .eq('id', requestId)
      .single()
    if (!req) return false

    const a = req.sender_id < req.recipient_id ? req.sender_id : req.recipient_id
    const b = req.sender_id < req.recipient_id ? req.recipient_id : req.sender_id

    const { error: frErr } = await supabase
      .from('friend_requests')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('recipient_id', uid)
    if (frErr) return false

    // Plain insert — a friendship is unique per pair, so a duplicate key just
    // means they were already friends (e.g. a request raced an earlier accept).
    const { error: fErr } = await supabase
      .from('friendships')
      .insert({ user_a_id: a, user_b_id: b, created_at: new Date().toISOString() })
    if (fErr && !fErr.message.includes('duplicate key')) return false
    return true
  } catch {
    return false
  }
}

/** Declines a pending request. */
export async function declineFriendRequest(uid: string, requestId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('friend_requests')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('recipient_id', uid)
  if (error) return false
  return true
}

/** Fetches incoming pending requests with the sender's profile. */
export async function fetchIncomingRequests(uid: string): Promise<IncomingRequest[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('friend_requests')
      .select('id,sender_id,recipient_id,created_at')
      .eq('recipient_id', uid)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error || !data) return []

    const senderIds = [...new Set(data.map((r) => r.sender_id))]
    const { data: senders } = await supabase.from('profiles').select('id,name,emoji,xp').in('id', senderIds)
    const byId = new Map((senders ?? []).map((s) => [s.id, s]))

    return data.map((r) => ({
      id: r.id,
      senderId: r.sender_id,
      senderName: byId.get(r.sender_id)?.name ?? 'SideQuester',
      senderEmoji: byId.get(r.sender_id)?.emoji ?? '🌱',
      senderXp: byId.get(r.sender_id)?.xp ?? 0,
      createdAt: r.created_at,
    }))
  } catch {
    return []
  }
}

// ── Real friends (from the DB) ──────────────────────────────────────────────

export interface RealFriend {
  id: string
  name: string
  emoji: string
  xp: number
  streak: number
  level: number
  questsDone: number
  badges: number
  lastActiveAt: string | null
}

/** Fetches the player's accepted friendships with the friends' real profiles. */
export async function fetchRealFriends(uid: string): Promise<RealFriend[]> {
  if (!supabase) return []
  try {
    const { data: pairs, error } = await supabase
      .from('friendships')
      .select('user_a_id,user_b_id')
      .or(`user_a_id.eq.${uid},user_b_id.eq.${uid}`)
    if (error || !pairs) return []

    const friendIds = pairs.map((p) => (p.user_a_id === uid ? p.user_b_id : p.user_a_id))
    if (friendIds.length === 0) return []
    const { data: profs } = await supabase
      .from('profiles')
      .select('id,name,emoji,xp,streak,last_quest_at,last_active_at')
      .in('id', friendIds)
    if (!profs) return []

    const { data: counts } = await supabase
      .from('quest_completions')
      .select('profile_id,quest_id')
      .in('profile_id', friendIds)
    const perFriend = new Map<string, number>()
    for (const c of counts ?? []) perFriend.set(c.profile_id, (perFriend.get(c.profile_id) ?? 0) + 1)

    const { data: badgeRows } = await supabase
      .from('badge_earnings')
      .select('profile_id,badge_id')
      .in('profile_id', friendIds)
    const badgesPerFriend = new Map<string, number>()
    for (const b of badgeRows ?? []) badgesPerFriend.set(b.profile_id, (badgesPerFriend.get(b.profile_id) ?? 0) + 1)

    return profs.map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      xp: p.xp,
      streak: p.streak,
      level: levelFromXp(p.xp),
      questsDone: perFriend.get(p.id) ?? 0,
      badges: badgesPerFriend.get(p.id) ?? 0,
      lastActiveAt: p.last_active_at,
    }))
  } catch {
    return []
  }
}

// ── Find people ──────────────────────────────────────────────────────────────

export interface FoundPerson {
  id: string
  name: string
  emoji: string
  xp: number
  level: number
}

/** Searches real profiles by name (profiles are publicly readable by design). */
export async function findPeople(query: string, myUid: string): Promise<FoundPerson[]> {
  if (!supabase || !query.trim()) return []
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,name,emoji,xp')
      .ilike('name', `%${query.trim()}%`)
      .limit(8)
    if (error || !data) return []
    return data
      .filter((p) => p.id !== myUid)
      .map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, xp: p.xp, level: levelFromXp(p.xp) }))
  } catch {
    return []
  }
}

// ── Realtime ────────────────────────────────────────────────────────────────

/**
 * Subscribes to new incoming friend requests. Returns an unsubscribe function.
 * No-ops (returns a no-op) when offline.
 */
const requestChannels = new Map<string, ReturnType<typeof createRequestChannel>>()

function createRequestChannel(uid: string, cb: () => void) {
  const channel = supabase!
    .channel(`requests-${uid}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'friend_requests', filter: `recipient_id=eq.${uid}` },
      cb,
    )
    .subscribe()
  return { channel, cb }
}

export function subscribeIncomingRequests(uid: string, cb: () => void): () => void {
  if (!supabase) return () => {}
  // Re-subscribing (e.g. a React hot reload or re-mount) must not re-add callbacks
  // to an already-subscribed channel — that throws. Reuse the existing channel
  // and just swap the callback instead.
  const existing = requestChannels.get(uid)
  if (existing) {
    existing.cb = cb
    return () => {
      requestChannels.delete(uid)
      supabase?.removeChannel(existing.channel)
    }
  }
  const entry = createRequestChannel(uid, cb)
  requestChannels.set(uid, entry)
  return () => {
    requestChannels.delete(uid)
    supabase?.removeChannel(entry.channel)
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** The player's avatar emoji: their level icon, mirroring the Friends screen. */
function playerEmoji(state: PersistedState): string {
  const LEVEL_EMOJI = ['🌱', '🌿', '🔥', '⚡', '🌟', '💎', '👑', '🦁', '🚀', '🌍', '🏆', '🇿🇦']
  const level = levelFromXp(state.xp)
  return LEVEL_EMOJI[Math.min(level - 1, LEVEL_EMOJI.length - 1)]
}

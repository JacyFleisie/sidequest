import { Capacitor } from '@capacitor/core'
import { supabase, supabaseConfigured } from './supabase'
import { ALL_QUESTS } from '../data/quests'
import { BADGES, levelFromXp, type Progress } from './game'
import { acquireTurnstileToken, turnstileEnabled } from '../components/Turnstile'
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
    if (uid) {
      // Validate the session server-side. If the auth user was deleted (e.g. a
      // database wipe) the device still holds a dead token, and every API call
      // fails with "User from sub claim JWT does not exist". Self-heal: clear
      // it and fall through to a fresh anonymous identity. Network errors are
      // NOT healed (offline should keep the cached session).
      const { error } = await supabase.auth.getUser()
      if (error && /sub claim|does not exist/i.test(error.message)) {
        console.warn('[sync] stale session detected, starting fresh identity')
        await supabase.auth.signOut()
        uid = null
      }
    }
    if (!uid) {
      // When Supabase's captcha protection is on, anonymous sign-in requires a
      // fresh Turnstile token. Acquire one invisibly — users never see it.
      const captchaToken = turnstileEnabled ? await acquireTurnstileToken() : undefined
      const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously(
        captchaToken ? { options: { captchaToken } } : undefined,
      )
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

/** True when running inside the Capacitor Android shell (deep links apply). */
export const isNativePlatform = (): boolean => Capacitor.isNativePlatform()

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

// ── Activity feed (friends' completed quests) ───────────────────────────────

export interface FeedEvent {
  profileId: string
  name: string
  emoji: string
  questId: string
  questTitle: string
  city: string
  completedAt: string
  xp: number
}

/**
 * Fetches the real activity feed: quests completed by the player's friends,
 * newest first, capped at 30. Only works when signed in (RLS-scoped).
 */
export async function fetchFriendFeed(uid: string): Promise<FeedEvent[]> {
  if (!supabase) return []
  try {
    const { data: pairs } = await supabase
      .from('friendships')
      .select('user_a_id,user_b_id')
      .or(`user_a_id.eq.${uid},user_b_id.eq.${uid}`)
    const friendIds = (pairs ?? []).map((p) => (p.user_a_id === uid ? p.user_b_id : p.user_a_id))
    if (friendIds.length === 0) return []

    const { data: completions } = await supabase
      .from('quest_completions')
      .select('profile_id,quest_id,completed_at,xp')
      .in('profile_id', friendIds)
      .order('completed_at', { ascending: false })
      .limit(30)
    if (!completions || completions.length === 0) return []

    const { data: profs } = await supabase
      .from('profiles')
      .select('id,name,emoji')
      .in('id', friendIds)
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]))

    return completions.map((c) => {
      const q = ALL_QUESTS.find((x) => x.id === c.quest_id)
      const prof = profMap.get(c.profile_id)
      return {
        profileId: c.profile_id,
        name: prof?.name ?? 'A friend',
        emoji: prof?.emoji ?? '🧭',
        questId: c.quest_id,
        questTitle: q?.title ?? c.quest_id,
        city: q?.city ?? '',
        completedAt: c.completed_at,
        xp: c.xp,
      }
    })
  } catch {
    return []
  }
}

/** Subscribes to friends' new quest completions (live feed updates). */
export function subscribeFriendFeed(uid: string, cb: () => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`feed-${uid}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quest_completions' }, cb)
    .subscribe()
  return () => {
    supabase?.removeChannel(channel)
  }
}

// ── Challenges ───────────────────────────────────────────────────────────────

export interface Challenge {
  id: string
  challengerId: string
  opponentId: string
  kind: 'race' | 'coop'
  targetType: 'quest' | 'chain'
  targetId: string
  message: string | null
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'expired'
  challengerDone: boolean
  opponentDone: boolean
  winnerId: string | null
  createdAt: string
  respondedAt: string | null
  completedAt: string | null
}

/** Fetches incoming pending challenges. */
export async function fetchIncomingChallenges(uid: string): Promise<Challenge[]> {
  if (!supabase) return []
  try {
    const { data } = await supabase
      .from('challenges')
      .select('*')
      .eq('opponent_id', uid)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    return (data ?? []).map(rowChallenge)
  } catch {
    return []
  }
}

/** Fetches active/open challenges where the player is involved.
 * Includes accepted, completed, AND pending challenges the user sent as challenger
 * (so the challenger can see their outgoing challenges waiting for a response). */
export async function fetchActiveChallenges(uid: string): Promise<Challenge[]> {
  if (!supabase) return []
  try {
    const { data } = await supabase
      .from('challenges')
      .select('*')
      .in('status', ['accepted', 'completed'])
      .or(`challenger_id.eq.${uid},opponent_id.eq.${uid}`)
      .order('created_at', { ascending: false })
    // Also fetch pending challenges where this user is the challenger
    const { data: sent } = await supabase
      .from('challenges')
      .select('*')
      .eq('challenger_id', uid)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    const all = [...(data ?? []), ...(sent ?? [])]
    // Deduplicate by id
    const seen = new Set<string>()
    return all.filter((r) => {
      if (seen.has(r.id)) return false
      seen.add(r.id)
      return true
    }).map(rowChallenge)
  } catch {
    return []
  }
}

/** Sends a challenge request. */
export async function sendChallenge(
  uid: string,
  opponentId: string,
  kind: string,
  targetType: string,
  targetId: string,
  message?: string,
): Promise<boolean> {
  if (!supabase) return false
  try {
    const { error } = await supabase.from('challenges').insert({
      id: crypto.randomUUID(),
      challenger_id: uid,
      opponent_id: opponentId,
      kind,
      target_type: targetType,
      target_id: targetId,
      message: message ?? null,
    })
    if (error) return false
    return true
  } catch {
    return false
  }
}

/** Accepts a challenge. */
export async function acceptChallenge(uid: string, challengeId: string): Promise<boolean> {
  if (!supabase) return false
  try {
    const { error } = await supabase
      .from('challenges')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', challengeId)
      .or(`challenger_id.eq.${uid},opponent_id.eq.${uid}`)
    return !error
  } catch {
    return false
  }
}

/** Declines a challenge. */
export async function declineChallenge(uid: string, challengeId: string): Promise<boolean> {
  if (!supabase) return false
  try {
    const { error } = await supabase
      .from('challenges')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', challengeId)
      .or(`challenger_id.eq.${uid},opponent_id.eq.${uid}`)
    return !error
  } catch {
    return false
  }
}

/**
 * Marks the player as done on any active challenges targeting the given
 * quest/chain ids. Called right after a quest or chain is completed.
 */
export async function completeMatchingChallenges(
  uid: string,
  questIds: string[],
  chainIds: string[],
): Promise<void> {
  if (!supabase) return
  if (questIds.length === 0 && chainIds.length === 0) return
  try {
    const { data: active } = await supabase
      .from('challenges')
      .select('id,target_type,target_id')
      .eq('status', 'accepted')
      .or(`challenger_id.eq.${uid},opponent_id.eq.${uid}`)
    for (const c of active ?? []) {
      const matches =
        (c.target_type === 'quest' && questIds.includes(c.target_id)) ||
        (c.target_type === 'chain' && chainIds.includes(c.target_id))
      if (matches) await completeChallengeStep(uid, c.id)
    }
  } catch {
    // Best effort — challenge marking must never block gameplay.
  }
}

/** Marks the current user as done on a challenge. If both are done, resolves it. */
export async function completeChallengeStep(uid: string, challengeId: string): Promise<boolean> {
  if (!supabase) return false
  try {
    const { data: chal } = await supabase
      .from('challenges')
      .select('*')
      .eq('id', challengeId)
      .single()
    if (!chal) return false

    const isChallenger = chal.challenger_id === uid
    const field = isChallenger ? 'challenger_done' : 'opponent_done'
    if (chal[field]) return true // already marked

    const update: Record<string, string | boolean | null> = {}
    update[field] = true

    // If both done, resolve
    const otherField = isChallenger ? 'opponent_done' : 'challenger_done'
    if (chal[otherField]) {
      update.winner_id = uid // this player just completed — they win
      update.status = 'completed'
      update.completed_at = new Date().toISOString()
    }

    const { error } = await supabase.from('challenges').update(update).eq('id', challengeId)
    return !error
  } catch {
    return false
  }
}

/** Converts a raw DB row to a Challenge. */
function rowChallenge(row: Record<string, unknown>): Challenge {
  return {
    id: row.id as string,
    challengerId: row.challenger_id as string,
    opponentId: row.opponent_id as string,
    kind: row.kind as 'race' | 'coop',
    targetType: row.target_type as 'quest' | 'chain',
    targetId: row.target_id as string,
    message: (row.message as string) ?? null,
    status: row.status as Challenge['status'],
    challengerDone: row.challenger_done as boolean,
    opponentDone: row.opponent_done as boolean,
    winnerId: (row.winner_id as string) ?? null,
    createdAt: (row.created_at as string) ?? '',
    respondedAt: (row.responded_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
  }
}

// ── Auth deep-link callback (Android password reset) ────────────────────────

/** The deep link password-reset emails redirect to on Android. */
export const AUTH_REDIRECT = 'com.jacy.sidequest://auth/callback'

/**
 * Completes a deep-link auth callback (Android only): exchanges the PKCE code
 * (or stores the implicit tokens) and lets the caller reload the app against
 * the new identity. Used by the password-reset email link.
 */
export async function handleAuthCallback(url: string): Promise<boolean> {
  if (!supabase) return false
  try {
    if (url.includes('code=')) {
      const { error } = await supabase.auth.exchangeCodeForSession(url)
      return !error
    }
    if (url.includes('#access_token=')) {
      const params = new URLSearchParams(url.split('#')[1] ?? '')
      const { error } = await supabase.auth.setSession({
        access_token: params.get('access_token') ?? '',
        refresh_token: params.get('refresh_token') ?? '',
      })
      return !error
    }
    return false
  } catch (e) {
    console.warn('[sync] auth callback failed', (e as Error).message)
    return false
  }
}

// ── Account (email + password) ───────────────────────────────────────────────

/** Info about the currently signed-in user. */
export interface AccountInfo {
  uid: string
  email: string | null
  isAnonymous: boolean
  createdAt: string
  /** Identity providers on the account, e.g. ['google'] or ['email']. */
  providers: string[]
}

/** Returns info about the currently signed-in user, or null when offline. */
export async function getAccountInfo(): Promise<AccountInfo | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) return null
  return {
    uid: user.id,
    email: user.email ?? null,
    isAnonymous: (user as unknown as Record<string, unknown>).is_anonymous === true,
    createdAt: user.created_at,
    // e.g. ['google'], ['email'], or [] for pure anonymous users.
    providers: (user.identities ?? []).map((i) => i.provider),
  }
}

/**
 * Upgrades the current anonymous user to an email+password account (same uid —
 * no data migration needed). If the session is stale — e.g. the underlying auth
 * user was deleted by a database wipe while the device kept its old token — it
 * starts a fresh anonymous identity and retries, so account creation never
 * dead-ends on "User from sub claim JWT does not exist".
 */
export async function upgradeToAccount(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Not connected to the sync server.' }

  /** Signs in anonymously if there is no session at all (e.g. after the
   * Google fallback signed the guest out). Returns false if that fails. */
  const ensureSession = async (): Promise<boolean> => {
    const { data } = await supabase!.auth.getSession()
    if (data.session) return true
    const { data: anon, error } = await supabase!.auth.signInAnonymously()
    return Boolean(anon.user && !error)
  }

  const attempt = async (): Promise<string | null> => {
    // NOTE: updateUser() has no captchaToken option in this SDK version, and
    // Supabase's captcha protection targets sign-in/sign-up/recovery — the
    // anonymous→email upgrade isn't one of those endpoints.
    const { error } = await supabase!.auth.updateUser({ email, password })
    return error?.message ?? null
  }

  // updateUser requires a session — make sure we have one (anonymous is fine).
  if (!(await ensureSession())) {
    return { ok: false, error: 'Could not start a session — try again.' }
  }

  let errMsg = await attempt()
  if (
    errMsg &&
    (/does not exist|sub claim/i.test(errMsg) || /session missing/i.test(errMsg))
  ) {
    // The signed-in identity is stale or gone (a DB wipe deleted the auth
    // user, or the session was cleared out from under us). Clear it, get a
    // brand-new anonymous identity, and try the upgrade again.
    try {
      await supabase.auth.signOut()
    } catch {
      // best effort — the session may already be gone
    }
    cachedUid = null
    if (!(await ensureSession())) {
      return { ok: false, error: 'Could not start a fresh session — try again.' }
    }
    errMsg = await attempt()
  }

  if (errMsg) {
    if (errMsg.includes('Database error saving new user'))
      return { ok: false, error: 'This email may already be in use. Try signing in instead.' }
    if (/email rate limit/i.test(errMsg))
      return {
        ok: false,
        error:
          'Supabase is rate-limiting emails right now — wait about an hour, or raise the limit in Supabase → Authentication → Rate Limits (Email).',
      }
    return { ok: false, error: errMsg }
  }
  cachedUid = null // invalidate so next ensureIdentity() re-reads
  return { ok: true }
}

/** Signs in with email + password. */
export async function signInToAccount(
  email: string,
  password: string,
  captchaToken?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Not connected to the sync server.' }
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken },
  })
  if (error) return { ok: false, error: error.message }
  cachedUid = null
  return { ok: true }
}

/** Sends a password-reset email. The link re-opens the app (deep link on
 * Android, the site URL on web) with a recovery session. */
export async function sendPasswordReset(email: string, captchaToken?: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Not connected to the sync server.' }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: isNativePlatform() ? AUTH_REDIRECT : undefined,
    captchaToken,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Sets a new password while in a recovery session (after the email link). */
export async function updatePassword(newPassword: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Not connected to the sync server.' }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false, error: error.message }
  cachedUid = null
  return { ok: true }
}

/** Signs out and returns to anonymous mode. */
export async function signOutAccount(): Promise<void> {
  if (!supabase) return
  cachedUid = null
  await supabase.auth.signOut()
}

/** Subscribes to auth state changes. Returns an unsubscribe function. */
export function onAuthChange(cb: (uid: string | null) => void): () => void {
  if (!supabase) return () => {}
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user.id ?? null)
  })
  return subscription.unsubscribe
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** The player's avatar emoji: their level icon, mirroring the Friends screen. */
function playerEmoji(state: PersistedState): string {
  const LEVEL_EMOJI = ['🌱', '🌿', '🔥', '⚡', '🌟', '💎', '👑', '🦁', '🚀', '🌍', '🏆', '🇿🇦']
  const level = levelFromXp(state.xp)
  return LEVEL_EMOJI[Math.min(level - 1, LEVEL_EMOJI.length - 1)]
}

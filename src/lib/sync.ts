import { Capacitor } from '@capacitor/core'
import { supabase, supabaseConfigured } from './supabase'
import { ALL_QUESTS, findQuest, type Category, type Vibe } from '../data/quests'
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
      uid = await signInAnonymouslyWithCaptcha()
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

/**
 * Signs in anonymously, passing an invisible Turnstile token when captcha
 * protection is enabled (Supabase rejects token-less anonymous sign-ins then).
 * Returns the uid, or null on failure.
 */
async function signInAnonymouslyWithCaptcha(): Promise<string | null> {
  if (!supabase) return null
  const captchaToken = turnstileEnabled ? await acquireTurnstileToken() : undefined
  const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously(
    captchaToken ? { options: { captchaToken } } : undefined,
  )
  if (anonErr) console.warn('[sync] anonymous sign-in unavailable (enable it in Supabase → Authentication → Sign In / Up):', anonErr.message)
  return anon.user?.id ?? null
}

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
    if (ALL_QUESTS.some((q) => q.id === id) || (state.customQuests ?? []).some((c) => c.id === id)) {
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

/**
 * Case-insensitive username availability check (profiles are publicly readable
 * by design, so a plain query works). Returns true when no one else holds the
 * name; offline/unconfigured returns true and the DB unique index remains the
 * backstop.
 */
export async function isUsernameAvailable(uid: string, name: string): Promise<boolean> {
  if (!supabase) return true
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .ilike('name', name.trim())
      .neq('id', uid)
      .limit(1)
    return (data ?? []).length === 0
  } catch {
    return true
  }
}

/** Username rules shared by the sign-up and edit-profile forms. */
export const USERNAME_RULES = {
  min: 2,
  max: 20,
  pattern: /^[a-zA-Z0-9 _.'-]+$/,
} as const

export const usernameError = (name: string): string | null => {
  const n = name.trim()
  if (n.length < USERNAME_RULES.min || n.length > USERNAME_RULES.max)
    return `Username needs to be ${USERNAME_RULES.min}–${USERNAME_RULES.max} characters.`
  if (!USERNAME_RULES.pattern.test(n))
    return 'Usernames can only use letters, numbers, spaces, _ . - \' .'
  return null
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

// ── Custom quests (user-made anywhere-quests) ───────────────────────────────

export interface CustomQuestDraft {
  title: string
  description: string
  emoji: string
  category: Category
  vibe: Vibe[]
  durationMin: number
  cost: number
  players: [number, number]
  difficulty: number
  xp: number
  tags: string[]
}

/** A custom quest row with its creator's profile, as served by the feed. */
export interface CustomQuestRow {
  id: string
  ownerId: string
  ownerName: string
  ownerEmoji: string
  draft: CustomQuestDraft
  createdAt: string
  /** True once the quest reached the report threshold and was auto-hidden. */
  hidden: boolean
}

/** Publishes a custom quest to Supabase. The id is app-generated so the local
 * copy and the DB row always match. */
export async function saveCustomQuest(
  uid: string,
  id: string,
  draft: CustomQuestDraft,
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('custom_quests').insert({
    id,
    profile_id: uid,
    title: draft.title,
    description: draft.description,
    emoji: draft.emoji,
    category: draft.category,
    vibe: draft.vibe,
    duration_min: draft.durationMin,
    cost: draft.cost,
    players_min: draft.players[0],
    players_max: draft.players[1],
    difficulty: draft.difficulty,
    xp: draft.xp,
    tags: draft.tags,
  })
  if (error) {
    console.warn('[sync] custom quest save failed', error.message)
    return false
  }
  return true
}

/** Fetches community quests (platform-wide — anyone can see them), newest
 * first. Auto-hidden quests are excluded — except the user's own, so a
 * creator can still see (and delete) their hidden quest. Empty when
 * offline/unconfigured. */
export async function fetchCustomQuests(uid: string): Promise<CustomQuestRow[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('custom_quests')
      .select(
        'id,profile_id,title,description,emoji,category,vibe,duration_min,cost,players_min,players_max,difficulty,xp,tags,created_at,hidden',
      )
      .or(`hidden.eq.false,profile_id.eq.${uid}`)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error || !data || data.length === 0) return []

    const ownerIds = [...new Set(data.map((r) => r.profile_id))]
    const { data: owners } = await supabase
      .from('profiles')
      .select('id,name,emoji')
      .in('id', ownerIds)
    const ownerMap = new Map((owners ?? []).map((o) => [o.id, o]))

    return data.map((r) => ({
      id: r.id,
      ownerId: r.profile_id,
      ownerName: ownerMap.get(r.profile_id)?.name ?? 'SideQuester',
      ownerEmoji: ownerMap.get(r.profile_id)?.emoji ?? '🌱',
      createdAt: r.created_at,
      hidden: Boolean(r.hidden),
      draft: {
        title: r.title,
        description: r.description ?? '',
        emoji: r.emoji ?? '✨',
        category: r.category as Category,
        vibe: (r.vibe ?? []) as Vibe[],
        durationMin: r.duration_min,
        cost: r.cost,
        players: [r.players_min, r.players_max] as [number, number],
        difficulty: r.difficulty,
        xp: r.xp,
        tags: (r.tags ?? []) as string[],
      },
    }))
  } catch {
    return []
  }
}

/** Deletes one of the player's own custom quests. */
export async function deleteCustomQuest(uid: string, id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('custom_quests')
    .delete()
    .eq('id', id)
    .eq('profile_id', uid)
  if (error) console.warn('[sync] custom quest delete failed', error.message)
  return !error
}

/**
 * Reports a friend's custom quest. Each user can report a quest once — the
 * quest auto-hides at REPORT_THRESHOLD reports (handled by a DB trigger).
 * Returns 'ok' on a fresh report, 'duplicate' if this user already reported
 * it (or it's their own quest), and 'error' on any failure.
 */
export async function reportCustomQuest(
  uid: string,
  questId: string,
): Promise<'ok' | 'duplicate' | 'error'> {
  if (!supabase) return 'error'
  try {
    const { error } = await supabase.from('quest_reports').insert({
      id: crypto.randomUUID(),
      custom_quest_id: questId,
      reporter_id: uid,
    })
    if (!error) return 'ok'
    if (/duplicate key|unique/i.test(error.message)) return 'duplicate'
    if (/row-level security|policy/i.test(error.message)) return 'duplicate'
    console.warn('[sync] report failed', error.message)
    return 'error'
  } catch {
    return 'error'
  }
}

/** Looks up one profile's display name (for notification text). */
export async function fetchProfileName(uid: string): Promise<string | null> {
  if (!supabase) return null
  try {
    const { data } = await supabase.from('profiles').select('name').eq('id', uid).maybeSingle()
    return data?.name ?? null
  } catch {
    return null
  }
}

/** Subscribes to custom-quest changes (platform-wide), so a new community
 * quest appears in the feed without a manual refresh. */
export function subscribeCustomQuests(cb: () => void): () => void {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`custom-quests`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_quests' }, cb)
    .subscribe()
  return () => {
    supabase?.removeChannel(channel)
  }
}

/** Registers (or refreshes) this device's FCM token for push notifications. */
export async function savePushToken(uid: string, token: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('push_tokens').upsert(
    { profile_id: uid, token, platform: 'android', updated_at: new Date().toISOString() },
    { onConflict: 'profile_id,token' },
  )
  if (error) console.warn('[sync] push token save failed', error.message)
  return !error
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

    // Custom-quest completions carry app-generated uuids — resolve their titles
    // from the custom_quests table (RLS scopes to friends' quests; anything left
    // unknown falls back to a generic label).
    const unknown = completions
      .filter((c) => !findQuest(c.quest_id))
      .map((c) => c.quest_id)
    const titleMap = new Map<string, string>()
    if (unknown.length > 0) {
      const { data: custom } = await supabase
        .from('custom_quests')
        .select('id,title')
        .in('id', unknown)
      for (const c of custom ?? []) titleMap.set(c.id, c.title)
    }

    return completions.map((c) => {
      const q = findQuest(c.quest_id)
      const prof = profMap.get(c.profile_id)
      return {
        profileId: c.profile_id,
        name: prof?.name ?? 'A friend',
        emoji: prof?.emoji ?? '🧭',
        questId: c.quest_id,
        questTitle: q?.title ?? titleMap.get(c.quest_id) ?? 'A quest',
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
}// ── Auth deep-link callback (Android password reset) ────────────────────────

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

  /** Signs in anonymously if there is no session at all (e.g. after sign-out
   * or the Google fallback). Captcha-aware — same helper the boot path uses.
   * Returns false if that fails. */
  const ensureSession = async (): Promise<boolean> => {
    const { data } = await supabase!.auth.getSession()
    if (data.session) return true
    return (await signInAnonymouslyWithCaptcha()) !== null
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

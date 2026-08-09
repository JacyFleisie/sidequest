import { ALL_QUESTS, CHAINS, type Quest } from '../data/quests'
import { BADGES, levelFromXp, type Progress } from './game'
import type { Friend } from './store'

// ── Deterministic seeded profile (no backend — stable per friend id) ────────
const hash = (s: string): number => {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const friendId = (name: string, emoji: string): string =>
  `f-${hash(`${name.toLowerCase()}|${emoji}`).toString(36)}`

export interface FriendActivity {
  questId: string
  title: string
  emoji: string
  city: string
  when: string // "2h ago"
  minutesAgo: number
}

export interface FriendBadge {
  id: string
  name: string
  emoji: string
  earnedAt: string
}

export interface FriendProfile {
  xp: number
  level: number
  streak: number
  questsDone: number
  badges: number
  provinces: number
  lastActive: string
  recent: FriendActivity[]
  favourite: Quest | null
  badgeEvents: FriendBadge[] // badges earned recently (while being your friend)
}

const RELATIVE = (minutesAgo: number): string => {
  if (minutesAgo < 60) return `${Math.max(1, minutesAgo)} min ago`
  if (minutesAgo < 60 * 24) return `${Math.floor(minutesAgo / 60)}h ago`
  const days = Math.floor(minutesAgo / (60 * 24))
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return `${Math.floor(days / 7)}w ago`
}

export const timeAgo = (iso: string): string => {
  const mins = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000)
  return RELATIVE(mins)
}

export const friendProfile = (friend: Friend): FriendProfile => {
  const seed = hash(friend.id)
  const rnd = (n: number): number => {
    // mulberry32
    let t = (seed ^ (n * 0x9e3779b9)) >>> 0
    t += 0x6d2b79f5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // Stats grow with real time since the friend was added, so profiles stay alive.
  const addedMs = new Date(friend.addedAt).getTime()
  const days = Number.isFinite(addedMs) ? Math.max(0, (Date.now() - addedMs) / 86400000) : 0
  const baseQuests = 2 + Math.floor(rnd(3) * 60)
  const perDay = 0.4 + rnd(7) * 1.2 // 0.4–1.6 quests/day
  const grown = Math.min(130, Math.floor(days * perDay))
  const questsDone = Math.min(baseQuests + grown, ALL_QUESTS.length - 15)
  const baseXp = 400 + Math.floor(rnd(1) * 14000)
  const xp = baseXp + Math.max(0, questsDone - baseQuests) * (80 + Math.floor(rnd(8) * 100))
  const level = levelFromXp(xp)
  const streak = Math.floor(rnd(2) * 14) // 0–13
  const provinces = 1 + Math.min(8, Math.floor(rnd(20) * 9))

  // Simulated quest history: deterministic picks, spread over ~90 days of history
  // plus the time they've been your friend, newest first. This lets the real badge
  // logic evaluate what they've earned and when.
  const now = Date.now()
  const historyMs = 90 * 86400000 + days * 86400000
  const picked: number[] = []
  for (let i = 0; i < questsDone; i += 1) {
    const idx = Math.floor(rnd(100 + i) * ALL_QUESTS.length)
    if (!picked.includes(idx)) picked.push(idx)
  }
  const entries: Record<string, { at: string; xp: number; weather?: 'rain' | 'dry' | 'unknown'; distFromHomeKm?: number }> = {}
  const completedIds: string[] = []
  picked.forEach((idx, i) => {
    const q = ALL_QUESTS[idx]
    completedIds.push(q.id)
    entries[q.id] = {
      at: new Date(now - (i / picked.length) * historyMs).toISOString(),
      xp: q.xp,
      weather: rnd(200 + i) < 0.3 ? 'rain' : 'dry',
      distFromHomeKm: 1 + rnd(300 + i) * 60,
    }
  })
  const completedChainIds: string[] = []
  const nChains = Math.min(CHAINS.length, Math.floor(picked.length / 10))
  for (let i = 0; i < nChains; i += 1) {
    const c = CHAINS[i % CHAINS.length]
    const key = `chain-${c.id}`
    completedChainIds.push(key)
    entries[key] = {
      at: new Date(now - (Math.max(0, picked.length - 1 - i) / picked.length) * historyMs).toISOString(),
      xp: 150 + Math.floor(rnd(400 + i) * 250),
    }
  }

  const progress: Progress = { completedIds, completedChainIds, xp, streak, entries }
  const earned = BADGES.filter((b) => b.earned(progress))
  const badgeEvents: FriendBadge[] = earned
    .map((b) => ({ id: b.id, name: b.name, emoji: b.emoji, earnedAt: b.progress ? b.progress(progress).earnedAt : null }))
    .filter((ev): ev is FriendBadge =>
      Boolean(ev.earnedAt) &&
      new Date(ev.earnedAt!).getTime() > addedMs &&
      now - new Date(ev.earnedAt!).getTime() < 14 * 86400000,
    )
    .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt))

  // Recent activity: 4 quests picked deterministically, newest first.
  const pick = (n: number): Quest => ALL_QUESTS[Math.floor(rnd(n) * ALL_QUESTS.length)]
  const qs = Array.from({ length: 4 }, (_, i) => pick(30 + i))
  const gaps = [40 + Math.floor(rnd(40) * 60 * 8), 3 * 60 + Math.floor(rnd(41) * 60 * 10), 20 * 60 + Math.floor(rnd(42) * 60 * 30), 3 * 24 * 60 + Math.floor(rnd(43) * 24 * 60 * 5)]
  const recent: FriendActivity[] = []
  let cumulative = 30 + Math.floor(rnd(44) * 60 * 2)
  for (let i = 0; i < qs.length; i += 1) {
    recent.push({
      questId: qs[i].id,
      title: qs[i].title,
      emoji: qs[i].emoji,
      city: qs[i].city,
      when: RELATIVE(cumulative),
      minutesAgo: cumulative,
    })
    cumulative += gaps[i]
  }

  return {
    xp,
    level,
    streak,
    questsDone,
    badges: earned.length,
    provinces,
    lastActive: recent[0].when,
    recent,
    favourite: qs[0],
    badgeEvents,
  }
}

// ── Friend card: name + emoji travel in a URL param, no backend ─────────────
export interface FriendCard {
  n: string
  e: string
}

export const encodeFriendCard = (name: string, emoji: string): string => {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify({ n: name, e: emoji }))))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const decodeFriendCard = (raw: string): FriendCard | null => {
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const data = JSON.parse(decodeURIComponent(escape(atob(padded)))) as FriendCard
    if (typeof data.n !== 'string' || typeof data.e !== 'string') return null
    return { n: data.n.slice(0, 24), e: data.e.slice(0, 8) }
  } catch {
    return null
  }
}

export const friendCardUrl = (name: string, emoji: string): string => {
  const base = `${window.location.origin}${window.location.pathname.split('/').slice(0, -1).join('/')}/`
  return `${base}?friend=${encodeFriendCard(name, emoji)}`
}

// ── Rivalry comparisons ──────────────────────────────────────────────────────
export interface Rivalry {
  label: string
  tone: 'ahead' | 'behind' | 'tied'
}

export const rivalry = (profile: FriendProfile, playerQuests: number, playerStreak: number): Rivalry => {
  const diff = profile.questsDone - playerQuests
  if (diff >= 5) {
    return { label: `${diff} quests ahead of you — catch up!`, tone: 'ahead' }
  }
  if (diff <= -5) {
    return { label: `You're ${-diff} quests ahead`, tone: 'behind' }
  }
  if (profile.streak > playerStreak + 2) {
    return { label: `On a ${profile.streak}-day streak — beat it!`, tone: 'ahead' }
  }
  if (Math.abs(diff) < 5 && playerStreak === profile.streak) {
    return { label: 'Neck and neck — next quest decides it', tone: 'tied' }
  }
  return { label: 'Quest rivals — keep exploring together', tone: 'tied' }
}

// ─────────────────────────────────────────────────────────────────────────────
// SideQuest game rules — the pure heart of the app, deliberately kept free of
// UI and I/O so every rule is unit-testable (see game.test.ts).
//
// Levels & ranks derive from total XP; badges and the stats dashboard derive
// from the completion history (entries) plus XP/streak. Nothing in this file
// touches localStorage, Supabase, or the DOM — components pass in plain data
// and get plain results back.
// ─────────────────────────────────────────────────────────────────────────────
import {
  ALL_QUESTS,
  CATEGORY_META,
  CHAINS,
  HOME_BASES,
  PROVINCES,
  type Category,
  type HomeBase,
  type ProvinceId,
} from '../data/quests'

// ── Levels ───────────────────────────────────────────────────────────────────
/** Cumulative XP required to REACH level n (level 1 = 0 XP): 0, 300, 900, 1 800… */
export const xpForLevel = (n: number): number => 300 * ((n * (n - 1)) / 2)

/** The player's level (1-based) for a given XP total. */
export const levelFromXp = (xp: number): number => {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level += 1
  return level
}

/** Level breakdown for progress bars: current level, XP into it, XP needed for
 * the next level, and 0–1 progress. */
export const levelProgress = (xp: number): { level: number; into: number; needed: number; pct: number } => {
  const level = levelFromXp(xp)
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)
  return { level, into: xp - base, needed: next - base, pct: (xp - base) / (next - base) }
}

// ── Ranks ────────────────────────────────────────────────────────────────────
export interface Rank {
  name: string
  emoji: string
  minXp: number
}

/** The rank ladder — big XP milestones that unlock titles. A player holds the
 * highest rank whose minXp they've reached. */
export const RANKS: Rank[] = [
  { name: 'Rookie', emoji: '🌱', minXp: 0 },
  { name: 'Explorer', emoji: '🧭', minXp: 900 },
  { name: 'Trailblazer', emoji: '🔥', minXp: 3000 },
  { name: 'Legend of SA', emoji: '🇿🇦', minXp: 6300 },
]

/** The rank for an XP total, plus the next rank and 0–1 progress toward it. */
export const rankFromXp = (xp: number): { rank: Rank; next: Rank | null; pct: number } => {
  let rank = RANKS[0]
  let next: Rank | null = RANKS[1] ?? null
  for (let i = 0; i < RANKS.length; i += 1) {
    if (xp >= RANKS[i].minXp) {
      rank = RANKS[i]
      next = RANKS[i + 1] ?? null
    }
  }
  const pct = next ? (xp - rank.minXp) / (next.minXp - rank.minXp) : 1
  return { rank, next, pct: Math.min(1, Math.max(0, pct)) }
}

// ── Progress ─────────────────────────────────────────────────────────────────
export type WeatherKind = 'rain' | 'dry' | 'unknown'

export interface CompletionMeta {
  at: string
  weather?: WeatherKind
  distFromHomeKm?: number
}

export interface Progress {
  completedIds: string[] // quest ids
  completedChainIds: string[]
  xp: number
  streak: number
  entries?: Record<string, CompletionMeta>
}

/** Total completions: single quests + multi-stop chains. */
export const totalCompleted = (p: Progress): number => p.completedIds.length + p.completedChainIds.length

/** Completed quests + chains per province — drives the province badges. */
export const completedCountByProvince = (p: Progress): Record<ProvinceId, number> => {
  const counts = Object.fromEntries(Object.keys(PROVINCES).map((k) => [k, 0])) as Record<ProvinceId, number>
  for (const id of p.completedIds) {
    const quest = ALL_QUESTS.find((x) => x.id === id)
    if (quest) counts[quest.province] += 1
  }
  for (const id of p.completedChainIds) {
    const chain = CHAINS.find((x) => x.id === id)
    if (chain) counts[chain.province] += 1
  }
  return counts
}

/** Total quests + chains available in a province — the pool badge targets are
 * sized against. */
export const totalQuestsInProvince = (province: ProvinceId): number =>
  ALL_QUESTS.filter((x) => x.province === province).length +
  CHAINS.filter((x) => x.province === province).length

// ── Stats dashboard ──────────────────────────────────────────────────────────
export interface PlayerStats {
  quests: number // distinct places visited
  km: number // distance from home to each completed quest
  hours: number // total quest time in hours
  byCategory: Record<Category, number>
  byProvince: Record<ProvinceId, number>
  favProvince: ProvinceId | null
}

/** Aggregate dashboard stats from the completion history: places visited, km
 * from home, hours played, per-category & per-province tallies, and the
 * favourite province. */
export const playerStats = (
  entries: Record<string, CompletionMeta> | undefined,
  home: { lat: number; lng: number },
): PlayerStats => {
  const byCategory = Object.fromEntries((Object.keys(CATEGORY_META) as Category[]).map((c) => [c, 0])) as Record<Category, number>
  const byProvince = Object.fromEntries(Object.keys(PROVINCES).map((k) => [k, 0])) as Record<ProvinceId, number>
  let km = 0
  let hours = 0
  let quests = 0
  for (const [id, entry] of Object.entries(entries ?? {})) {
    const quest = ALL_QUESTS.find((x) => x.id === id)
    if (!quest) continue
    quests += 1
    km += entry.distFromHomeKm ?? haversineKm(home.lat, home.lng, quest.lat, quest.lng)
    hours += quest.durationMin / 60
    byCategory[quest.category] += 1
    byProvince[quest.province] += 1
  }
  let favProvince: ProvinceId | null = null
  let favCount = 0
  for (const [id, count] of Object.entries(byProvince) as [ProvinceId, number][]) {
    if (count > favCount) {
      favCount = count
      favProvince = id
    }
  }
  return { quests, km, hours, byCategory, byProvince, favProvince }
}

// ── Badges ───────────────────────────────────────────────────────────────────
export interface BadgeProgress {
  done: number
  target: number
  earnedAt: string | null // ISO date when the badge was first earned
}

export interface BadgeDef {
  id: string
  name: string
  emoji: string
  description: string
  earned: (p: Progress) => boolean
  progress?: (p: Progress) => BadgeProgress
}

const anyEntry = (p: Progress, pred: (e: CompletionMeta) => boolean): boolean =>
  p.entries ? Object.values(p.entries).some(pred) : false

const entryTimes = (p: Progress, pred: (id: string, e: CompletionMeta) => boolean): string[] =>
  Object.entries(p.entries ?? {})
    .filter(([id, e]) => pred(id, e))
    .map(([, e]) => e.at)
    .sort()

const nthEarnedAt = (p: Progress, pred: (id: string, e: CompletionMeta) => boolean, n: number): string | null =>
  entryTimes(p, pred)[n - 1] ?? null

const questCatOf = (id: string): Category | null => ALL_QUESTS.find((x) => x.id === id)?.category ?? null

const countProgress = (p: Progress, done: number, target: number, pred?: (id: string, e: CompletionMeta) => boolean): BadgeProgress => ({
  done,
  target,
  earnedAt: pred && done >= target ? nthEarnedAt(p, pred, target) : null,
})

const catProgress = (cat: Category) => (p: Progress): BadgeProgress =>
  countProgress(p, countCategory(p, cat), 5, (id) => questCatOf(id) === cat)

const featProgress = (pred: (e: CompletionMeta) => boolean) => (p: Progress): BadgeProgress => {
  const done = Object.values(p.entries ?? {}).filter(pred).length
  return { done, target: 1, earnedAt: done >= 1 ? nthEarnedAt(p, (_, e) => pred(e), 1) : null }
}

const chainPred = (id: string): boolean => id.startsWith('chain-') || id.startsWith('s-')

const anywhereCount = (p: Progress): number =>
  p.completedIds.filter((id) => ALL_QUESTS.find((x) => x.id === id)?.anywhere).length

const provinceCount = (p: Progress): number =>
  Object.values(completedCountByProvince(p)).filter((c) => c >= 1).length

const totalKmFromHome = (p: Progress): number =>
  Object.values(p.entries ?? {}).reduce((sum, e) => sum + (e.distFromHomeKm ?? 0), 0)

const maxQuestsInDay = (p: Progress): number => {
  const byDay: Record<string, number> = {}
  for (const e of Object.values(p.entries ?? {})) {
    const day = new Date(e.at).toDateString()
    byDay[day] = (byDay[day] ?? 0) + 1
  }
  return Math.max(0, ...Object.values(byDay))
}

const provProgress = (prov: ProvinceId) => (p: Progress): BadgeProgress => {
  const done = completedCountByProvince(p)[prov]
  const target = PROVINCES[prov].badgeCount
  return {
    done,
    target,
    earnedAt: done >= target
      ? nthEarnedAt(p, (id) => {
          const q = ALL_QUESTS.find((x) => x.id === id)
          if (q) return q.province === prov
          return CHAINS.some((c) => c.id === id && c.province === prov)
        }, target)
      : null,
  }
}

export const BADGES: BadgeDef[] = [
  { id: 'first-quest', name: 'First Quest', emoji: '🐣', description: 'Complete your first SideQuest.', earned: (p) => totalCompleted(p) >= 1, progress: (p) => countProgress(p, totalCompleted(p), 1, () => true) },
  { id: 'quest-machine', name: 'Quest Machine', emoji: '🤖', description: 'Complete 10 SideQuests.', earned: (p) => totalCompleted(p) >= 10, progress: (p) => countProgress(p, totalCompleted(p), 10, () => true) },
  { id: 'streak-3', name: 'Streak Starter', emoji: '🔥', description: '3-day quest streak.', earned: (p) => p.streak >= 3, progress: (p) => ({ done: p.streak, target: 3, earnedAt: null }) },
  { id: 'streak-7', name: 'On Fire', emoji: '🌋', description: '7-day quest streak.', earned: (p) => p.streak >= 7, progress: (p) => ({ done: p.streak, target: 7, earnedAt: null }) },
  { id: 'road-tripper', name: 'Road Tripper', emoji: '🚗', description: 'Complete a multi-stop quest.', earned: (p) => p.completedChainIds.length >= 1, progress: (p) => countProgress(p, p.completedChainIds.length, 1, (id) => chainPred(id)) },
  { id: 'chain-master', name: 'Chain Master', emoji: '⛓️', description: 'Complete 3 multi-stop quests.', earned: (p) => p.completedChainIds.length >= 3, progress: (p) => countProgress(p, p.completedChainIds.length, 3, (id) => chainPred(id)) },
  { id: 'foodie', name: 'Foodie', emoji: '🍔', description: 'Complete 5 food quests.', earned: (p) => countCategory(p, 'food') >= 5, progress: catProgress('food') },
  { id: 'adrenaline', name: 'Adrenaline Junkie', emoji: '💥', description: 'Complete 5 adventure quests.', earned: (p) => countCategory(p, 'adventure') >= 5, progress: catProgress('adventure') },
  { id: 'chill-master', name: 'Chill Master', emoji: '😎', description: 'Complete 5 chill quests.', earned: (p) => countCategory(p, 'chill') >= 5, progress: catProgress('chill') },
  { id: 'activity-master', name: 'Activity Master', emoji: '⚽', description: 'Complete 5 activity quests.', earned: (p) => countCategory(p, 'activity') >= 5, progress: catProgress('activity') },
  { id: 'event-master', name: 'Event Master', emoji: '🎪', description: 'Complete 5 event quests.', earned: (p) => countCategory(p, 'event') >= 5, progress: catProgress('event') },
  { id: 'mystery-master', name: 'Mystery Master', emoji: '🕵️', description: 'Complete 5 mystery quests.', earned: (p) => countCategory(p, 'mystery') >= 5, progress: catProgress('mystery') },
  { id: 'free-spirit', name: 'Free Spirit', emoji: '🆓', description: 'Complete 5 free quests.', earned: (p) => countCategory(p, 'free') >= 5, progress: catProgress('free') },
  { id: 'night-owl', name: 'Night Owl', emoji: '🦉', description: 'Finish a quest after 8pm.', earned: (p) => anyEntry(p, (e) => { const h = new Date(e.at).getHours(); return h >= 20 || h < 5 }), progress: featProgress((e) => { const h = new Date(e.at).getHours(); return h >= 20 || h < 5 }) },
  { id: 'early-bird', name: 'Early Bird', emoji: '🌅', description: 'Finish a quest before 7am.', earned: (p) => anyEntry(p, (e) => new Date(e.at).getHours() < 7), progress: featProgress((e) => new Date(e.at).getHours() < 7) },
  { id: 'rain-warrior', name: 'Rain Warrior', emoji: '🌧️', description: 'Complete a quest while it\'s raining.', earned: (p) => anyEntry(p, (e) => e.weather === 'rain'), progress: featProgress((e) => e.weather === 'rain') },
  { id: 'km-10', name: '10km Club', emoji: '🥾', description: 'Complete a quest 10 km or more from your home base.', earned: (p) => anyEntry(p, (e) => (e.distFromHomeKm ?? 0) >= 10), progress: featProgress((e) => (e.distFromHomeKm ?? 0) >= 10) },
  { id: 'km-50', name: 'Long Haul', emoji: '🚗', description: 'Complete a quest 50 km or more from your home base.', earned: (p) => anyEntry(p, (e) => (e.distFromHomeKm ?? 0) >= 50), progress: featProgress((e) => (e.distFromHomeKm ?? 0) >= 50) },
  { id: 'total-km-25', name: '25km On Foot', emoji: '🚶', description: 'Cover 25 km in total from your home base.', earned: (p) => totalKmFromHome(p) >= 25, progress: (p) => ({ done: Math.round(totalKmFromHome(p)), target: 25, earnedAt: null }) },
  { id: 'total-km-100', name: 'Century of Strides', emoji: '🏁', description: 'Cover 100 km in total from your home base.', earned: (p) => totalKmFromHome(p) >= 100, progress: (p) => ({ done: Math.round(totalKmFromHome(p)), target: 100, earnedAt: null }) },
  { id: 'xp-500', name: 'Halfway There', emoji: '🚀', description: 'Earn 500 XP.', earned: (p) => p.xp >= 500, progress: (p) => ({ done: p.xp, target: 500, earnedAt: null }) },
  { id: 'xp-2000', name: 'Seasoned', emoji: '🌟', description: 'Earn 2,000 XP.', earned: (p) => p.xp >= 2000, progress: (p) => ({ done: p.xp, target: 2000, earnedAt: null }) },
  { id: 'xp-4500', name: 'Veteran', emoji: '🎖️', description: 'Earn 4,500 XP.', earned: (p) => p.xp >= 4500, progress: (p) => ({ done: p.xp, target: 4500, earnedAt: null }) },
  { id: 'quest-25', name: 'Completionist', emoji: '🏆', description: 'Complete 25 SideQuests.', earned: (p) => totalCompleted(p) >= 25, progress: (p) => countProgress(p, totalCompleted(p), 25, () => true) },
  { id: 'quest-50', name: 'Half-Century', emoji: '💎', description: 'Complete 50 SideQuests.', earned: (p) => totalCompleted(p) >= 50, progress: (p) => countProgress(p, totalCompleted(p), 50, () => true) },
  { id: 'streak-14', name: 'Unstoppable', emoji: '🧱', description: '14-day quest streak.', earned: (p) => p.streak >= 14, progress: (p) => ({ done: p.streak, target: 14, earnedAt: null }) },
  { id: 'streak-30', name: 'Iron Will', emoji: '🛡️', description: '30-day quest streak.', earned: (p) => p.streak >= 30, progress: (p) => ({ done: p.streak, target: 30, earnedAt: null }) },
  { id: 'anywhere-5', name: 'Social Butterfly', emoji: '🦋', description: 'Complete 5 anywhere quests.', earned: (p) => anywhereCount(p) >= 5, progress: (p) => countProgress(p, anywhereCount(p), 5, (id) => ALL_QUESTS.find((x) => x.id === id)?.anywhere === true) },
  { id: 'anywhere-15', name: 'People Person', emoji: '🗣️', description: 'Complete 15 anywhere quests.', earned: (p) => anywhereCount(p) >= 15, progress: (p) => countProgress(p, anywhereCount(p), 15, (id) => ALL_QUESTS.find((x) => x.id === id)?.anywhere === true) },
  { id: 'weekend-warrior', name: 'Weekend Warrior', emoji: '🎉', description: 'Finish a quest on a Saturday or Sunday.', earned: (p) => anyEntry(p, (e) => { const d = new Date(e.at).getDay(); return d === 0 || d === 6 }), progress: featProgress((e) => { const d = new Date(e.at).getDay(); return d === 0 || d === 6 }) },
  { id: 'golden-hour', name: 'Golden Hour', emoji: '🌇', description: 'Finish a quest between 5pm and 7pm.', earned: (p) => anyEntry(p, (e) => { const h = new Date(e.at).getHours(); return h >= 17 && h < 19 }), progress: featProgress((e) => { const h = new Date(e.at).getHours(); return h >= 17 && h < 19 }) },
  { id: 'day-tripper', name: 'Day Tripper', emoji: '🌍', description: 'Complete 3 quests in a single day.', earned: (p) => maxQuestsInDay(p) >= 3, progress: (p) => ({ done: maxQuestsInDay(p), target: 3, earnedAt: null }) },
  { id: 'sun-seeker', name: 'Sun Seeker', emoji: '☀️', description: 'Complete a quest on a dry day.', earned: (p) => anyEntry(p, (e) => e.weather === 'dry'), progress: featProgress((e) => e.weather === 'dry') },
  { id: 'provinces-3', name: 'Tri-Province', emoji: '🗺️', description: 'Complete quests in 3 provinces.', earned: (p) => provinceCount(p) >= 3, progress: (p) => ({ done: provinceCount(p), target: 3, earnedAt: null }) },
  { id: 'provinces-6', name: 'Six Provinces', emoji: '🧭', description: 'Complete quests in 6 provinces.', earned: (p) => provinceCount(p) >= 6, progress: (p) => ({ done: provinceCount(p), target: 6, earnedAt: null }) },
  { id: 'category-guru', name: 'Category Guru', emoji: '🏅', description: 'Complete 15 quests in any single category.', earned: (p) => (Object.keys(CATEGORY_META) as Category[]).some((c) => countCategory(p, c) >= 15), progress: (p) => ({ done: Math.max(0, ...(Object.keys(CATEGORY_META) as Category[]).map((c) => countCategory(p, c))), target: 15, earnedAt: null }) },
  ...Object.values(PROVINCES).map(
    (prov): BadgeDef => ({
      id: `province-${prov.id}`,
      name: prov.badge,
      emoji: prov.emoji,
      description: `Complete ${prov.badgeCount} quests in ${prov.name}.`,
      earned: (p) => completedCountByProvince(p)[prov.id] >= prov.badgeCount,
      progress: provProgress(prov.id),
    }),
  ),
  { id: 'sa-explorer', name: 'South Africa Explorer', emoji: '🇿🇦', description: 'Complete a quest in all 9 provinces.', earned: (p) => Object.keys(PROVINCES).every((k) => completedCountByProvince(p)[k as ProvinceId] >= 1), progress: (p) => ({ done: Object.keys(PROVINCES).filter((k) => completedCountByProvince(p)[k as ProvinceId] >= 1).length, target: 9, earnedAt: null }) },
]

const countCategory = (p: Progress, category: Category): number =>
  p.completedIds.filter((id) => ALL_QUESTS.find((x) => x.id === id)?.category === category).length


// ── Creator tiers (vanity titles for community quest authors) ───────────────
export interface CreatorTier {
  minQuests: number
  name: string
  emoji: string
  description: string
}

export const CREATOR_TIERS: CreatorTier[] = [
  { minQuests: 1, name: 'Quest Writer', emoji: '✍️', description: 'Publish your first community quest.' },
  { minQuests: 3, name: 'Quest Curator', emoji: '🎨', description: 'Publish 3 community quests.' },
  { minQuests: 10, name: 'Quest Master', emoji: '🏆', description: 'Publish 10 community quests.' },
  { minQuests: 25, name: 'Quest Legend', emoji: '👑', description: 'Publish 25 community quests.' },
]

/** The highest creator title earned for a given number of published quests. */
export const creatorTierFor = (published: number): CreatorTier | null => {
  let tier: CreatorTier | null = null
  for (const t of CREATOR_TIERS) if (published >= t.minQuests) tier = t
  return tier
}

/** The next title to work toward, or null at the top. */
export const nextCreatorTier = (published: number): CreatorTier | null =>
  CREATOR_TIERS.find((t) => t.minQuests > published) ?? null

// ── Event horizon ────────────────────────────────────────────────────────────
/** Whole days until an ISO date (ceils; negative when already passed). */
export const daysUntilIso = (iso: string): number =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)

/** How far ahead an event may start and still count as "upcoming". Roughly the
 * current season + one: festivals and concerts further out than this (e.g. a
 * 2027 edition while it's still 2026) clutter the feed and map with dates no
 * one can act on yet. */
export const EVENT_HORIZON_DAYS = 182 // ~6 months

/** True when a dated event is genuinely upcoming: not passed, and starting
 * within the event horizon (not "a year away"). Undated quests always
 * qualify. Seasonal quests whose expiry is past are hidden too. */
export const isUpcomingEvent = (q: { startsAt?: string; expiresAt?: string }): boolean => {
  if (q.startsAt) {
    const d = daysUntilIso(q.startsAt)
    if (d < 0 || d > EVENT_HORIZON_DAYS) return false
  }
  if (q.expiresAt) {
    const d = daysUntilIso(q.expiresAt)
    if (d <= 0 || d > EVENT_HORIZON_DAYS) return false
  }
  return true
}

// ── Misc formatting helpers ──────────────────────────────────────────────────
/** "45 min", "1h", "1h 30m" — from a duration in minutes. */
export const fmtDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export const fmtCost = (cost: number): string => (cost === 0 ? 'FREE' : `R${cost}`)

/** Display cost for a quest — real ticket price when it's a ticketed event
 * (e.g. "from R2 150"), otherwise the per-person cost (FREE when 0). Fixes the
 * "tickets from R2k but shows FREE" mismatch for auto-discovered events. */
export const questCostLabel = (q: { cost?: number; ticketInfo?: { required?: boolean; price?: string } }): string => {
  if (q.ticketInfo?.price) return q.ticketInfo.price
  if (q.ticketInfo?.required) return 'Tickets'
  return fmtCost(q.cost ?? 0)
}

/** 1–5 difficulty as a repeatable star string. */
export const difficultyStars = (n: number): string => '⭐'.repeat(n)

export const categoryColor = (category: Category): string => CATEGORY_META[category].color

export const getDevicePosition = (): Promise<{ lat: number; lng: number } | null> =>
  new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null)
      return
    }
    let settled = false
    const done = (v: { lat: number; lng: number } | null) => {
      if (!settled) {
        settled = true
        resolve(v)
      }
    }
    // Hard timeout so a hung permission prompt never leaves the UI stuck.
    const t = setTimeout(() => done(null), 6000)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(t)
        done({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        clearTimeout(t)
        done(null)
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    )
  })

// Free Open-Meteo weather lookup (no API key) — used to earn the Rain Warrior badge.
export const fetchWeather = async (lat: number, lng: number): Promise<WeatherKind> => {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=weather_code`,
      { signal: ctrl.signal },
    )
    clearTimeout(t)
    if (!res.ok) return 'unknown'
    const data = (await res.json()) as { current?: { weather_code?: number } }
    const code = data?.current?.weather_code ?? -1
    if ((code >= 51 && code <= 67) || (code >= 71 && code <= 77) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return 'rain'
    if (code >= 0 && code <= 3) return 'dry'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export const getUserLocation = (
  onOk: (lat: number, lng: number) => void,
  onErr: (message: string) => void,
): void => {
  if (!('geolocation' in navigator)) {
    onErr("Geolocation isn't supported in this browser.")
    return
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => onOk(pos.coords.latitude, pos.coords.longitude),
    () => onErr("Couldn't get your location. Check browser permissions or type a place instead."),
    { enableHighAccuracy: false, timeout: 8000 },
  )
}

// ── Location helpers ─────────────────────────────────────────────────────────
/**
 * Human name for a coordinate: reverse-geocodes via free OpenStreetMap Nominatim
 * (the same service search uses), falling back to the nearest of the 19 city bases.
 */
export const reverseGeocodeLabel = async (lat: number, lng: number): Promise<string> => {
  const fallback = nearestBase(lat, lng).label
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=12`,
    )
    if (!res.ok) return fallback
    const data = await res.json()
    const a = data?.address
    const name = a?.suburb || a?.town || a?.city || a?.village || a?.hamlet
    return name || fallback
  } catch {
    return fallback
  }
}

export const nearestBase = (lat: number, lng: number): HomeBase => {
  let best = HOME_BASES[0]
  let bestDist = Infinity
  for (const b of HOME_BASES) {
    const d = haversineKm(lat, lng, b.lat, b.lng)
    if (d < bestDist) {
      bestDist = d
      best = b
    }
  }
  return best
}

/** Great-circle distance between two coordinates in kilometres. */
export const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// -- Taglines ----------------------------------------------------------
const TAGLINES = [
  'Adventure is closer than you think.',
  "Bored? That's a side quest waiting to happen.",
  'Every day is a quest. Go play.',
] as const

/** Today's tagline - stable within a day, different tomorrow. */
export const taglineOfTheDay = (): string => {
  const days = Math.floor(Date.now() / 86_400_000)
  return TAGLINES[days % TAGLINES.length]
}
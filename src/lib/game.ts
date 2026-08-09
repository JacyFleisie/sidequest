import {
  ALL_QUESTS,
  CATEGORY_META,
  CHAINS,
  HOME_BASES,
  PROVINCES,
  type Category,
  type Chain,
  type HomeBase,
  type ProvinceId,
  type Quest,
  type Vibe,
  VIBE_META,

  chainStats,
} from '../data/quests'

// ── Levels ───────────────────────────────────────────────────────────────────
export const xpForLevel = (n: number): number => 300 * ((n * (n - 1)) / 2)

export const levelFromXp = (xp: number): number => {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level += 1
  return level
}

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

export const RANKS: Rank[] = [
  { name: 'Rookie', emoji: '🌱', minXp: 0 },
  { name: 'Explorer', emoji: '🧭', minXp: 900 },
  { name: 'Trailblazer', emoji: '🔥', minXp: 3000 },
  { name: 'Legend of SA', emoji: '🇿🇦', minXp: 6300 },
]

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

export const totalCompleted = (p: Progress): number => p.completedIds.length + p.completedChainIds.length

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

// ── Generator ────────────────────────────────────────────────────────────────
export interface GeneratorInput {
  people: number // 1 | 2 | 4 | 8
  maxMinutes: number // 15 | 30 | 120 | 300 | 600
  budget: number // 0 | 50 | 100 | 250 | Infinity
  distanceTier: '500m' | '2km' | '5km' | '20km' | 'anywhere'
  vibe: Vibe
  base: HomeBase
  /** When the player typed a custom start place, filter by real km distance */
  customCoords?: { lat: number; lng: number; label: string }
  /** Quest ids to skip so recent suggestions don't repeat */
  exclude?: Set<string>
}

export interface GeneratedChain {
  title: string
  emoji: string
  quests: Quest[]
  durationMin: number
  cost: number
  players: [number, number]
  xp: number
}

export interface GeneratorResult {
  generated: GeneratedChain | null
  singles: Quest[]
  featured: Chain | null
  matchedCount: number
  relaxed: string[]
  nearbyLabel: string
}

const DISTANCE: Record<GeneratorInput['distanceTier'], number> = {
  '500m': 500,
  '2km': 2000,
  '5km': 5000,
  '20km': 20000,
  anywhere: Infinity,
}

const inRange = (
  quest: { region: string; lat: number; lng: number },
  base: HomeBase,
  meters: number,
  custom?: { lat: number; lng: number },
): boolean => {
  if (meters === Infinity) return true
  if (custom) return haversineKm(custom.lat, custom.lng, quest.lat, quest.lng) * 1000 <= meters
  if (quest.region === base.region) return true
  if (meters >= 20000 && base.neighbors.includes(quest.region)) return true
  return false
}

const CATEGORY_HINTS: Partial<Record<Vibe, Category[]>> = {
  food: ['food'],
  outdoors: ['adventure', 'free'],
  entertainment: ['activity', 'event'],
  chill: ['chill', 'free'],
  social: ['free', 'activity', 'chill', 'event'],
  competitive: ['activity', 'adventure'],
  romantic: ['chill', 'event'],
  funny: ['mystery', 'food'],
  chaotic: ['adventure', 'activity'],
  random: ['mystery', 'free'],
}

export const generateQuest = (input: GeneratorInput): GeneratorResult => {
  const { base, vibe, customCoords } = input
  const meters = DISTANCE[input.distanceTier]
  const relaxed: string[] = []

  let budget = input.budget
  let maxMinutes = input.maxMinutes
  let distance = meters

  const candidates = (): Quest[] =>
    ALL_QUESTS.filter(
      (x) =>
        !input.exclude?.has(x.id) &&
        x.cost <= budget &&
        x.durationMin <= maxMinutes &&
        x.players[0] <= input.people &&
        x.players[1] >= input.people &&
        inRange(x, base, distance, customCoords),
    )

  const score = (x: Quest): number => {
    let s = 0
    if (vibe === 'random' || x.vibe.includes(vibe)) s += 4
    const hints = CATEGORY_HINTS[vibe] ?? []
    if (hints.includes(x.category)) s += 2
    if (x.trending) s += 1
    // Small jitter breaks score ties so the same combo doesn't always produce
    // the same chain — the generator should feel fresh, not scripted.
    s += Math.random() * 1.6
    return s
  }

  let matches = candidates()
  let scored = matches.map((x) => ({ quest: x, score: score(x) })).sort((a, b) => b.score - a.score)

  if (scored.length < 4) {
    if (budget !== Infinity) {
      relaxed.push(`Budget bumped to "doesn't matter"`)
      budget = Infinity
      matches = candidates()
      scored = matches.map((x) => ({ quest: x, score: score(x) })).sort((a, b) => b.score - a.score)
    }
  }
  if (scored.length < 3 && distance !== Infinity) {
    relaxed.push('Distance opened up to anywhere in SA')
    distance = Infinity
    matches = candidates()
    scored = matches.map((x) => ({ quest: x, score: score(x) })).sort((a, b) => b.score - a.score)
  }
  if (scored.length < 3) {
    relaxed.push('Time limit relaxed')
    maxMinutes = Infinity
    matches = candidates()
    scored = matches.map((x) => ({ quest: x, score: score(x) })).sort((a, b) => b.score - a.score)
  }

  // Pick a diverse chain: prefer top scores, but avoid repeating categories.
  const picked: Quest[] = []
  const usedCats = new Set<Category>()
  for (const { quest } of scored) {
    if (picked.length >= 4) break
    if (usedCats.has(quest.category)) continue
    picked.push(quest)
    usedCats.add(quest.category)
  }
  // Fill remaining slots with the next best regardless of category.
  for (const { quest } of scored) {
    if (picked.length >= 4) break
    if (!picked.includes(quest)) picked.push(quest)
  }

  const vibeLabel = VIBE_META[vibe].label
  const cityName = base.label.split(' ')[0]
  const generated: GeneratedChain | null =
    picked.length >= 3
      ? {
          title: `The ${vibeLabel} ${cityName} Quest`,
          emoji: vibe === 'random' ? '🎲' : VIBE_META[vibe].emoji,
          quests: picked,
          durationMin: picked.reduce((a, x) => a + x.durationMin, 0),
          cost: picked.reduce((a, x) => a + x.cost, 0),
          players: [Math.min(...picked.map((x) => x.players[0])), Math.max(...picked.map((x) => x.players[1]))],
          xp: picked.reduce((a, x) => a + x.xp, 0) + 150,
        }
      : null

  const singles = scored.filter((x) => !picked.includes(x.quest)).map((x) => x.quest).slice(0, 6)

  const featured = CHAINS.filter(
    (c) =>
      (vibe === 'random' || c.vibe.includes(vibe)) &&
      chainStats(c).cost <= budget &&
      chainStats(c).durationMin <= maxMinutes &&
      inRange(c, base, distance, customCoords),
  ).sort((a, b) => (b.trending ? 1 : 0) - (a.trending ? 1 : 0))[0]

  return {
    generated,
    singles,
    featured: featured ?? null,
    matchedCount: scored.length,
    relaxed,
    nearbyLabel: distance === Infinity ? 'South Africa' : (customCoords?.label ?? base.label),
  }
}

// ── Misc formatting helpers ──────────────────────────────────────────────────
export const fmtDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export const fmtCost = (cost: number): string => (cost === 0 ? 'FREE' : `R${cost}`)

export const difficultyStars = (n: number): string => '⭐'.repeat(n)

export const recommendPct = (id: string): number => 86 + (hash(id) % 12) // 86–97%

const hash = (s: string): number => {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 1000
  return h
}

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

export const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

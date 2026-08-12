// ─────────────────────────────────────────────────────────────────────────────
// Live events sync — the app side of the "auto search" pipeline.
//
// A GitHub Actions cron runs scripts/fetch-events.mjs every morning and commits
// public/events-remote.json (deployed to Pages + raw.githubusercontent). This
// module fetches that feed at launch and on feed refresh, converts the rows to
// real Quest objects (with ticket links + countdowns), and merges them into the
// feed automatically. No manual searches, no paid APIs, no keys.
//
// Offline-first: the result is cached in localStorage for 12h, and the bundled
// hand-written quests always remain as the fallback floor.
// ─────────────────────────────────────────────────────────────────────────────
import { registerCustomQuests, type Quest } from '../data/quests'

// Public raw URL — no API key needed (the repo is public). Override in .env
// with VITE_EVENTS_URL to point at a fork or a local dev copy.
const EVENTS_URL =
  (import.meta.env.VITE_EVENTS_URL as string | undefined) ??
  'https://raw.githubusercontent.com/JacyFleisie/sidequest/main/public/events-remote.json'

const CACHE_KEY = 'sidequest:remote-events-v1'
const TTL_MS = 12 * 60 * 60 * 1000 // refresh at most every 12h per device

interface RemoteEventRow {
  id: string
  title: string
  emoji?: string
  category?: string
  city: string
  province: string
  provinceName?: string
  region?: string
  lat: number
  lng: number
  durationMin?: number
  cost?: number
  players?: [number, number]
  difficulty?: 1 | 2 | 3 | 4 | 5
  vibe?: string[]
  description: string
  completionLine?: string
  xp?: number
  when?: string
  startsAt?: string
  ticketInfo?: { required?: boolean; price?: string; where?: { label: string; url?: string }[]; url?: string }
  tags?: string[]
}

const PROVINCE_NAMES: Record<string, string> = {
  GP: 'Gauteng', WC: 'Western Cape', KZN: 'KwaZulu-Natal', EC: 'Eastern Cape',
  FS: 'Free State', LP: 'Limpopo', MP: 'Mpumalanga', NW: 'North West', NC: 'Northern Cape',
}

/** Shapes a remote feed row into a playable Quest. Unknown fields fall back to safe defaults. */
const rowToQuest = (r: RemoteEventRow): Quest => ({
  id: r.id,
  title: r.title,
  emoji: r.emoji ?? '🎟️',
  category: (r.category as Quest['category']) ?? 'event',
  province: (r.province as Quest['province']) ?? 'GP',
  provinceName: r.provinceName ?? PROVINCE_NAMES[r.province] ?? 'South Africa',
  city: r.city ?? 'South Africa',
  region: r.region ?? '',
  lat: r.lat,
  lng: r.lng,
  durationMin: r.durationMin ?? 150,
  cost: r.cost ?? 0,
  players: r.players ?? [1, 8],
  difficulty: r.difficulty ?? 1,
  vibe: (r.vibe as Quest['vibe']) ?? ['entertainment'],
  description: r.description,
  completionLine: r.completionLine ?? 'You were there. Legend.',
  xp: r.xp ?? 300,
  when: r.when,
  startsAt: r.startsAt,
  ticketInfo: r.ticketInfo,
  tags: r.tags ?? ['live'],
})

const readCache = (): Quest[] | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { at, events } = JSON.parse(raw) as { at: number; events: Quest[] }
    if (Date.now() - at > TTL_MS) return null
    return events
  } catch {
    return null
  }
}

const writeCache = (events: Quest[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), events }))
  } catch {
    // storage full/blocked — the feed just fetches again next launch
  }
}

/** Whole days until an ISO deadline; negative when passed. */
const daysUntil = (iso: string): number => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)

/** Fetches the live events feed (cached 12h). Never throws — returns [] offline. */
export async function fetchRemoteEvents(force = false): Promise<Quest[]> {
  const cached = readCache()
  if (cached && !force) return cached
  try {
    const res = await fetch(EVENTS_URL, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return cached ?? []
    const data = (await res.json()) as { events?: RemoteEventRow[] }
    const events = (data.events ?? [])
      .map(rowToQuest)
      // Drop events whose date has passed (1-day grace so the countdown can say "today").
      .filter((q) => !q.startsAt || daysUntil(q.startsAt) > -1)
    if (events.length > 0) writeCache(events)
    return events.length > 0 ? events : (cached ?? [])
  } catch {
    return cached ?? []
  }
}

/** Fetches + registers live events app-wide so quest sheets resolve them, then
 * tells the feed to re-render. Fire-and-forget from App boot and feed refresh. */
export async function syncRemoteEvents(force = false): Promise<Quest[]> {
  const events = await fetchRemoteEvents(force)
  if (events.length > 0) {
    registerCustomQuests(events)
    window.dispatchEvent(new CustomEvent('sidequest:remote-events'))
  }
  return events
}

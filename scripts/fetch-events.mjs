#!/usr/bin/env node
// ============================================================================
// SideQuest — live events fetcher (the "auto search" engine)
//
// Runs nightly via GitHub Actions (.github/workflows/events-fetch.yml) and can
// be run locally with `npm run fetch:events`. It pulls real, dated, ticketed
// events from free sources and writes public/events-remote.json — which the
// app fetches at launch and merges into the feed automatically.
//
// Sources (both free, no paid API):
//   1. Howler (howler.co.za)      — no key needed; scrapes the homepage's
//                                   featured events (title, venue, date, price,
//                                   ticket URL).
//   2. Ticketmaster Discovery API — optional but richer; enable it by setting
//                                   TICKETMASTER_API_KEY in .env (free key at
//                                   developer.ticketmaster.com, supports
//                                   countryCode=ZA). When unset, Howler alone
//                                   keeps the feed fresh.
//
// Only events we can place on the map (known SA venue/city) are kept — a
// wrong pin is worse than no pin. Past events are dropped. If every source
// fails, the previous events-remote.json is preserved so the feed never
// goes stale from a bad network day.
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(root, 'public', 'events-remote.json')
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36'

// ── Small SA city atlas: every city we can confidently place on the map ─────
const CITIES = {
  'johannesburg': { province: 'GP', lat: -26.2041, lng: 28.0473 },
  'sandton': { province: 'GP', lat: -26.1073, lng: 28.0556 },
  'soweto': { province: 'GP', lat: -26.2404, lng: 27.8988 },
  'braamfontein': { province: 'GP', lat: -26.1930, lng: 28.0330 },
  'midrand': { province: 'GP', lat: -25.9915, lng: 28.0872 },
  'randburg': { province: 'GP', lat: -26.1000, lng: 28.0000 },
  'centurion': { province: 'GP', lat: -25.8589, lng: 28.1900 },
  'kempton park': { province: 'GP', lat: -26.0983, lng: 28.2289 },
  'benoni': { province: 'GP', lat: -26.1884, lng: 28.3209 },
  'pretoria': { province: 'GP', lat: -25.7449, lng: 28.1876 },
  'cape town': { province: 'WC', lat: -33.9249, lng: 18.4241 },
  'stellenbosch': { province: 'WC', lat: -33.9347, lng: 18.8619 },
  'franschhoek': { province: 'WC', lat: -33.9195, lng: 19.1187 },
  'paarl': { province: 'WC', lat: -33.7286, lng: 18.9638 },
  'worcester': { province: 'WC', lat: -33.6465, lng: 19.4485 },
  'hermanus': { province: 'WC', lat: -34.4075, lng: 19.2437 },
  'oudtshoorn': { province: 'WC', lat: -33.5892, lng: 22.2020 },
  'knysna': { province: 'WC', lat: -34.0361, lng: 23.0471 },
  'george': { province: 'WC', lat: -33.9610, lng: 22.4570 },
  'mossel bay': { province: 'WC', lat: -34.1833, lng: 22.1281 },
  'durban': { province: 'KZN', lat: -29.8587, lng: 31.0218 },
  'umhlanga': { province: 'KZN', lat: -29.7251, lng: 31.0716 },
  'pietermaritzburg': { province: 'KZN', lat: -29.6006, lng: 30.3794 },
  'richards bay': { province: 'KZN', lat: -28.7805, lng: 32.0386 },
  'margate': { province: 'KZN', lat: -30.8614, lng: 30.3766 },
  'gqeberha': { province: 'EC', lat: -33.9608, lng: 25.6022 },
  'port elizabeth': { province: 'EC', lat: -33.9608, lng: 25.6022 },
  'east london': { province: 'EC', lat: -33.0153, lng: 27.9116 },
  'jeffreys bay': { province: 'EC', lat: -34.0507, lng: 24.9215 },
  'bloemfontein': { province: 'FS', lat: -29.1175, lng: 26.2166 },
  'welkom': { province: 'FS', lat: -27.9774, lng: 26.7351 },
  'polokwane': { province: 'LP', lat: -23.9040, lng: 29.4680 },
  'tzaneen': { province: 'LP', lat: -23.8290, lng: 30.1630 },
  'mbombela': { province: 'MP', lat: -25.4833, lng: 30.9833 },
  'nelspruit': { province: 'MP', lat: -25.4833, lng: 30.9833 },
  'emalahleni': { province: 'MP', lat: -25.8750, lng: 29.2160 },
  'rustenburg': { province: 'NW', lat: -25.6672, lng: 27.2421 },
  'potchefstroom': { province: 'NW', lat: -26.7156, lng: 27.0977 },
  'mahikeng': { province: 'NW', lat: -25.8527, lng: 25.6410 },
  'kimberley': { province: 'NC', lat: -28.7282, lng: 24.7499 },
  'upington': { province: 'NC', lat: -28.4508, lng: 21.2560 },
}
const PROVINCE_NAMES = { GP: 'Gauteng', WC: 'Western Cape', KZN: 'KwaZulu-Natal', EC: 'Eastern Cape', FS: 'Free State', LP: 'Limpopo', MP: 'Mpumalanga', NW: 'North West', NC: 'Northern Cape' }

// Venue hints that pin Howler events to a city (checked before fuzzy city match).
const VENUE_HINTS = [
  [/time ?out market|grand ?arena|grandwest|cticc/i, 'Cape Town'],
  [/sunbet|time ?square|sun arena/i, 'Pretoria'],
  [/fnb stadium|ellis park|market theatre|goldrush dome|gold rush dome|the forum/i, 'Johannesburg'],
  [/the villa/i, 'Durban'],
  [/killarney/i, 'Cape Town'],
  [/kyalami/i, 'Midrand'],
  [/sun city/i, 'Rustenburg'],
  [/dhl stadium/i, 'Cape Town'],
]

const placeCity = (text) => {
  if (!text) return null
  for (const [re, city] of VENUE_HINTS) if (re.test(text)) return city
  const lower = text.toLowerCase()
  for (const name of Object.keys(CITIES)) if (lower.includes(name)) return name
  return null
}
const cityInfo = (city) => {
  const name = city.toLowerCase()
  const c = CITIES[name] ?? CITIES[Object.keys(CITIES).find((k) => name.includes(k)) ?? ''] ?? null
  if (!c) return null
  return { city, ...c }
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
const iso = (d) => d.toISOString()
const whenLabel = (d) => d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)

const fmt = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 })

/** Parses a Howler date like "13 Aug 2026 SAST (+02:00)" or "14 Aug - 15 Aug SAST (+02:00)". */
const howlerDate = (raw) => {
  const s = (raw ?? '').replace(/\u200b/g, '').trim()
  const m = s.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})?/)
  if (!m) return null
  const day = Number(m[1])
  const month = MONTHS[m[2].toLowerCase()]
  const year = m[3] ? Number(m[3]) : new Date().getFullYear()
  const d = new Date(year, month - 1, day, 18, 0, 0)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Fetches the Howler homepage and extracts featured events (no key needed). */
async function fetchHowler() {
  const res = await fetch('https://www.howler.co.za/', { headers: { 'user-agent': UA } })
  if (!res.ok) throw new Error(`Howler HTTP ${res.status}`)
  const html = await res.text()
  const cards = [...html.matchAll(/<a class="upcoming-event-card[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs)]
    const grab = (body, cls) =>
    body.match(new RegExp(`${cls}\">\\s*(?:<span>)?([^<]+?)(?:</span>)?\\s*<`))?.[1]?.trim()
  const decode = (s) => (s ?? '').replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").trim()
  const events = []
  for (const card of cards) {
    const url = decode(card[1])
    const body = card[2]
    const title = decode(grab(body, '__title'))
    const venue = decode(grab(body, '__venue'))
    const dateRaw = grab(body, '__date')
    const priceRaw = body.match(/__price">.*?<strong>\s*([^<]+)</s)?.[1]?.trim()
    const start = howlerDate(dateRaw)
    if (!title || !start) continue
    events.push({ source: 'howler', title, venue: venue ?? '', start, price: priceRaw ? priceRaw.replace(/^R/, 'R') : null, url })
  }
  return events
}

/** Fetches upcoming SA events from the Ticketmaster Discovery API (needs
 * TICKETMASTER_API_KEY). Free key: developer.ticketmaster.com → create an
 * account → 'Create an app' → copy the API key. Supports countryCode=ZA. */
async function fetchTicketmaster(key) {
  const params = new URLSearchParams({
    apikey: key,
    countryCode: 'ZA',
    sort: 'date,asc',
    size: '200',
    includeTBA: 'no',
    includeTBD: 'no',
  })
  const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`)
  if (!res.ok) throw new Error(`Ticketmaster HTTP ${res.status}`)
  const data = await res.json()
  const list = data?._embedded?.events ?? []
  const out = []
  for (const e of list) {
    const venue = e?._embedded?.venues?.[0]
    const startRaw = e?.dates?.start?.local ?? e?.dates?.start?.dateTime
    const start = startRaw ? new Date(startRaw) : null
    if (!start || Number.isNaN(start.getTime())) continue
    const price = e?.priceRanges?.[0]
    out.push({
      source: 'ticketmaster',
      title: e.name ?? '',
      venue: venue?.name ?? '',
      city: venue?.city?.name ?? '',
      start,
      price: price ? `R${Math.round(price.min)}` : null,
      url: e.url ?? '',
      summary: e.info ?? e.pleaseNote ?? '',
    })
  }
  return out
}

const toQuest = (ev, now) => {
  if (ev.start.getTime() < now.getTime() - 86_400_000) return null // drop past events
  const info = cityInfo(ev.city ?? placeCity(ev.venue) ?? '')
  if (!info) return null // never pin an event we can't place accurately
  const city = info.city
  const priceLabel = ev.price ? (ev.price === 'FREE' ? 'free entry' : `from ${fmt.format(Number(ev.price.replace(/[^0-9.]/g, '')))}`) : 'prices vary'
  const    seller =
    ev.source === 'howler' ? { label: 'Online at Howler', url: ev.url }
    : { label: 'Online at Ticketmaster', url: ev.url }
  return {
    id: `remote-${ev.source}-${slug(ev.title)}-${ev.start.getFullYear()}${String(ev.start.getMonth() + 1).padStart(2, '0')}${String(ev.start.getDate()).padStart(2, '0')}`,
    title: ev.title,
    emoji: '🎟️',
    category: 'event',
    city,
    province: info.province,
    provinceName: PROVINCE_NAMES[info.province],
    region: '',
    lat: info.lat,
    lng: info.lng,
    durationMin: 150,
    cost: 0,
    players: [1, 8],
    difficulty: 1,
    vibe: ['entertainment'],
    description: ev.summary?.slice(0, 240) || (ev.source === 'howler' ? `Live ticketed event at ${ev.venue || city} — check the ticket page for details.` : 'A live ticketed event in South Africa — grab your tickets on Ticketmaster.'),
    completionLine: 'You were there. Legend.',
    xp: 300,
    when: whenLabel(ev.start),
    startsAt: iso(ev.start),
    ticketInfo: {
      required: ev.price ? ev.price !== 'FREE' : true,
      price: priceLabel,
      where: [seller, { label: 'See the event page for more options' }],
    },
    tags: [ev.source, 'live', city.toLowerCase().replace(/\s+/g, '-')],
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────
const now = new Date()
const log = (...a) => console.log('[fetch-events]', ...a)

// Titles already in the bundle, so the feed never duplicates our curated events.
const bundledTitles = new Set()
for (const f of ['src/data/events.ts', 'src/data/seasonal.ts', 'src/data/hangouts.ts', 'src/data/quests.ts', 'src/data/social.ts']) {
  const p = join(root, f)
  if (!existsSync(p)) continue
  for (const m of readFileSync(p, 'utf8').matchAll(/title:\s*'([^']+)'/g)) bundledTitles.add(m[1].toLowerCase())
}

const fresh = []
const failed = []
try {
  const howler = await fetchHowler()
  log(`Howler: ${howler.length} events`)
  fresh.push(...howler)
} catch (e) {
  failed.push(`Howler (${e.message})`)
}

const tmKey = process.env.TICKETMASTER_API_KEY
if (tmKey) {
  try {
    const tm = await fetchTicketmaster(tmKey)
    log(`Ticketmaster: ${tm.length} events`)
    fresh.push(...tm)
  } catch (e) {
    failed.push(`Ticketmaster (${e.message})`)
  }
} else {
  log('Ticketmaster: skipped (set TICKETMASTER_API_KEY in .env for the richer source)')
}

const seen = new Set()
const quests = fresh
  .map((ev) => toQuest(ev, now))
  .filter(Boolean)
  .filter((q) => {
    const key = `${q.title.toLowerCase()}|${q.city.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    if (bundledTitles.has(q.title.toLowerCase())) return false
    return true
  })
  .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
  .slice(0, 30)

const payload = { generatedAt: iso(now), source: tmKey ? 'howler + ticketmaster' : 'howler', events: quests }

if (quests.length === 0 && failed.length > 0 && !existsSync(OUT)) {
  console.error('[fetch-events] no events fetched and no previous feed to fall back to')
  process.exit(1)
}

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n')
log(`${quests.length} events written to public/events-remote.json`)
if (failed.length) log(`sources failed (kept last good feed): ${failed.join(', ')}`)

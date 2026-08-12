import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ALL_QUESTS,
  CATEGORY_META,
  EVENT_TYPE_META,
  HOME_BASES,
  VIBE_META,
  registerCustomQuests,
  unregisterCustomQuest,
  type Category,
  type EventType,
  type Quest,
  type Vibe,
} from '../data/quests'
import { fetchRemoteEvents } from '../lib/eventsSync'
import { creatorTierFor, getUserLocation, haversineKm, isUpcomingEvent, questCostLabel, reverseGeocodeLabel } from '../lib/game'
import { supabase } from '../lib/supabase'
import { taglineOfTheDay } from '../lib/taglines'
import { useGame, type StartPlace } from '../lib/store'
import { usePullToRefresh } from '../lib/usePullToRefresh'
import PullHint from './PullHint'
import {
  deleteCustomQuest,
  ensureIdentity,
  fetchCustomQuests,
  reportCustomQuest,
  subscribeCustomQuests,
  type CustomQuestRow,
} from '../lib/sync'
import CreateQuest from './CreateQuest'
import LocationPicker from './LocationPicker'
import { Button, Chip, QuestStats } from './ui'

/** Shapes a DB custom-quest row into a playable anywhere-Quest. */
const rowToQuest = (r: CustomQuestRow): Quest => ({
  id: r.id,
  title: r.draft.title,
  emoji: r.draft.emoji,
  category: r.draft.category,
  province: 'GP',
  provinceName: '',
  city: 'Anywhere',
  region: '',
  lat: 0,
  lng: 0,
  durationMin: r.draft.durationMin,
  cost: r.draft.cost,
  players: r.draft.players,
  difficulty: r.draft.difficulty as 1 | 2 | 3 | 4 | 5,
  vibe: r.draft.vibe,
  description: r.draft.description,
  anywhere: true,
  completionLine: 'Quest complete. You did the thing. Legend.',
  xp: r.draft.xp,
  tags: r.draft.tags,
  ownerId: r.ownerId,
  ownerName: r.ownerName,
  ownerEmoji: r.ownerEmoji,
  hidden: r.hidden,
})

const CATEGORIES = Object.entries(CATEGORY_META) as [Category, { label: string; color: string; emoji: string }][]
const VIBES = Object.entries(VIBE_META) as [Vibe, { label: string; emoji: string }][]

const PAGE = 12

/** Whole days until an ISO date (ceils, so 1 = this time tomorrow). */
const daysUntil = (iso: string): number => {
  const ms = new Date(iso).getTime() - Date.now()
  return Math.ceil(ms / 86_400_000)
}

/** Compact countdown for seasonal quests: “Ends today / tomorrow / Sunday / in 9 days / 24 Sep”. */
const expiryLabel = (iso: string): string => {
  const d = daysUntil(iso)
  const at = new Date(iso)
  if (d === 0) return 'Ends today'
  if (d < 0) return 'Ended'
  if (d === 1) return 'Ends tomorrow'
  if (d < 7) return `Ends ${at.toLocaleDateString('en-ZA', { weekday: 'long' })}`
  if (d < 30) return `Ends in ${d} days`
  return `Ends ${at.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}`
}

/** True when a quest starts inside the Live chip's date window (null = any date). */
const inLiveRange = (q: Quest, range: [number, number] | null): boolean => {
  if (!range) return true
  if (!q.startsAt) return false
  const t = new Date(q.startsAt).getTime()
  return !Number.isNaN(t) && t >= range[0] && t < range[1]
}

export default function Generator() {
  const {
    homeBaseId,
    feedPlace,
    setFeedPlace,
    startQuest,
    customQuests: myCustomQuests,
    deleteCustomQuest: deleteLocalQuest,
  } = useGame()
  const [category, setCategory] = useState<Category | null>(null)
  const [vibe, setVibe] = useState<Vibe | null>(null)
  // Feed-location radius: null = anywhere in SA (random feed), otherwise the
  // feed only shows quests within this many km of the feed location, sorted
  // nearest-first so picking a place visibly changes what you see.
  const [radiusKm, setRadiusKm] = useState<number | null>(null)
  // Price budget: null = any price. The slider's top end adapts to the
  // priciest quest in the feed, so the range always matches what's on offer.
  const [maxCost, setMaxCost] = useState<number | null>(null)

  // Pull-to-refresh: dragging down at the very top reshuffles the feed AND
  // refetches community quests from the server (like refreshing Instagram).
  const feedRef = useRef<HTMLDivElement | null>(null)
  const [remoteQuests, setRemoteQuests] = useState<Quest[]>([])
  const [myUid, setMyUid] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  // REAL popularity for the Trending sort — review counts from the server, so
  // the feed never shows made-up numbers (the old hardcoded counts are gone).
  const [reviewCounts, setReviewCounts] = useState<Record<string, number>>({})

  // Load community quests (mine from other devices + everyone else's) and
  // subscribe so new ones appear live. Registration keeps questById() working
  // everywhere. `loadRemote` doubles as the refresh action.
  const loadRemote = useCallback(async () => {
    const uid = await ensureIdentity()
    setMyUid(uid)
    const rows = uid ? await fetchCustomQuests(uid) : []
    // The auto-discovered live events feed (festivals, markets, concerts,
    // sport — fetched nightly by the GitHub Actions scraper). Merged in so
    // pull-to-refresh also grabs the freshest events.
    const liveEvents = await fetchRemoteEvents()
    const shaped = [...rows.map(rowToQuest), ...liveEvents]
    setRemoteQuests(shaped)
    registerCustomQuests(shaped)
    // Real review tallies — powers Trending. Never throws; empty on failure.
    try {
      if (supabase) {
        const { data } = await supabase.from('quest_reviews').select('quest_id').eq('hidden', false)
        const counts: Record<string, number> = {}
        for (const r of data ?? []) counts[r.quest_id] = (counts[r.quest_id] ?? 0) + 1
        setReviewCounts(counts)
      }
    } catch {
      // trending just falls back to shuffle order
    }
  }, [])

  useEffect(() => {
    void loadRemote()
    return subscribeCustomQuests(() => {
      void loadRemote()
    })
  }, [loadRemote])

  // Locally-created quests must resolve immediately (ActiveQuest, completion…).
  useEffect(() => {
    registerCustomQuests(myCustomQuests ?? [])
  }, [myCustomQuests])
  const [trending, setTrending] = useState(false)
  const [anywhereOnly, setAnywhereOnly] = useState(false)
  const [communityOnly, setCommunityOnly] = useState(false)
  const [seasonalOnly, setSeasonalOnly] = useState(false)
  // Live = ticketed sport, concerts & comedy from the nightly auto-discovered
  // feed (the same remote- quests the map marks with pulsing LIVE pins).
  const [liveOnly, setLiveOnly] = useState(false)
  // When Live is on, a date sub-filter narrows to events starting soon:
  // any date / this weekend / this month.
  const [liveDate, setLiveDate] = useState<'any' | 'weekend' | 'month'>('any')
  // Event chips: 🎪 Festival / 🛍️ Market / 🏎️ Automotive. No chip = everything.
  const [eventChip, setEventChip] = useState<EventType | null>(null)
  // Random seed per mount, so every visit starts with a fresh (different) feed.
  const [shuffleKey, setShuffleKey] = useState(() => (Math.random() * 0xffffffff) >>> 0)
  const [shown, setShown] = useState(PAGE)

  // Every filter/location change auto-refreshes: new random order, pagination
  // reset, and a fresh pull of community quests from the server.
  const refresh = useCallback(() => {
    setShuffleKey((k) => k + 1)
    setShown(PAGE)
    void loadRemote()
  }, [loadRemote])

  const { pull, refreshing } = usePullToRefresh(feedRef, refresh)

  // The feed's location is its OWN — independent of the map's start point.
  // Defaults to the home base; picking one here pins it just for the feed.
  const base = HOME_BASES.find((b) => b.id === homeBaseId) ?? HOME_BASES[0]
  const feedLabel = feedPlace?.label ?? base.label
  const feedLat = feedPlace?.lat ?? base.lat
  const feedLng = feedPlace?.lng ?? base.lng

  const pickFeedPlace = (place: StartPlace) => {
    // Picking a new spot resets any radius so the nearest-first sort (the
    // visible "this location changed the feed" effect) shows immediately.
    setFeedPlace(place)
    setRadiusKm(null)
    refresh()
  }

  const useMyLocation = () => {
    getUserLocation(
      async (latitude, longitude) => {
        const label = await reverseGeocodeLabel(latitude, longitude)
        setFeedPlace({ label, lat: latitude, lng: longitude })
        setRadiusKm(null)
        refresh()
      },
      () => {},
    )
  }

  // Official quests + community quests (mine from this device, plus mine and
  // everyone else's from the server — platform-wide). Custom quests are
  // anywhere-quests: doable right now.
  const pool = useMemo(() => {
    const byId = new Map<string, Quest>()
    for (const q of remoteQuests) byId.set(q.id, q)
    for (const q of myCustomQuests ?? []) if (!byId.has(q.id)) byId.set(q.id, q)
    // Seasonal quests vanish from the feed once their event date passes, and
    // dated events more than a year out are hidden too (only upcoming events
    // are shown) — the countdown chip warned everyone before they disappear.
    return [...ALL_QUESTS, ...byId.values()].filter((q) => isUpcomingEvent(q))
  }, [remoteQuests, myCustomQuests])

  // Priciest quest in the feed, rounded up to the next R100 (min R500) — the
  // budget slider's top end, so it always matches the most expensive thing
  // currently on offer (including pricey live events).
  const priceMax = useMemo(() => {
    let top = 0
    for (const q of pool) top = Math.max(top, q.cost || 0)
    return Math.max(500, Math.ceil(top / 100) * 100)
  }, [pool])

  // Date window for the Live chip's sub-filter. "This weekend" = Friday 5pm
  // through Sunday (or the next weekend if we're mid-week); "This month" =
  // now through the end of the current calendar month. null = any date.
  const liveRange = useMemo((): [number, number] | null => {
    if (liveDate === 'any') return null
    const now = new Date()
    if (liveDate === 'month') {
      return [now.getTime(), new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()]
    }
    const y = now.getFullYear()
    const m = now.getMonth()
    const d = now.getDate()
    const dow = now.getDay() // 0 Sun … 6 Sat
    let fri: Date
    if (dow === 5) fri = new Date(y, m, d, 17) // today is Friday — 5pm
    else if (dow === 6) fri = new Date(y, m, d - 1, 17) // Saturday — Fri was yesterday
    else if (dow === 0) fri = new Date(y, m, d - 2, 17) // Sunday — Fri was 2 days ago
    else fri = new Date(y, m, d + (5 - dow), 17) // mid-week — next Friday
    return [fri.getTime(), new Date(fri.getFullYear(), fri.getMonth(), fri.getDate() + 3).getTime()]
  }, [liveDate])

  // Published-quest count per creator (from everything currently loaded, so
  // authors get their vanity title next to their name on the feed).
  const ownerCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const q of pool) {
      if (q.ownerId && q.ownerId !== '') counts.set(q.ownerId, (counts.get(q.ownerId) ?? 0) + 1)
    }
    return counts
  }, [pool])

  // Optional filters: tap a category, vibe or "Anywhere" and the feed shows only that.
  // The feed location (its own picker, independent of the map) becomes a real
  // filter when a radius is chosen: only quests within that many km appear.
  const filtered = useMemo(
    () =>
      pool.filter(
        (q) =>
          (!category || q.category === category) &&
          (!vibe || q.vibe.includes(vibe)) &&
          (!anywhereOnly || q.anywhere) &&
          (!communityOnly || q.ownerId !== undefined) &&
          (!seasonalOnly || q.expiresAt !== undefined) &&
          (!liveOnly || (q.id.startsWith('remote-') && inLiveRange(q, liveRange))) &&
          (!eventChip || q.eventType === eventChip) &&
          (!maxCost || q.cost <= maxCost) &&
          (!radiusKm || q.anywhere || haversineKm(feedLat, feedLng, q.lat, q.lng) <= radiusKm),
      ),
    [pool, category, vibe, anywhereOnly, communityOnly, seasonalOnly, liveOnly, liveRange, eventChip, maxCost, radiusKm, feedLat, feedLng],
  )

  const handleDelete = (q: Quest) => {
    deleteLocalQuest(q.id)
    unregisterCustomQuest(q.id)
    if (myUid && q.ownerId === myUid) void deleteCustomQuest(myUid, q.id)
  }

  // Random order by default (a feed you just scroll); "Trending" flips to
  // the quests with the most real reviews first. Shuffle re-randomises.
  // When a feed location is picked, the feed sorts nearest-first so the
  // selection visibly changes what you see — that's what makes it "work".
  const ordered = useMemo(() => {
    const list = [...filtered]
    if (trending) {
      list.sort((a, b) => (reviewCounts[b.id] ?? 0) - (reviewCounts[a.id] ?? 0))
    } else if (feedPlace && !radiusKm) {
      list.sort((a, b) => {
        // Real placed quests first (nearest to the chosen spot), anywhere
        // quests after — otherwise a wall of "Anywhere" hides the effect.
        if (a.anywhere && !b.anywhere) return 1
        if (b.anywhere && !a.anywhere) return -1
        if (a.anywhere && b.anywhere) return 0
        return haversineKm(feedLat, feedLng, a.lat, a.lng) - haversineKm(feedLat, feedLng, b.lat, b.lng)
      })
    } else {
      let seed = (shuffleKey * 2654435761) >>> 0
      const rnd = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0
        return seed / 4294967296
      }
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1))
        ;[list[i], list[j]] = [list[j], list[i]]
      }
    }
    return list
  }, [filtered, trending, shuffleKey, feedPlace, radiusKm, feedLat, feedLng])

  const visible = ordered.slice(0, shown)

  const fmtDistance = (q: Quest): string => {
    if (q.anywhere) return 'Anywhere'
    const km = haversineKm(feedLat, feedLng, q.lat, q.lng)
    if (km < 0.5) return 'right nearby'
    return km < 10 ? `${km.toFixed(1)} km away` : `${Math.round(km)} km away`
  }

  const activeLabel =
    [category ? CATEGORY_META[category].emoji + ' ' + CATEGORY_META[category].label : null, vibe ? VIBE_META[vibe].emoji + ' ' + VIBE_META[vibe].label : null, anywhereOnly ? '🌍 Anywhere' : null, communityOnly ? '🧑‍🤝‍🧑 Community' : null, seasonalOnly ? '⏳ Seasonal' : null, liveOnly ? (liveDate === 'weekend' ? '🟥 Live · this weekend' : liveDate === 'month' ? '🟥 Live · this month' : '🟥 Live') : null, eventChip ? EVENT_TYPE_META[eventChip].emoji + ' ' + EVENT_TYPE_META[eventChip].label : null, maxCost ? `💰 up to R${maxCost}` : null, radiusKm ? `📍 within ${radiusKm} km` : null, trending ? '🔥 Trending' : null]
      .filter(Boolean)
      .join(' · ') || 'All quests'

  const clearFilters = () => {
    setCategory(null)
    setVibe(null)
    setAnywhereOnly(false)
    setCommunityOnly(false)
    setSeasonalOnly(false)
    setEventChip(null)
    setTrending(false)
    setLiveDate('any')
    setMaxCost(null)
    setRadiusKm(null)
    refresh()
  }

  return (
    <div className="page feed" ref={feedRef}>
      <PullHint pull={pull} refreshing={refreshing} />
      <header className="page-head">
        <div className="page-head-row">
          <div className="page-head-main">
            <h1 className="page-title">📜 Quest Feed</h1>
            <p className="page-sub">Scroll like it's Instagram — real places, plus quests the whole community made up.</p>
          </div>
          <Button variant="gold" className="create-feed-btn" onClick={() => setCreateOpen(true)}>
            ✨ Create
          </Button>
        </div>
      </header>

      <div className="feed-start">
        <label className="field-label">📍 Feed location</label>
        <LocationPicker
          currentLabel={feedLabel}
          custom={Boolean(feedPlace)}
          onPick={pickFeedPlace}
          onUseMyLocation={useMyLocation}
          onReset={() => {
            setFeedPlace(null)
            setRadiusKm(null)
          }}
        />
        {feedPlace && (
          <div className="feed-radius-row">
            <span className="feed-radius-label">
              {radiusKm ? `📍 Near ${feedLabel} · within ${radiusKm} km` : `📍 Nearest-first from ${feedLabel}`}
            </span>
            <div className="chips-row">
              {[null, 25, 100].map((r) => (
                <Chip
                  key={r ?? 'any'}
                  label={r === null ? 'Any distance' : `≤ ${r} km`}
                  active={radiusKm === r}
                  onClick={() => {
                    setRadiusKm(r)
                    refresh()
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div className="feed-price-row">
          <div className="feed-price-head">
            <label className="field-label">💰 Budget</label>
            {maxCost !== null && (
              <button className="feed-price-reset" onClick={() => setMaxCost(null)}>
                Clear
              </button>
            )}
          </div>
          <div className="feed-price-control">
            <input
              type="range"
              className="feed-price-slider"
              min={0}
              max={priceMax}
              step={10}
              value={maxCost ?? priceMax}
              onChange={(e) => {
                const v = Number(e.target.value)
                setMaxCost(v >= priceMax ? null : v)
                setShown(PAGE)
              }}
              aria-label="Maximum price per person"
            />
            <span className="feed-price-value">
              {maxCost === null ? `Any price` : `Up to R${maxCost}`}
            </span>
          </div>
        </div>
        <div className="feed-meta">
          {ordered.length} quests · {radiusKm ? `within ${radiusKm} km of ${feedLabel}` : `from ${feedLabel}`}
        </div>
      </div>

      <div className="feed-filters">
        <div className="chips-row">
          {CATEGORIES.map(([c, meta]) => (
            <Chip
              key={c}
              label={meta.label}
              emoji={meta.emoji}
              color={meta.color}
              active={category === c}
              onClick={() => {
                setCategory(category === c ? null : c)
                setTrending(false)
                refresh()
              }}
            />
          ))}
          <Chip
            label="Anywhere"
            emoji="🌍"
            active={anywhereOnly}
            onClick={() => {
              setAnywhereOnly((v) => !v)
              refresh()
            }}
          />
          <Chip
            label="Community"
            emoji="🧑‍🤝‍🧑"
            active={communityOnly}
            onClick={() => {
              setCommunityOnly((v) => !v)
              refresh()
            }}
          />
          <Chip
            label="Seasonal"
            emoji="⏳"
            active={seasonalOnly}
            onClick={() => {
              setSeasonalOnly((v) => !v)
              refresh()
            }}
          />
          <Chip
            label="Live"
            emoji="🟥"
            active={liveOnly}
            onClick={() => {
              setLiveOnly((v) => !v)
              setLiveDate('any')
              setTrending(false)
              refresh()
            }}
          />
          {(Object.keys(EVENT_TYPE_META) as EventType[]).map((et) => (
            <Chip
              key={et}
              label={EVENT_TYPE_META[et].label}
              emoji={EVENT_TYPE_META[et].emoji}
              active={eventChip === et}
              onClick={() => {
                setEventChip(eventChip === et ? null : et)
                refresh()
              }}
            />
          ))}
          <Chip
            label="Trending"
            emoji="🔥"
            active={trending}
            onClick={() => {
              setTrending((t) => !t)
              refresh()
            }}
          />
        </div>
        {liveOnly && (
          <div className="chips-row feed-date-row">
            <span className="feed-date-label">📅 When</span>
            {(['any', 'weekend', 'month'] as const).map((d) => (
              <Chip
                key={d}
                label={d === 'any' ? 'Any date' : d === 'weekend' ? 'This weekend' : 'This month'}
                active={liveDate === d}
                onClick={() => {
                  setLiveDate(d)
                  refresh()
                }}
              />
            ))}
          </div>
        )}
        <div className="chips-row">
          {VIBES.map(([v, meta]) => (
            <Chip
              key={v}
              label={meta.label}
              emoji={meta.emoji}
              active={vibe === v}
              onClick={() => {
                setVibe(vibe === v ? null : v)
                refresh()
              }}
            />
          ))}
        </div>
      </div>

      <div className="feed-toolbar">
        <span className="feed-hint">{activeLabel}</span>
        <button className="feed-shuffle" onClick={() => setShuffleKey((k) => k + 1)} title="Randomise the order">
          🎲 Shuffle
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <p>{communityOnly && pool.filter((q) => q.ownerId !== undefined).length === 0 ? 'No community quests yet — be the first to create one!' : 'No quests match that combo — yet.'}</p>
          <p className="empty-tagline">Meanwhile: {taglineOfTheDay()}</p>
          {communityOnly && pool.filter((q) => q.ownerId !== undefined).length === 0 ? (
            <Button variant="gold" onClick={() => setCreateOpen(true)}>
              ✨ Create a quest
            </Button>
          ) : (
            <Button variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="feed-list">
          {visible.map((q) => (
            <QuestCard
              key={q.id}
              q={q}
              distance={fmtDistance(q)}
              myUid={myUid}
              creatorTitle={q.ownerId && q.ownerId !== '' ? creatorTierFor(ownerCounts.get(q.ownerId) ?? 0) : null}
              onStart={() => startQuest(q)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {shown < ordered.length && (
        <div className="feed-more">
          <Button variant="ghost" onClick={() => setShown((n) => n + PAGE)}>
            Show more ({ordered.length - shown} left)
          </Button>
        </div>
      )}

      {createOpen && <CreateQuest onClose={() => setCreateOpen(false)} />}
    </div>
  )
}

function QuestCard({
  q,
  distance,
  myUid,
  creatorTitle,
  onStart,
  onDelete,
}: {
  q: Quest
  distance: string
  myUid: string | null
  creatorTitle: { name: string; emoji: string; description: string } | null
  onStart: () => void
  onDelete: (q: Quest) => void
}) {
  const meta = CATEGORY_META[q.category]
  const [report, setReport] = useState<'idle' | 'confirm' | 'done' | 'error'>('idle')
  const isMine = q.ownerId !== undefined && (q.ownerId === myUid || q.ownerId === '')
  // A community quest made by someone else (platform-wide, not just friends).
  const isCommunity = q.ownerId !== undefined && q.ownerId !== '' && q.ownerId !== myUid

  const doReport = async () => {
    if (!myUid) return
    const res = await reportCustomQuest(myUid, q.id)
    setReport(res === 'ok' || res === 'duplicate' ? 'done' : 'error')
  }

  return (
    <article className="feed-card">
      <header className="feed-card-head">
        <span className="feed-card-avatar">{q.emoji}</span>
        <div className="feed-card-head-main">
          <h2 className="feed-card-title">
            {q.title}
            {q.trending && <span className="feed-card-trending"> 🔥</span>}
            {q.expiresAt && (
              <span
                className="feed-card-expiry"
                title={`Available until ${new Date(q.expiresAt).toLocaleString('en-ZA')}`}
              >
                ⏳ {expiryLabel(q.expiresAt)}
              </span>
            )}
          </h2>
          <p className="feed-card-sub">
            {q.anywhere ? 'Anywhere' : q.city} · {meta.label}
            {q.anywhere ? '' : ` · ${distance}`}
          </p>
          {q.eventType && (
            <p className="feed-card-event">
              <span className="event-chip">
                {EVENT_TYPE_META[q.eventType].emoji} {EVENT_TYPE_META[q.eventType].label}
              </span>
              {q.when && <span className="event-when">📅 {q.when}</span>}
              {q.ticketInfo && (
                <span className="event-tickets">
                  {q.ticketInfo.required ? '🎟️' : '🆓'} {q.ticketInfo.price ?? (q.ticketInfo.required ? 'Tickets needed' : 'Free entry')}
                </span>
              )}
            </p>
          )}
          {q.id.startsWith('remote-') && (
            <p className="feed-card-event">
              <span className="event-chip event-chip-live">🟥 Live</span>
              {q.when && <span className="event-when">📅 {q.when}</span>}
              {q.ticketInfo && (
                <span className="event-tickets">
                  {q.ticketInfo.required ? '🎟️' : '🆓'} {q.ticketInfo.price ?? (q.ticketInfo.required ? 'Tickets needed' : 'Free entry')}
                </span>
              )}
            </p>
          )}
          {isCommunity && (
            <p className="feed-card-owner">
              {q.ownerEmoji || '🧑‍🤝‍🧑'} by @{q.ownerName}
              {creatorTitle && (
                <span className="creator-chip" title={creatorTitle.description}>
                  {creatorTitle.emoji} {creatorTitle.name}
                </span>
              )}
            </p>
          )}
          {q.hidden && <p className="feed-card-hidden">🚫 Hidden by the community</p>}
        </div>
        <span className="feed-card-xp">+{q.xp} XP</span>
      </header>

      <div className="feed-card-hero" style={{ background: `linear-gradient(135deg, ${meta.color}2e, ${meta.color}0d)` }}>
        {q.emoji}
      </div>

      <div className="feed-card-body">
        <p className="feed-card-desc">{q.description}</p>
        <div className="feed-card-tags">
          {q.tags.slice(0, 4).map((t) => (
            <span key={t}>#{t.replace(/\s+/g, '')}</span>
          ))}
        </div>
      </div>

      <footer className="feed-card-actions">
        <QuestStats
          durationMin={q.durationMin}
          cost={q.cost}
          costLabel={questCostLabel(q)}
          players={q.players}
          difficulty={q.difficulty}
        />
        <div className="feed-card-btn-row">
          {isMine && (
            <button className="feed-card-del" onClick={() => onDelete(q)} title="Delete your quest">
              🗑️ Delete
            </button>
          )}
          {isCommunity && myUid && report === 'idle' && (
            <button
              className="feed-card-report"
              onClick={() => setReport('confirm')}
              title="Report this quest as inappropriate"
            >
              🚩 Report
            </button>
          )}
          <Button variant="gold" className="feed-start-btn" onClick={onStart}>
            ⚡ Start quest
          </Button>
        </div>
      </footer>

      {isCommunity && myUid && report !== 'idle' && (
        <div className="feed-card-report-bar">
          {report === 'confirm' ? (
            <>
              <span>Report this quest as inappropriate?</span>
              <button className="feed-card-report-yes" onClick={() => void doReport()}>
                Yes, report
              </button>
              <button className="feed-card-report-no" onClick={() => setReport('idle')}>
                Cancel
              </button>
            </>
          ) : report === 'done' ? (
            <span>✅ Reported — thanks for keeping the feed clean.</span>
          ) : (
            <span>⚠️ Couldn’t report — check your connection and try again.</span>
          )}
        </div>
      )}
    </article>
  )
}

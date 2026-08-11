import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ALL_QUESTS,
  CATEGORY_META,
  HOME_BASES,
  VIBE_META,
  registerCustomQuests,
  unregisterCustomQuest,
  type Category,
  type Quest,
  type Vibe,
} from '../data/quests'
import { getUserLocation, haversineKm, nearestBase, reverseGeocodeLabel } from '../lib/game'
import { taglineOfTheDay } from '../lib/taglines'
import { useGame, type StartPlace } from '../lib/store'
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
  completedCount: 0,
  ownerId: r.ownerId,
  ownerName: r.ownerName,
  ownerEmoji: r.ownerEmoji,
  hidden: r.hidden,
})

const CATEGORIES = Object.entries(CATEGORY_META) as [Category, { label: string; color: string; emoji: string }][]
const VIBES = Object.entries(VIBE_META) as [Vibe, { label: string; emoji: string }][]

const PAGE = 12
const PULL_THRESHOLD = 64
const PULL_MAX = 110

export default function Generator() {
  const {
    homeBaseId,
    setHomeBaseId,
    startPlace,
    setStartPlace,
    startQuest,
    customQuests: myCustomQuests,
    deleteCustomQuest: deleteLocalQuest,
  } = useGame()
  const [category, setCategory] = useState<Category | null>(null)
  const [vibe, setVibe] = useState<Vibe | null>(null)

  // Pull-to-refresh: dragging down at the very top of the feed reshuffles it
  // (like refreshing an Instagram feed). Touch events, non-passive so we can
  // cancel the browser's overscroll while the pull is active.
  const feedRef = useRef<HTMLDivElement | null>(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => {
    const el = feedRef.current
    if (!el) return
    let startY = 0
    let active = false
    let pulled = 0
    const inOverlay = (t: EventTarget | null) =>
      t instanceof Element && Boolean(t.closest('.sheet-overlay, .loc-popover, [role="dialog"]'))
    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || inOverlay(e.target)) return
      startY = e.touches[0].clientY
      active = true
      pulled = 0
      setPull(0)
    }
    const onMove = (e: TouchEvent) => {
      if (!active) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0) {
        pulled = 0
        setPull(0)
        return
      }
      pulled = Math.min(dy, PULL_MAX)
      setPull(pulled)
      if (pulled > 4) e.preventDefault()
    }
    const end = () => {
      if (!active) return
      active = false
      setPull(0)
      if (pulled >= PULL_THRESHOLD) {
        setRefreshing(true)
        setShuffleKey((k) => k + 1)
        window.setTimeout(() => setRefreshing(false), 700)
      }
      pulled = 0
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [remoteQuests, setRemoteQuests] = useState<Quest[]>([])
  const [myUid, setMyUid] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  // Load community quests (mine from other devices + everyone else's) and
  // subscribe so new ones appear live. Registration keeps questById() working
  // everywhere.
  useEffect(() => {
    let alive = true
    const load = async () => {
      const uid = await ensureIdentity()
      if (!alive) return
      setMyUid(uid)
      const rows = uid ? await fetchCustomQuests(uid) : []
      const shaped = rows.map(rowToQuest)
      if (!alive) return
      setRemoteQuests(shaped)
      registerCustomQuests(shaped)
    }
    void load()
    const unsub = subscribeCustomQuests(() => {
      void load()
    })
    return () => {
      alive = false
      unsub()
    }
  }, [])

  // Locally-created quests must resolve immediately (ActiveQuest, completion…).
  useEffect(() => {
    registerCustomQuests(myCustomQuests ?? [])
  }, [myCustomQuests])
  const [trending, setTrending] = useState(false)
  const [anywhereOnly, setAnywhereOnly] = useState(false)
  const [communityOnly, setCommunityOnly] = useState(false)
  // Random seed per mount, so every visit starts with a fresh (different) feed.
  const [shuffleKey, setShuffleKey] = useState(() => (Math.random() * 0xffffffff) >>> 0)
  const [shown, setShown] = useState(PAGE)

  const base = HOME_BASES.find((b) => b.id === homeBaseId) ?? HOME_BASES[0]
  const startLabel = startPlace?.label ?? base.label
  const startLat = startPlace?.lat ?? base.lat
  const startLng = startPlace?.lng ?? base.lng

  const pickStart = (place: StartPlace) => {
    setStartPlace(place)
    setHomeBaseId(nearestBase(place.lat, place.lng).id)
    setShown(PAGE)
  }

  const useMyLocation = () => {
    getUserLocation(
      async (latitude, longitude) => {
        const label = await reverseGeocodeLabel(latitude, longitude)
        const nearest = nearestBase(latitude, longitude)
        setStartPlace({ label, lat: latitude, lng: longitude })
        setHomeBaseId(nearest.id)
        setShown(PAGE)
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
    return [...ALL_QUESTS, ...byId.values()]
  }, [remoteQuests, myCustomQuests])

  // Optional filters: tap a category, vibe or "Anywhere" and the feed shows only that.
  const filtered = useMemo(
    () =>
      pool.filter(
        (q) =>
          (!category || q.category === category) &&
          (!vibe || q.vibe.includes(vibe)) &&
          (!anywhereOnly || q.anywhere) &&
          (!communityOnly || q.ownerId !== undefined),
      ),
    [pool, category, vibe, anywhereOnly, communityOnly],
  )

  const handleDelete = (q: Quest) => {
    deleteLocalQuest(q.id)
    unregisterCustomQuest(q.id)
    if (myUid && q.ownerId === myUid) void deleteCustomQuest(myUid, q.id)
  }

  // Random order by default (a feed you just scroll); "Trending" flips to
  // most-completed first. Shuffle re-randomises with a fresh seed.
  const ordered = useMemo(() => {
    const list = [...filtered]
    if (trending) {
      list.sort((a, b) => b.completedCount - a.completedCount)
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
  }, [filtered, trending, shuffleKey])

  const visible = ordered.slice(0, shown)

  const fmtDistance = (q: Quest): string => {
    if (q.anywhere) return 'Anywhere'
    const km = haversineKm(startLat, startLng, q.lat, q.lng)
    if (km < 0.5) return 'right nearby'
    return km < 10 ? `${km.toFixed(1)} km away` : `${Math.round(km)} km away`
  }

  const activeLabel =
    [category ? CATEGORY_META[category].emoji + ' ' + CATEGORY_META[category].label : null, vibe ? VIBE_META[vibe].emoji + ' ' + VIBE_META[vibe].label : null, anywhereOnly ? '🌍 Anywhere' : null, communityOnly ? '🧑‍🤝‍🧑 Community' : null, trending ? '🔥 Trending' : null]
      .filter(Boolean)
      .join(' · ') || 'All quests'

  const clearFilters = () => {
    setCategory(null)
    setVibe(null)
    setAnywhereOnly(false)
    setCommunityOnly(false)
    setTrending(false)
    setShuffleKey((k) => k + 1)
    setShown(PAGE)
  }

  return (
    <div className="page feed" ref={feedRef}>
      <div
        className={`feed-pull ${refreshing ? 'feed-pull-refreshing' : pull > 0 ? 'feed-pull-visible' : ''}`}
        style={{
          height: refreshing ? 52 : pull,
          transition: pull > 0 && !refreshing ? 'none' : 'height 0.25s ease, opacity 0.2s ease',
        }}
      >
        {refreshing ? (
          <span className="feed-pull-spin">⟳</span>
        ) : pull >= PULL_THRESHOLD ? (
          '⬆️ Release to shuffle'
        ) : (
          '⬇️ Pull to shuffle'
        )}
      </div>
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
        <label className="field-label">Starting from</label>
        <LocationPicker
          currentLabel={startLabel}
          custom={Boolean(startPlace)}
          onPick={pickStart}
          onUseMyLocation={useMyLocation}
          onReset={() => setStartPlace(null)}
        />
        <div className="feed-meta">{ordered.length} quests</div>
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
                setShuffleKey((k) => k + 1)
                setShown(PAGE)
              }}
            />
          ))}
          <Chip
            label="Anywhere"
            emoji="🌍"
            active={anywhereOnly}
            onClick={() => {
              setAnywhereOnly((v) => !v)
              setShuffleKey((k) => k + 1)
              setShown(PAGE)
            }}
          />
          <Chip
            label="Community"
            emoji="🧑‍🤝‍🧑"
            active={communityOnly}
            onClick={() => {
              setCommunityOnly((v) => !v)
              setShuffleKey((k) => k + 1)
              setShown(PAGE)
            }}
          />
          <Chip
            label="Trending"
            emoji="🔥"
            active={trending}
            onClick={() => {
              setTrending((t) => !t)
              setShown(PAGE)
            }}
          />
        </div>
        <div className="chips-row">
          {VIBES.map(([v, meta]) => (
            <Chip
              key={v}
              label={meta.label}
              emoji={meta.emoji}
              active={vibe === v}
              onClick={() => {
                setVibe(vibe === v ? null : v)
                setShuffleKey((k) => k + 1)
                setShown(PAGE)
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
  onStart,
  onDelete,
}: {
  q: Quest
  distance: string
  myUid: string | null
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
          </h2>
          <p className="feed-card-sub">
            {q.anywhere ? 'Anywhere' : q.city} · {meta.label}
            {q.anywhere ? '' : ` · ${distance}`}
          </p>
          {isCommunity && (
            <p className="feed-card-owner">
              {q.ownerEmoji || '🧑‍🤝‍🧑'} by @{q.ownerName}
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
        <QuestStats durationMin={q.durationMin} cost={q.cost} players={q.players} difficulty={q.difficulty} />
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
            ⚡ START QUEST
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

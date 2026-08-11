import { useMemo, useState } from 'react'
import { ALL_QUESTS, CATEGORY_META, HOME_BASES, VIBE_META, type Category, type Quest, type Vibe } from '../data/quests'
import { getUserLocation, haversineKm, nearestBase, reverseGeocodeLabel } from '../lib/game'
import { useGame, type StartPlace } from '../lib/store'
import LocationPicker from './LocationPicker'
import { Button, Chip, QuestStats } from './ui'

const CATEGORIES = Object.entries(CATEGORY_META) as [Category, { label: string; color: string; emoji: string }][]
const VIBES = Object.entries(VIBE_META) as [Vibe, { label: string; emoji: string }][]

const PAGE = 12

export default function Generator() {
  const { homeBaseId, setHomeBaseId, startPlace, setStartPlace, startQuest } = useGame()
  const [category, setCategory] = useState<Category | null>(null)
  const [vibe, setVibe] = useState<Vibe | null>(null)
  const [trending, setTrending] = useState(false)
  const [shuffleKey, setShuffleKey] = useState(0)
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

  // Optional filters: tap a category or vibe and the feed shows only that.
  const filtered = useMemo(
    () =>
      ALL_QUESTS.filter(
        (q) => (!category || q.category === category) && (!vibe || q.vibe.includes(vibe)),
      ),
    [category, vibe],
  )

  // Nearby first (like a feed of what you can actually do), popularity as tiebreak;
  // "Trending" flips to most-completed first. Shuffle randomises the order.
  const ordered = useMemo(() => {
    const list = [...filtered]
    // Anywhere quests have no real distance — treat them as 0 (doable right now).
    const dist = (q: Quest) => (q.anywhere ? 0 : haversineKm(startLat, startLng, q.lat, q.lng))
    if (trending) {
      list.sort((a, b) => b.completedCount - a.completedCount)
    } else {
      list.sort((a, b) => dist(a) - dist(b) || b.completedCount - a.completedCount)
    }
    if (shuffleKey > 0) {
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
  }, [filtered, trending, shuffleKey, startLat, startLng])

  const visible = ordered.slice(0, shown)

  const fmtDistance = (q: Quest): string => {
    if (q.anywhere) return 'Anywhere'
    const km = haversineKm(startLat, startLng, q.lat, q.lng)
    if (km < 0.5) return 'right nearby'
    return km < 10 ? `${km.toFixed(1)} km away` : `${Math.round(km)} km away`
  }

  const activeLabel =
    [category ? CATEGORY_META[category].emoji + ' ' + CATEGORY_META[category].label : null, vibe ? VIBE_META[vibe].emoji + ' ' + VIBE_META[vibe].label : null, trending ? '🔥 Trending' : null]
      .filter(Boolean)
      .join(' · ') || 'All quests'

  const clearFilters = () => {
    setCategory(null)
    setVibe(null)
    setTrending(false)
    setShown(PAGE)
  }

  return (
    <div className="page feed">
      <header className="page-head">
        <h1 className="page-title">🎮 Quest Feed</h1>
        <p className="page-sub">Scroll like it's Instagram — but every post is a real place to go.</p>
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
        <div className="feed-meta">
          {ordered.length} quests near {startLabel}
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
                setShown(PAGE)
              }}
            />
          ))}
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
          <p>No quests match that combo — yet.</p>
          <Button variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="feed-list">
          {visible.map((q) => (
            <QuestCard key={q.id} q={q} distance={fmtDistance(q)} onStart={() => startQuest(q)} />
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
    </div>
  )
}

function QuestCard({ q, distance, onStart }: { q: Quest; distance: string; onStart: () => void }) {
  const meta = CATEGORY_META[q.category]
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
        <Button variant="gold" className="feed-start-btn" onClick={onStart}>
          ⚡ START QUEST
        </Button>
      </footer>
    </article>
  )
}

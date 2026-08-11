import { useEffect, useMemo, useRef, useState } from 'react'
import { ALL_QUESTS, CATEGORY_META, CHAINS, type Chain, type Quest } from '../data/quests'
import { fmtCost, fmtDuration } from '../lib/game'
import { searchGazetteer, searchOsm, type GazHit } from '../data/places'

export interface PlaceHit {
  key: string
  label: string
  sub: string
  lat: number
  lng: number
  count: number
  source?: 'local' | 'osm'
}

export default function SearchBox({
  onPickQuest,
  onPickChain,
  onPickPlace,
  onClose,
}: {
  onPickQuest: (q: Quest) => void
  onPickChain: (c: Chain) => void
  onPickPlace: (p: PlaceHit) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [osmHits, setOsmHits] = useState<GazHit[]>([])
  const [osmLoading, setOsmLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const runSearch = (raw: string) => {
    setQuery(raw)
    abortRef.current?.abort()
    const q = raw.trim()
    if (q.length < 2) {
      setOsmHits([])
      setOsmLoading(false)
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setOsmLoading(true)
    searchOsm(q, controller.signal)
      .then((hits) => {
        if (!controller.signal.aborted) {
          setOsmHits(hits)
          setOsmLoading(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setOsmLoading(false)
      })
  }

  const questCities = useMemo(() => {
    const map = new Map<string, PlaceHit>()
    for (const quest of ALL_QUESTS) {
      const key = `${quest.city}|${quest.province}`
      const existing = map.get(key)
      if (existing) existing.count += 1
      else
        map.set(key, {
          key,
          label: quest.city,
          sub: quest.provinceName,
          lat: quest.lat,
          lng: quest.lng,
          count: 1,
        })
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }, [])

  const q = query.trim().toLowerCase()

  const questHits = useMemo(() => {
    if (!q) return []
    const scored: { quest: Quest; score: number }[] = []
    for (const quest of ALL_QUESTS) {
      const hay = [
        quest.title,
        quest.city,
        quest.provinceName,
        quest.description,
        ...quest.tags,
        CATEGORY_META[quest.category].label,
      ]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) continue
      let score = 0
      if (quest.title.toLowerCase().startsWith(q)) score += 5
      if (quest.title.toLowerCase().includes(q)) score += 2
      if (quest.city.toLowerCase().startsWith(q)) score += 3
      if (quest.city.toLowerCase().includes(q)) score += 1
      if (quest.tags.some((t) => t.toLowerCase().includes(q))) score += 1
      scored.push({ quest, score })
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 8).map((s) => s.quest)
  }, [q])

  const chainHits = useMemo(() => {
    if (!q) return []
    return CHAINS.filter((c) => c.title.toLowerCase().includes(q) || c.city.toLowerCase().includes(q)).slice(0, 3)
  }, [q])

  // Gazetteer places (malls, landmarks, airports, suburbs…) that aren't quest cities.
  const gazHits = useMemo(() => {
    if (!q) return []
    return searchGazetteer(q, 8).filter(
      (g) => !questCities.some((p) => p.label.toLowerCase() === g.name.toLowerCase()),
    )
  }, [q, questCities])

  // City hits derived from quests.
  const cityHits = useMemo(() => {
    if (!q) return []
    return questCities
      .filter((p) => p.label.toLowerCase().includes(q) || p.sub.toLowerCase().includes(q))
      .slice(0, 4)
  }, [q, questCities])

  // Live OpenStreetMap results for anything not found locally.
  const osmPlaces: PlaceHit[] = osmHits.map((h, i) => ({
    key: `osm-${i}-${h.name}`,
    label: h.name,
    sub: h.sub,
    lat: h.lat,
    lng: h.lng,
    count: 0,
    source: 'osm',
  }))

  // Curated local places (gazetteer + quest cities) — capped, but OSM results
  // live in their own section below so they can never be crowded out.
  const localPlaces: PlaceHit[] = [
    ...gazHits.map((g) => ({ key: `g-${g.name}`, label: g.name, sub: g.sub, lat: g.lat, lng: g.lng, count: 0, source: 'local' as const })),
    ...cityHits,
  ].slice(0, 6)

  const placeHits = [...localPlaces, ...osmPlaces]
  const hasAnyResults =
    localPlaces.length + osmPlaces.length + questHits.length + chainHits.length > 0

  const firstHit = questHits[0] ?? chainHits[0] ?? placeHits[0]

  const pickFirst = () => {
    if (!firstHit) return
    const hit = firstHit as Quest & Chain & PlaceHit
    if (hit.steps && hit.xpBonus) onPickChain(hit)
    else if (hit.durationMin) onPickQuest(hit)
    else onPickPlace(hit)
  }

  return (
    <div className="search-panel">
      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') pickFirst()
            if (e.key === 'Escape') onClose()
          }}
          placeholder="Search any place, quest, food, hike…"
        />
        <button className="search-clear" onClick={onClose} aria-label="Close search">
          ✕
        </button>
      </div>

      {q === '' ? (
        <div className="search-empty">
          Type to search the whole country — try <em>“Sandton”</em>, <em>“Big Red Barn”</em>, <em>“kota”</em> or{' '}
          <em>“waterfall”</em>.
        </div>
      ) : (
        <div className="search-results">
          {localPlaces.length > 0 && (
            <section className="search-section">
              <h3 className="search-section-title">📍 Places</h3>
              {localPlaces.map((p) => (
                <button key={p.key} className="search-result" onClick={() => onPickPlace(p)}>
                  <span className="search-result-emoji">📍</span>
                  <span className="search-result-main">
                    <span className="search-result-title">{p.label}</span>
                    <span className="search-result-sub">
                      {p.count > 0 ? `${p.sub} · ${p.count} quests here` : p.sub}
                    </span>
                  </span>
                </button>
              ))}
            </section>
          )}

          {osmPlaces.length > 0 && (
            <section className="search-section">
              <h3 className="search-section-title">🌐 On OpenStreetMap</h3>
              {osmPlaces.map((p) => (
                <button key={p.key} className="search-result" onClick={() => onPickPlace(p)}>
                  <span className="search-result-emoji">🌐</span>
                  <span className="search-result-main">
                    <span className="search-result-title">{p.label}</span>
                    <span className="search-result-sub">{p.sub}</span>
                  </span>
                </button>
              ))}
            </section>
          )}

          {questHits.length > 0 && (
            <section className="search-section">
              <h3 className="search-section-title">🎮 Quests</h3>
              {questHits.map((quest) => (
                <button key={quest.id} className="search-result" onClick={() => onPickQuest(quest)}>
                  <span className="search-result-emoji">{quest.emoji}</span>
                  <span className="search-result-main">
                    <span className="search-result-title">{quest.title}</span>
                    <span className="search-result-sub">
                      {quest.anywhere ? 'Anywhere' : quest.city} · {CATEGORY_META[quest.category].label} ·{' '}
                      {fmtDuration(quest.durationMin)} · {fmtCost(quest.cost)}
                    </span>
                  </span>
                </button>
              ))}
            </section>
          )}

          {chainHits.length > 0 && (
            <section className="search-section">
              <h3 className="search-section-title">🧩 Multi-stop quests</h3>
              {chainHits.map((c) => (
                <button key={c.id} className="search-result" onClick={() => onPickChain(c)}>
                  <span className="search-result-emoji">{c.emoji}</span>
                  <span className="search-result-main">
                    <span className="search-result-title">{c.title}</span>
                    <span className="search-result-sub">
                      {c.city} · {c.steps.length} stops
                    </span>
                  </span>
                </button>
              ))}
            </section>
          )}

          {!hasAnyResults && (
            <div className="search-empty">
              {osmLoading ? (
                'Searching the whole of South Africa…'
              ) : (
                <>
                  No matches for “{query}” yet — keep typing, and any real place on the map of South Africa should
                  appear. Try a fuller name like “Sandton City Mall”.
                </>
              )}
            </div>
          )}
          {hasAnyResults && osmLoading && osmPlaces.length === 0 && (
            <div className="loc-footer">Searching OpenStreetMap for more results…</div>
          )}
        </div>
      )}
    </div>
  )
}

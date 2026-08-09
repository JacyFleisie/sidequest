import { useEffect, useRef, useState } from 'react'
import { searchGazetteer, searchOsm, type GazHit } from '../data/places'
import type { StartPlace } from '../lib/store'

export default function LocationPicker({
  currentLabel,
  custom,
  onPick,
  onUseMyLocation,
  onReset,
  pickerLabel = 'Start',
}: {
  currentLabel: string
  custom: boolean
  onPick: (place: StartPlace) => void
  onUseMyLocation: () => void
  onReset: () => void
  pickerLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [localHits, setLocalHits] = useState<GazHit[]>([])
  const [osmHits, setOsmHits] = useState<GazHit[]>([])
  const [osmLoading, setOsmLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setLocalHits([])
      setOsmHits([])
      setTimeout(() => inputRef.current?.focus(), 30)
    }
    return () => abortRef.current?.abort()
  }, [open])

  const runSearch = (raw: string) => {
    const q = raw.trim()
    setQuery(raw)
    abortRef.current?.abort()
    setLocalHits(searchGazetteer(q, 6))

    if (q.length < 3) {
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

  const pick = (hit: GazHit) => {
    onPick({ label: hit.name, lat: hit.lat, lng: hit.lng })
    setOpen(false)
  }

  const allHits = [...localHits, ...osmHits.filter((o) => !localHits.some((l) => l.name === o.name))].slice(0, 10)

  return (
    <div className="loc-picker">
      <button className="base-picker" onClick={() => setOpen((o) => !o)}>
        <span className="base-picker-label">📍 {pickerLabel}: {currentLabel}</span>
        <span className="base-caret">▾</span>
      </button>

      {open && (
        <div className="loc-popover">
          <div className="loc-search-bar">
            <span className="search-icon">🔍</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => runSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && allHits[0]) pick(allHits[0])
                if (e.key === 'Escape') setOpen(false)
              }}
              placeholder="Type a place — e.g. Midrand, AIE, UCT…"
            />
          </div>

          <div className="loc-actions">
            <button className="loc-action" onClick={() => { onUseMyLocation(); setOpen(false) }}>
              📡 Use my location
            </button>
            {custom && (
              <button className="loc-action" onClick={() => { onReset(); setOpen(false) }}>
                ↺ Back to {currentLabel}
              </button>
            )}
          </div>

          {query.trim() === '' ? (
            <div className="loc-empty">Try <em>“Midrand”</em>, <em>“St Lucia”</em>, <em>“UCT”</em> or an airport code.</div>
          ) : (
            <div className="loc-results">
              {allHits.map((h, i) => (
                <button key={`${h.source}-${h.name}-${i}`} className="loc-result" onClick={() => pick(h)}>
                  <span className="loc-result-emoji">{h.source === 'osm' ? '🌐' : '📍'}</span>
                  <span className="loc-result-main">
                    <span className="loc-result-name">{h.name}</span>
                    <span className="loc-result-sub">{h.sub}</span>
                  </span>
                </button>
              ))}
              {allHits.length === 0 && (
                <div className="loc-empty">
                  {osmLoading ? 'Searching the whole of South Africa…' : `No matches for “${query}”. Try another spelling.`}
                </div>
              )}
            </div>
          )}
          {osmHits.length > 0 && <div className="loc-footer">More results from OpenStreetMap</div>}
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { ALL_QUESTS, CATEGORY_META, CHAINS, HOME_BASES, registerCustomQuests, type Category, type Chain, type Quest } from '../data/quests'
import { fetchRemoteEvents } from '../lib/eventsSync'
import { categoryColor, getUserLocation, isUpcomingEvent, nearestBase, reverseGeocodeLabel } from '../lib/game'
import { useGame, type StartPlace } from '../lib/store'
import { usePullToRefresh } from '../lib/usePullToRefresh'
import LocationPicker from './LocationPicker'
import PullHint from './PullHint'
import { QuestSheet } from './QuestSheet'
import SearchBox, { type PlaceHit } from './SearchBox'
import { Chip } from './ui'

type Filter = 'all' | Category | 'trending' | 'live'

const FILTERS: { id: Filter; label: string; emoji: string; color?: string }[] = [
  { id: 'all', label: 'All', emoji: '🗺️' },
  { id: 'free', label: 'Free', emoji: '🟢', color: CATEGORY_META.free.color },
  { id: 'chill', label: 'Chill', emoji: '🔵', color: CATEGORY_META.chill.color },
  { id: 'food', label: 'Food', emoji: '🟡', color: CATEGORY_META.food.color },
  { id: 'activity', label: 'Activity', emoji: '🟠', color: CATEGORY_META.activity.color },
  { id: 'adventure', label: 'Adventure', emoji: '🔴', color: CATEGORY_META.adventure.color },
  { id: 'event', label: 'Event', emoji: '🟣', color: CATEGORY_META.event.color },
  { id: 'mystery', label: 'Mystery', emoji: '⚫', color: CATEGORY_META.mystery.color },
  { id: 'live', label: 'Live', emoji: '🟥', color: '#ff4757' },
  { id: 'trending', label: 'Trending', emoji: '🔥', color: '#ff6b35' },
]

const pinHtml = (emoji: string, color: string, done: boolean, chain: boolean, live = false): string =>
  `<div class="quest-pin ${chain ? 'pin-chain' : ''} ${done ? 'pin-done' : ''} ${live ? 'pin-live' : ''}" style="--pc:${color}">${emoji}${
    done ? '<span class="pin-check">✓</span>' : ''
  }${live ? '<span class="pin-live-tag">LIVE</span>' : ''}</div>`

// Free tile providers, tried in order. CARTO's public tiles are free but rate-limit and
// drop out intermittently — if they fail we slide to the next source instead of showing a gray map.
const TILE_PROVIDERS = [
  {
    name: 'CARTO',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    name: 'CARTO light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
]

function FallbackTiles() {
  const map = useMap()
  const [providerIdx, setProviderIdx] = useState(0)
  const [dead, setDead] = useState(false)
  const idxRef = useRef(0)
  const errs = useRef(0)
  // Clamp defensively: even if a burst of tile errors ever pushes the index out of
  // range, rendering must never crash the whole map (that was the blank-screen bug).
  const provider = TILE_PROVIDERS[Math.min(providerIdx, TILE_PROVIDERS.length - 1)]

  useEffect(() => {
    idxRef.current = providerIdx
    const layer = L.tileLayer(provider.url, {
      // Only pass subdomains when the provider declares them — an explicit `undefined`
      // overrides Leaflet's default ('abc') and crashes tile creation with
      // "Cannot read properties of undefined (reading 'length')".
      ...(provider.subdomains ? { subdomains: provider.subdomains } : {}),
      maxZoom: provider.maxZoom,
      attribution: provider.attribution,
      crossOrigin: true,
    })
    const onError = () => {
      errs.current += 1
      if (errs.current >= 2) {
        errs.current = 0
        // Absolute bump: tile errors arrive in bursts (a dead server fails ~dozens of
        // tiles at once), and several queued `i => i + 1` bumps would skip past the end.
        const next = Math.min(idxRef.current + 1, TILE_PROVIDERS.length - 1)
        if (next === idxRef.current) {
          setDead(true)
        } else {
          setProviderIdx(next)
        }
      }
    }
    // Only a *successful* tile load proves the provider is alive. Leaflet fires the
    // layer 'load' event even when every tile failed, which would wipe the dead state.
    const onTileLoad = () => {
      errs.current = 0
      setDead(false)
    }
    layer.on('tileerror', onError)
    layer.on('tileload', onTileLoad)
    layer.addTo(map)
    return () => {
      layer.off('tileerror', onError)
      layer.off('tileload', onTileLoad)
      map.removeLayer(layer)
    }
  }, [map, provider])

  const retry = () => {
    errs.current = 0
    setDead(false)
    setProviderIdx(0)
  }

  return (
    <div className="tile-status">
      {providerIdx > 0 && !dead && (
        <span className="tile-note">🔄 switched to {provider.name} tiles</span>
      )}
      {dead && (
        <button className="tile-note tile-retry" onClick={retry}>
          ⚠️ Map tiles unreachable — tap to retry
        </button>
      )}
    </div>
  )
}

// Leaflet breaks when its container resizes without a window resize event (mobile URL bar,
// orientation change, WebView layout shifts) — it keeps drawing tiles at the old size, so
// the map looks half-loaded. This re-measures the map whenever the container actually changes.
function MapSizer() {
  const map = useMap()
  useEffect(() => {
    const container = map.getContainer()
    const t0 = setTimeout(() => map.invalidateSize(), 0)
    const t1 = setTimeout(() => map.invalidateSize(), 350)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => map.invalidateSize()) : null
    ro?.observe(container)
    const onOrient = () => setTimeout(() => map.invalidateSize(), 150)
    window.addEventListener('orientationchange', onOrient)
    return () => {
      clearTimeout(t0)
      clearTimeout(t1)
      ro?.disconnect()
      window.removeEventListener('orientationchange', onOrient)
    }
  }, [map])
  return null
}

function StartMarker({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    const icon = L.divIcon({
      html: '<div class="start-marker"><div class="start-ring"></div></div>',
      className: '',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    })
    const marker = L.marker([lat, lng], { icon, interactive: false, zIndexOffset: 1000 })
    marker.addTo(map)
    return () => {
      marker.remove()
    }
  }, [map, lat, lng])
  return null
}

function QuestMarkers({
  quests,
  chains,
  onSelectQuest,
  onSelectChain,
  completed,
}: {
  quests: Quest[]
  chains: Chain[]
  onSelectQuest: (q: Quest) => void
  onSelectChain: (c: Chain) => void
  completed: Record<string, unknown>
}) {
  // Auto-discovered live events (the nightly events-remote.json feed) get a
  // distinct pulsing red pin so they're easy to spot against curated quests.
  const isLive = (q: Quest): boolean => q.id.startsWith('remote-')
  const map = useMap()
  const groupRef = useRef<L.MarkerClusterGroup | null>(null)

  useEffect(() => {
    const group = L.markerClusterGroup({
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster) =>
        L.divIcon({
          html: `<div class="cluster-badge">${cluster.getChildCount()}</div>`,
          className: '',
          iconSize: [40, 40],
        }),
    })
    group.addTo(map)
    groupRef.current = group
    return () => {
      map.removeLayer(group)
    }
  }, [map])

  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    group.clearLayers()

    for (const q of quests) {
      const done = Boolean(completed[q.id])
      const live = isLive(q)
      const icon = L.divIcon({
        html: pinHtml(q.emoji, live ? '#ff4757' : categoryColor(q.category), done, false, live),
        className: '',
        iconSize: live ? [40, 40] : [38, 38],
        iconAnchor: live ? [20, 20] : [19, 19],
      })
      const marker = L.marker([q.lat, q.lng], { icon })
      marker.on('click', () => onSelectQuest(q))
      group.addLayer(marker)
    }
    for (const c of chains) {
      const icon = L.divIcon({
        html: pinHtml(c.emoji, '#ffd23f', false, true),
        className: '',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      })
      const marker = L.marker([c.lat, c.lng], { icon })
      marker.on('click', () => onSelectChain(c))
      group.addLayer(marker)
    }
  }, [quests, chains, completed, onSelectQuest, onSelectChain])

  return null
}

export default function MapScreen() {
  const { homeBaseId, setHomeBaseId, startPlace, setStartPlace, completed } = useGame()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [showCompleted, setShowCompleted] = useState(true)
  const [selected, setSelected] = useState<{ quest?: Quest; chain?: Chain } | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)
  const [liveQuests, setLiveQuests] = useState<Quest[]>([])
  const mapRef = useRef<L.Map | null>(null)

  // Pull the auto-discovered live events feed onto the map. Uses fetchRemoteEvents
  // (NOT syncRemoteEvents — that dispatches a refresh event which would loop
  // forever from this listener). App boot already registered them app-wide, so
  // opening their quest sheet works even before this resolves.
  useEffect(() => {
    let alive = true
    const load = (force: boolean) => {
      void fetchRemoteEvents(force).then((events) => {
        if (!alive) return
        // Register so opening their quest sheet resolves the quest app-wide.
        registerCustomQuests(events)
        setLiveQuests(events)
      })
    }
    load(false)
    const onRemote = () => load(true)
    window.addEventListener('sidequest:remote-events', onRemote)
    return () => {
      alive = false
      window.removeEventListener('sidequest:remote-events', onRemote)
    }
  }, [])

  // Pull-to-refresh: drag down from the top strip of the map to reload the
  // tiles (the map view is preserved so a refresh never jumps the camera).
  const pageRef = useRef<HTMLDivElement | null>(null)
  const [mapKey, setMapKey] = useState(0)
  const viewRef = useRef<{ center: [number, number]; zoom: number }>({ center: [-29.5, 24.5], zoom: 5 })
  const refresh = async () => {
    setMapKey((k) => k + 1)
    // Hold the spinner long enough to feel like a reload.
    await new Promise((r) => window.setTimeout(r, 600))
  }
  const { pull, refreshing } = usePullToRefresh(pageRef, refresh, { startYMax: 140 })

  // Remember where the camera is so a refresh remounts the map at the same spot.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const onMove = () => {
      const c = map.getCenter()
      viewRef.current = { center: [c.lat, c.lng], zoom: map.getZoom() }
    }
    map.on('moveend', onMove)
    return () => {
      map.off('moveend', onMove)
    }
  }, [mapKey])

  const base = HOME_BASES.find((b) => b.id === homeBaseId) ?? HOME_BASES[0]
  const startPos = startPlace ?? { lat: base.lat, lng: base.lng }
  const startLabel = startPlace?.label ?? base.label

  const useMyLocation = () => {
    setLocError(null)
    getUserLocation(
      async (latitude, longitude) => {
        // Reverse-geocode the GPS point (free OpenStreetMap Nominatim) so the home
        // base is your actual spot, not just the nearest of the 19 city bases.
        const label = await reverseGeocodeLabel(latitude, longitude)
        const nearest = nearestBase(latitude, longitude)
        setStartPlace({ label, lat: latitude, lng: longitude })
        setHomeBaseId(nearest.id)
        mapRef.current?.flyTo([latitude, longitude], 13, { duration: 1.4 })
      },
      setLocError,
    )
  }

  const pickStart = (place: StartPlace) => {
    setStartPlace(place)
    setHomeBaseId(nearestBase(place.lat, place.lng).id)
    mapRef.current?.flyTo([place.lat, place.lng], 12, { duration: 1.2 })
  }

  const visible = useMemo(() => {
    // Live events come from the nightly feed — real, dated, map-pinnable.
    const all = [...ALL_QUESTS, ...liveQuests]
    let quests = all.filter((q) => {
      if (q.anywhere) return false // anywhere-quests have no real location — keep them off the map
      // Only upcoming events — dated events a year out (or already past) stay hidden.
      if (!isUpcomingEvent(q)) return false
      if (filter === 'trending') return q.trending
      if (filter === 'live') return q.id.startsWith('remote-')
      if (filter !== 'all') return q.category === filter
      return true
    })
    if (!showCompleted) quests = quests.filter((q) => !completed[q.id])
    const chains = CHAINS.filter((c) => {
      if (filter === 'trending') return c.trending
      if (filter !== 'all') return false
      return true
    })
    return { quests, chains }
  }, [filter, showCompleted, completed, liveQuests])

  const flyHome = () => {
    mapRef.current?.flyTo([startPos.lat, startPos.lng], 12, { duration: 1.4 })
  }

  return (
    <div className="map-screen" ref={pageRef}>
      <PullHint pull={pull} refreshing={refreshing} overlay />
      <MapContainer
        key={mapKey}
        center={viewRef.current.center}
        zoom={viewRef.current.zoom}
        minZoom={4}
        maxZoom={17}
        zoomControl={false}
        ref={mapRef}
        className="map"
      >
        <FallbackTiles />
        <MapSizer />
        <QuestMarkers
          quests={visible.quests}
          chains={visible.chains}
          completed={completed}
          onSelectQuest={(quest) => setSelected({ quest })}
          onSelectChain={(chain) => setSelected({ chain })}
        />
        <StartMarker lat={startPos.lat} lng={startPos.lng} />
      </MapContainer>

      <div className="map-top">
        <button className="map-brand map-brand-btn" onClick={() => navigate('/')} title="Go to home">
          <div className="brand-line">
            <span className="brand-logo">📍</span> SIDEQUEST <span className="brand-flag">🇿🇦</span>
            <span className="beta-chip">BETA</span>
          </div>
          <div className="brand-tagline">Your life is the main story. South Africa is your map.</div>
        </button>
        <div className="map-top-right">
          <LocationPicker
            currentLabel={startLabel}
            custom={Boolean(startPlace)}
            onPick={pickStart}
            onUseMyLocation={useMyLocation}
            onReset={() => setStartPlace(null)}
          />
          <button className="locate-btn" onClick={() => setSearchOpen(true)} title="Search places & quests">
            🔍
          </button>
          <button className="locate-btn" onClick={flyHome} title="Fly to my start location">
            🏠
          </button>
        </div>
      </div>

      {locError && <div className="map-toast">⚠️ {locError}</div>}

      {searchOpen && (
        <SearchBox
          onPickQuest={(quest) => {
            setSelected({ quest })
            setSearchOpen(false)
            mapRef.current?.flyTo([quest.lat, quest.lng], 13, { duration: 1.2 })
          }}
          onPickChain={(chain) => {
            setSelected({ chain })
            setSearchOpen(false)
            mapRef.current?.flyTo([chain.lat, chain.lng], 12, { duration: 1.2 })
          }}
          onPickPlace={(place: PlaceHit) => {
            setSearchOpen(false)
            mapRef.current?.flyTo([place.lat, place.lng], 12, { duration: 1.2 })
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}

      <div className="map-controls">
        <div className="chips-row">
          {FILTERS.map((f) => (
            <Chip
              key={f.id}
              label={f.label}
              emoji={f.emoji}
              color={f.color}
              active={filter === f.id}
              onClick={() => setFilter(f.id)}
            />
          ))}
          <Chip
            label="Show done"
            emoji="✅"
            active={showCompleted}
            onClick={() => setShowCompleted((s) => !s)}
          />
        </div>
        <div className="map-hint">
          {visible.quests.length + visible.chains.length} quests · starting from {startLabel}
          {liveQuests.length > 0 && (
            <span className="map-hint-live" title="Auto-discovered live events (nightly feed)">
              🟥 {liveQuests.length} live
            </span>
          )}
        </div>
      </div>

      {selected && (
        <QuestSheet
          quest={selected.quest}
          chain={selected.chain}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

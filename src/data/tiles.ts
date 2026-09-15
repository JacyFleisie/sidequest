// ─────────────────────────────────────────────────────────────────────────────
// Map tile providers — the SINGLE source of truth for tile URLs.
//
// Why this lives in src/data (not MapScreen.tsx): MapScreen.tsx imports
// `leaflet`, which requires a browser `window`. Keeping the provider list here
// means the tile-fallback logic is unit-testable in vitest (node env, no DOM)
// — this is the regression guard for the "API key required watermark" bug from
// the SideQuest-Review.pdf §1 snapshot.
// ─────────────────────────────────────────────────────────────────────────────
import type { TileLayerOptions } from 'leaflet'

export interface TileProvider {
  name: string
  url: string
  subdomains?: string
  maxZoom?: number
  attribution: string
  options?: TileLayerOptions
}

/** Free tile providers, tried in order on 'tileerror'.
 *  CARTO's public tiles are free but rate-limit intermittently — if they fail
 *  we slide to the next source instead of showing a watermark or blank map.
 *  THE LAST entry is always a no-key, no-signup fallback (OSM), so the map
 *  never renders a "API key required" / provider watermark. */
export const TILE_PROVIDERS: TileProvider[] = [
  {
    name: 'CARTO',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    name: 'CARTO light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
]

/** The guaranteed no-key fallback provider (last in the list). Map tiles never
 * render a provider watermark because this always resolves to OpenStreetMap. */
export const tileProviderForError = (): TileProvider =>
  TILE_PROVIDERS[TILE_PROVIDERS.length - 1]

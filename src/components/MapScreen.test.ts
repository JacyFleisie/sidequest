import { describe, expect, it } from 'vitest'
import { TILE_PROVIDERS, tileProviderForError } from '../data/tiles'

describe('Map tile providers (review §1: no watermark)', () => {
  it('has OpenStreetMap as the final, no-key fallback provider', () => {
    const fallback = tileProviderForError()
    expect(fallback.url).toContain('tile.openstreetmap.org')
  })

  it('never references an API key in any provider URL', () => {
    for (const p of TILE_PROVIDERS) {
      expect(p.url).not.toMatch(/api[_-]?key/i)
      expect(p.url.length).toBeGreaterThan(0)
    }
  })

  it('falls back to OSM when CARTO fails (last entry is key-free)', () => {
    const last = TILE_PROVIDERS[TILE_PROVIDERS.length - 1]
    expect(last.name).toBe('OpenStreetMap')
    expect(last.subdomains).toBeUndefined()
  })
})

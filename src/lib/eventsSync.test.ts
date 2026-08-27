import { describe, expect, it } from 'vitest'
import { liveEventToQuest, mergeEventSources } from './eventsSync'
import type { Quest } from '../data/quests'

const NOW = new Date('2026-08-15T12:00:00.000Z')

/** A minimal-but-valid Quest for merge tests (merge only reads title/city/startsAt). */
const mkQuest = (title: string, city: string, startsAt: string): Quest =>
  ({
    id: 't-' + title.replace(/\s+/g, '-').toLowerCase(),
    title,
    emoji: '🎟️',
    category: 'event',
    province: 'GP',
    provinceName: 'Gauteng',
    city,
    region: '',
    lat: -26.1,
    lng: 28.05,
    durationMin: 150,
    cost: 0,
    players: [1, 8],
    difficulty: 1,
    vibe: ['entertainment'],
    description: 'test',
    completionLine: 'done',
    xp: 300,
    startsAt,
    tags: ['live'],
  }) as Quest

const tmEvent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: 'Sandton Summer Fest',
  url: 'https://www.ticketmaster.co.za/event/sandton-summer-fest',
  info: 'A full day of live music under the sun.',
  dates: { start: { local: '2026-09-12T18:00:00' } },
  priceRanges: [{ min: 250 }],
  _embedded: { venues: [{ name: 'Sandton Convention Centre', city: { name: 'Sandton' } }] },
  ...overrides,
})

describe('liveEventToQuest', () => {
  it('places a Ticketmaster event at a known city with a full quest shape', () => {
    const q = liveEventToQuest(tmEvent() as never, NOW)
    expect(q).not.toBeNull()
    expect(q!.title).toBe('Sandton Summer Fest')
    expect(q!.city).toBe('sandton')
    expect(q!.province).toBe('GP')
    expect(q!.provinceName).toBe('Gauteng')
    expect(q!.category).toBe('event')
    expect(q!.xp).toBe(300)
    expect(q!.startsAt).toBe(new Date('2026-09-12T18:00:00').toISOString()) // local-time parse → ISO
    expect(q!.ticketInfo?.price).toMatch(/^from R/)
    expect(q!.ticketInfo?.price).toContain('250')
    expect(q!.ticketInfo?.where?.[0]?.label).toBe('Online at Ticketmaster')
    expect(q!.id).toMatch(/^remote-ticketmaster-/)
  })

  it('drops events in unknown cities (a wrong pin is worse than no pin)', () => {
    const ev = tmEvent({
      name: 'Mystery Rave',
      _embedded: { venues: [{ name: 'Some Farm', city: { name: 'Nowhereville' } }] },
    })
    expect(liveEventToQuest(ev as never, NOW)).toBeNull()
  })

  it('drops events without a usable date', () => {
    const noDate = tmEvent({ dates: {} })
    expect(liveEventToQuest(noDate as never, NOW)).toBeNull()
  })

  it('drops past events', () => {
    const past = tmEvent({ dates: { start: { local: '2026-01-05T18:00:00' } } })
    expect(liveEventToQuest(past as never, NOW)).toBeNull()
  })

  it('keeps an event up to ~24h in the past (grace for feeds generated overnight)', () => {
    const yesterday = tmEvent({ dates: { start: { local: '2026-08-14T18:00:00' } } })
    expect(liveEventToQuest(yesterday as never, NOW)).not.toBeNull()
  })
})

describe('mergeEventSources', () => {
  // All fixtures are computed relative to the REAL wall clock (not the fixed
  // NOW above) because isUpcomingEvent filters against Date.now(). Using real
  // "now + N days" keeps every fixture firmly in the upcoming window regardless
  // of when the suite runs.
  const now = Date.now()
  const later = new Date(now + 40 * 864e5).toISOString()
  const sooner = new Date(now + 10 * 864e5).toISOString()
  const past = new Date(now - 30 * 864e5).toISOString()

  it('lets the live source win a title|city tie', () => {
    const snapshot = [mkQuest('Big Music Fest', 'cape town', later)]
    const live = [mkQuest('Big Music Fest', 'cape town', sooner)]
    const merged = mergeEventSources(snapshot, live)
    expect(merged).toHaveLength(1)
    expect(merged[0].startsAt).toBe(sooner) // live row kept, snapshot dropped
  })

  it('drops past events', () => {
    const merged = mergeEventSources([mkQuest('Gone Gig', 'durban', past)], [])
    expect(merged).toHaveLength(0)
  })

  it('excludes events that duplicate bundled hand-written quests', () => {
    // "Gold Reef City Thrill Run" is a real bundled quest title.
    const merged = mergeEventSources([mkQuest('Gold Reef City Thrill Run', 'johannesburg', later)], [])
    expect(merged).toHaveLength(0)
  })

  it('sorts by start date ascending', () => {
    const merged = mergeEventSources(
      [mkQuest('Z', 'johannesburg', later), mkQuest('A', 'durban', sooner)],
      [],
    )
    expect(merged.map((q) => q.title)).toEqual(['A', 'Z'])
  })

  it('caps the merged list at 30 events', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      mkQuest(`Event ${i}`, 'johannesburg', new Date(now + (i + 1) * 864e5).toISOString()),
    )
    expect(mergeEventSources(many, [])).toHaveLength(30)
  })
})

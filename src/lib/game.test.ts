import { describe, expect, it } from 'vitest'
import {
  BADGES,
  CREATOR_TIERS,
  completedCountByProvince,
  creatorTierFor,
  difficultyStars,
  fmtCost,
  fmtDuration,
  haversineKm,
  isUpcomingEvent,
  levelFromXp,
  levelProgress,
  nearestBase,
  nextCreatorTier,
  playerStats,
  questCostLabel,
  rankFromXp,
  totalCompleted,
  totalQuestsInProvince,
  xpForLevel,
  type Progress,
} from './game'
import { ALL_QUESTS, CHAINS, HOME_BASES, PROVINCES, type ProvinceId } from '../data/quests'

// ── Fixture helpers ──────────────────────────────────────────────────────────
/** An ISO timestamp with a fixed wall-clock hour (local-time safe). */
const iso = (y: number, mo: number, d: number, h = 12): string => new Date(y, mo - 1, d, h).toISOString()

interface EntrySpec {
  at?: string
  weather?: 'rain' | 'dry' | 'unknown'
  distFromHomeKm?: number
}

/** Builds a Progress from quest ids, optionally overriding per-entry metadata. */
const progressWith = (
  completedIds: string[],
  opts: {
    entries?: Record<string, EntrySpec>
    completedChainIds?: string[]
    xp?: number
    streak?: number
  } = {},
): Progress => {
  const entries: Progress['entries'] = {}
  completedIds.forEach((id, i) => {
    const spec = opts.entries?.[id] ?? {}
    entries[id] = {
      at: spec.at ?? iso(2026, 1, i + 1),
      ...(spec.weather ? { weather: spec.weather } : {}),
      ...(spec.distFromHomeKm !== undefined ? { distFromHomeKm: spec.distFromHomeKm } : {}),
    }
  })
  // Chain ids count as completions too, so include them in the entries map.
  for (const id of opts.completedChainIds ?? []) {
    if (!entries[id]) entries[id] = { at: iso(2026, 1, 1) }
  }
  return {
    completedIds,
    completedChainIds: opts.completedChainIds ?? [],
    xp: opts.xp ?? completedIds.length * 100,
    streak: opts.streak ?? 0,
    entries,
  }
}

const questIds = (pred: (q: { province: ProvinceId; category: string; anywhere?: boolean }) => boolean): string[] =>
  ALL_QUESTS.filter((q) => pred(q)).map((q) => q.id)

const provinceQuestIds = (prov: ProvinceId): string[] => questIds((q) => q.province === prov)

const categoryQuestIds = (category: string): string[] => questIds((q) => q.category === category)

const anywhereQuestIds = (): string[] => questIds((q) => q.anywhere === true)

const badge = (id: string) => {
  const b = BADGES.find((x) => x.id === id)
  expect(b, `expected a badge with id "${id}"`).toBeDefined()
  return b!
}

// ── Levels ───────────────────────────────────────────────────────────────────
describe('levels', () => {
  it('starts at level 1 with 0 XP', () => {
    expect(levelFromXp(0)).toBe(1)
  })

  it('levels up at the exact xpForLevel thresholds', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(2)).toBe(300)
    expect(levelFromXp(299)).toBe(1)
    expect(levelFromXp(300)).toBe(2)
    expect(levelFromXp(xpForLevel(5))).toBe(5)
    expect(levelFromXp(xpForLevel(5) - 1)).toBe(4)
  })

  it('reports progress into the next level', () => {
    const p = levelProgress(150)
    expect(p.level).toBe(1)
    expect(p.into).toBe(150)
    expect(p.needed).toBe(300)
    expect(p.pct).toBeCloseTo(0.5)
  })

  it('handles very large XP without looping forever', () => {
    expect(levelFromXp(10_000_000)).toBeGreaterThan(200)
  })
})

// ── Ranks ────────────────────────────────────────────────────────────────────
describe('ranks', () => {
  it('starts as Rookie', () => {
    const r = rankFromXp(0)
    expect(r.rank.name).toBe('Rookie')
    expect(r.next?.name).toBe('Explorer')
  })

  it('promotes at each rank threshold', () => {
    expect(rankFromXp(899).rank.name).toBe('Rookie')
    expect(rankFromXp(900).rank.name).toBe('Explorer')
    expect(rankFromXp(2999).rank.name).toBe('Explorer')
    expect(rankFromXp(3000).rank.name).toBe('Trailblazer')
    expect(rankFromXp(6299).rank.name).toBe('Trailblazer')
    expect(rankFromXp(6300).rank.name).toBe('Legend of SA')
  })

  it('reports progress toward the next rank', () => {
    const r = rankFromXp(450)
    expect(r.rank.name).toBe('Rookie')
    expect(r.next?.name).toBe('Explorer')
    expect(r.pct).toBeCloseTo(450 / 900)
  })

  it('has no next rank at the top', () => {
    const r = rankFromXp(6300)
    expect(r.next).toBeNull()
    expect(r.pct).toBe(1)
  })

  it('caps pct at 100%', () => {
    expect(rankFromXp(50_000).pct).toBe(1)
  })
})

// ── Badge catalog integrity ──────────────────────────────────────────────────
describe('BADGES catalog', () => {
  it('has 46 badges with unique ids (matches the README claim)', () => {
    expect(BADGES).toHaveLength(46)
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length)
  })

  it('earns nothing for an empty progress', () => {
    const earned = BADGES.filter((b) => b.earned(progressWith([])))
    expect(earned).toHaveLength(0)
  })
})

// ── Badges: counts & streaks ─────────────────────────────────────────────────
describe('BADGES — completion & streak rules', () => {
  it('first-quest / quest-machine / quest-25 / quest-50 unlock by total completions', () => {
    expect(badge('first-quest').earned(progressWith([]))).toBe(false)
    expect(badge('first-quest').earned(progressWith(['a']))).toBe(true)
    expect(badge('quest-machine').earned(progressWith(questIds(() => true).slice(0, 10)))).toBe(true)
    expect(badge('quest-machine').earned(progressWith(questIds(() => true).slice(0, 9)))).toBe(false)
    expect(badge('quest-25').earned(progressWith(questIds(() => true).slice(0, 25)))).toBe(true)
    expect(badge('quest-50').earned(progressWith(questIds(() => true).slice(0, 50)))).toBe(true)
  })

  it('streak badges unlock at 3/7/14/30 days', () => {
    expect(badge('streak-3').earned(progressWith([], { streak: 3 }))).toBe(true)
    expect(badge('streak-3').earned(progressWith([], { streak: 2 }))).toBe(false)
    expect(badge('streak-7').earned(progressWith([], { streak: 7 }))).toBe(true)
    expect(badge('streak-14').earned(progressWith([], { streak: 14 }))).toBe(true)
    expect(badge('streak-30').earned(progressWith([], { streak: 30 }))).toBe(true)
  })

  it('road-tripper / chain-master unlock by completed chains', () => {
    expect(badge('road-tripper').earned(progressWith([], { completedChainIds: ['chain-x'] }))).toBe(true)
    expect(badge('road-tripper').earned(progressWith([]))).toBe(false)
    expect(badge('chain-master').earned(progressWith([], { completedChainIds: ['chain-x', 'chain-y', 'chain-z'] }))).toBe(true)
    expect(badge('chain-master').earned(progressWith([], { completedChainIds: ['chain-x', 'chain-y'] }))).toBe(false)
  })

  it('category badges unlock at 5 completions in that category', () => {
    expect(badge('foodie').earned(progressWith(categoryQuestIds('food').slice(0, 5)))).toBe(true)
    expect(badge('foodie').earned(progressWith(categoryQuestIds('food').slice(0, 4)))).toBe(false)
    expect(badge('adrenaline').earned(progressWith(categoryQuestIds('adventure').slice(0, 5)))).toBe(true)
    expect(badge('chill-master').earned(progressWith(categoryQuestIds('chill').slice(0, 5)))).toBe(true)
    expect(badge('free-spirit').earned(progressWith(categoryQuestIds('free').slice(0, 5)))).toBe(true)
  })

  it('category-guru unlocks at 15 completions in a single category', () => {
    expect(badge('category-guru').earned(progressWith(categoryQuestIds('food').slice(0, 15)))).toBe(true)
    expect(badge('category-guru').earned(progressWith(categoryQuestIds('food').slice(0, 14)))).toBe(false)
  })

  it('anywhere badges count quests flagged as locationless', () => {
    const anywhere = anywhereQuestIds()
    expect(anywhere.length).toBeGreaterThanOrEqual(15)
    expect(badge('anywhere-5').earned(progressWith(anywhere.slice(0, 5)))).toBe(true)
    expect(badge('anywhere-15').earned(progressWith(anywhere.slice(0, 15)))).toBe(true)
    expect(badge('anywhere-15').earned(progressWith(anywhere.slice(0, 4)))).toBe(false)
  })
})

// ── Badges: provinces ────────────────────────────────────────────────────────
describe('BADGES — province rules', () => {
  it('province badges unlock at each province quota', () => {
    for (const prov of Object.values(PROVINCES)) {
      const earned = progressWith(provinceQuestIds(prov.id).slice(0, prov.badgeCount))
      expect(badge(`province-${prov.id}`).earned(earned), `${prov.id} at ${prov.badgeCount}`).toBe(true)
      expect(badge(`province-${prov.id}`).earned(progressWith(provinceQuestIds(prov.id).slice(0, prov.badgeCount - 1))), `${prov.id} under quota`).toBe(false)
    }
  })

  it('provinces-3 / provinces-6 unlock by distinct provinces visited', () => {
    const three = [provinceQuestIds('GP')[0], provinceQuestIds('WC')[0], provinceQuestIds('KZN')[0]]
    const six = [
      ...three,
      provinceQuestIds('EC')[0],
      provinceQuestIds('FS')[0],
      provinceQuestIds('LP')[0],
    ]
    expect(badge('provinces-3').earned(progressWith(three))).toBe(true)
    expect(badge('provinces-3').earned(progressWith(three.slice(0, 2)))).toBe(false)
    expect(badge('provinces-6').earned(progressWith(six))).toBe(true)
  })

  it('sa-explorer unlocks with one quest in all 9 provinces', () => {
    const all = Object.values(PROVINCES).map((p) => provinceQuestIds(p.id)[0])
    expect(all).toHaveLength(9)
    expect(badge('sa-explorer').earned(progressWith(all))).toBe(true)
    expect(badge('sa-explorer').earned(progressWith(all.slice(0, 8)))).toBe(false)
  })
})

// ── Badges: time & weather & distance ────────────────────────────────────────
describe('BADGES — time, weather and distance rules', () => {
  it('night-owl / early-bird / golden-hour unlock by completion hour', () => {
    expect(badge('night-owl').earned(progressWith(['a'], { entries: { a: { at: iso(2026, 1, 1, 22) } } }))).toBe(true)
    expect(badge('night-owl').earned(progressWith(['a'], { entries: { a: { at: iso(2026, 1, 1, 12) } } }))).toBe(false)
    expect(badge('early-bird').earned(progressWith(['a'], { entries: { a: { at: iso(2026, 1, 1, 6) } } }))).toBe(true)
    expect(badge('golden-hour').earned(progressWith(['a'], { entries: { a: { at: iso(2026, 1, 1, 18) } } }))).toBe(true)
    expect(badge('golden-hour').earned(progressWith(['a'], { entries: { a: { at: iso(2026, 1, 1, 19) } } }))).toBe(false)
  })

  it('weekend-warrior unlocks only on Saturday or Sunday', () => {
    const saturday = new Date(2026, 0, 1)
    while (saturday.getDay() !== 6) saturday.setDate(saturday.getDate() + 1)
    const weekday = new Date(2026, 0, 1)
    while (weekday.getDay() === 0 || weekday.getDay() === 6) weekday.setDate(weekday.getDate() + 1)
    expect(badge('weekend-warrior').earned(progressWith(['a'], { entries: { a: { at: saturday.toISOString() } } }))).toBe(true)
    expect(badge('weekend-warrior').earned(progressWith(['a'], { entries: { a: { at: weekday.toISOString() } } }))).toBe(false)
  })

  it('day-tripper unlocks with 3 quests in a single day', () => {
    const same = iso(2026, 1, 5)
    const p = progressWith(['a', 'b', 'c'], { entries: { a: { at: same }, b: { at: same }, c: { at: same } } })
    expect(badge('day-tripper').earned(p)).toBe(true)
    const spread = progressWith(['a', 'b', 'c'], {
      entries: { a: { at: iso(2026, 1, 5) }, b: { at: iso(2026, 1, 6) }, c: { at: iso(2026, 1, 7) } },
    })
    expect(badge('day-tripper').earned(spread)).toBe(false)
  })

  it('rain-warrior / sun-seeker unlock by recorded weather', () => {
    expect(badge('rain-warrior').earned(progressWith(['a'], { entries: { a: { weather: 'rain' } } }))).toBe(true)
    expect(badge('rain-warrior').earned(progressWith(['a'], { entries: { a: { weather: 'dry' } } }))).toBe(false)
    expect(badge('sun-seeker').earned(progressWith(['a'], { entries: { a: { weather: 'dry' } } }))).toBe(true)
  })

  it('km-10 / km-50 unlock by distance from home', () => {
    expect(badge('km-10').earned(progressWith(['a'], { entries: { a: { distFromHomeKm: 10 } } }))).toBe(true)
    expect(badge('km-10').earned(progressWith(['a'], { entries: { a: { distFromHomeKm: 9 } } }))).toBe(false)
    expect(badge('km-50').earned(progressWith(['a'], { entries: { a: { distFromHomeKm: 50 } } }))).toBe(true)
  })

  it('total-km badges sum distance across all completions', () => {
    const p = progressWith(['a', 'b'], {
      entries: { a: { distFromHomeKm: 15 }, b: { distFromHomeKm: 12 } },
    })
    expect(badge('total-km-25').earned(p)).toBe(true)
    expect(badge('total-km-100').earned(p)).toBe(false)
  })

  it('xp badges unlock by total XP', () => {
    expect(badge('xp-500').earned(progressWith(['a'], { xp: 500 }))).toBe(true)
    expect(badge('xp-500').earned(progressWith(['a'], { xp: 499 }))).toBe(false)
    expect(badge('xp-2000').earned(progressWith(['a'], { xp: 2000 }))).toBe(true)
    expect(badge('xp-4500').earned(progressWith(['a'], { xp: 4500 }))).toBe(true)
  })
})

// ── Badges: progress details ─────────────────────────────────────────────────
describe('BADGES — progress reporting', () => {
  it('first-quest progress reports done/target/earnedAt', () => {
    const p = progressWith(['a'], { entries: { a: { at: iso(2026, 1, 3) } } })
    const prog = badge('first-quest').progress!(p)
    expect(prog.done).toBe(1)
    expect(prog.target).toBe(1)
    expect(prog.earnedAt).toBe(p.entries!['a'].at)
  })

  it('a partially-earned badge reports how many remain', () => {
    const prog = badge('foodie').progress!(progressWith(categoryQuestIds('food').slice(0, 3)))
    expect(prog.done).toBe(3)
    expect(prog.target).toBe(5)
    expect(prog.earnedAt).toBeNull()
  })
})

// ── Creator tiers ────────────────────────────────────────────────────────────
describe('creator tiers', () => {
  it('earns each title at its threshold', () => {
    expect(creatorTierFor(0)).toBeNull()
    expect(creatorTierFor(1)?.name).toBe('Quest Writer')
    expect(creatorTierFor(2)?.name).toBe('Quest Writer')
    expect(creatorTierFor(3)?.name).toBe('Quest Curator')
    expect(creatorTierFor(10)?.name).toBe('Quest Master')
    expect(creatorTierFor(25)?.name).toBe('Quest Legend')
    expect(creatorTierFor(30)?.name).toBe('Quest Legend')
  })

  it('next tier is the next threshold above the count', () => {
    expect(nextCreatorTier(0)?.name).toBe('Quest Writer')
    expect(nextCreatorTier(2)?.name).toBe('Quest Curator')
    expect(nextCreatorTier(24)?.name).toBe('Quest Legend')
    expect(nextCreatorTier(25)).toBeNull()
  })

  it('tier list is ordered and starts at 1', () => {
    expect(CREATOR_TIERS[0].minQuests).toBe(1)
    for (let i = 1; i < CREATOR_TIERS.length; i++) {
      expect(CREATOR_TIERS[i].minQuests).toBeGreaterThan(CREATOR_TIERS[i - 1].minQuests)
    }
  })
})

// ── Event horizon ────────────────────────────────────────────────────────────
describe('isUpcomingEvent', () => {
  const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()

  it('undated quests are always upcoming', () => {
    expect(isUpcomingEvent({})).toBe(true)
  })

  it('hides started events that have passed', () => {
    expect(isUpcomingEvent({ startsAt: days(-1) })).toBe(false)
  })

  it('hides events beyond the ~6-month horizon', () => {
    expect(isUpcomingEvent({ startsAt: days(200) })).toBe(false)
    expect(isUpcomingEvent({ startsAt: days(30) })).toBe(true)
  })

  it('hides expired seasonal quests', () => {
    expect(isUpcomingEvent({ expiresAt: days(-1) })).toBe(false)
    expect(isUpcomingEvent({ expiresAt: days(10) })).toBe(true)
  })
})

// ── Stats ────────────────────────────────────────────────────────────────────
describe('playerStats', () => {
  const home = { lat: -26.2041, lng: 28.0473 } // Johannesburg

  it('counts quests, categories, provinces and time', () => {
    const stats = playerStats(
      {
        'gold-reef-city': { at: iso(2026, 1, 1), distFromHomeKm: 15 }, // GP adventure 180 min
        'boulders-penguins': { at: iso(2026, 1, 2), distFromHomeKm: 1300 }, // WC chill 90 min
      },
      home,
    )
    expect(stats.quests).toBe(2)
    expect(stats.byCategory.adventure).toBe(1)
    expect(stats.byCategory.chill).toBe(1)
    expect(stats.byProvince.GP).toBe(1)
    expect(stats.byProvince.WC).toBe(1)
    expect(stats.km).toBe(15 + 1300)
    expect(stats.hours).toBeCloseTo(3 + 1.5)
  })

  it('uses recorded distance when present, haversine otherwise', () => {
    const withDistance = playerStats({ 'gold-reef-city': { at: iso(2026, 1, 1), distFromHomeKm: 5 } }, home)
    expect(withDistance.km).toBe(5)
    // No recorded distance → falls back to the great-circle distance.
    const quest = ALL_QUESTS.find((q) => q.id === 'gold-reef-city')!
    const fallback = playerStats({ 'gold-reef-city': { at: iso(2026, 1, 1) } }, home)
    expect(fallback.km).toBeCloseTo(haversineKm(home.lat, home.lng, quest.lat, quest.lng), 0)
  })

  it('picks the first most-visited province as favourite', () => {
    const stats = playerStats(
      {
        'gold-reef-city': { at: iso(2026, 1, 1) }, // GP
        'boulders-penguins': { at: iso(2026, 1, 2) }, // WC
      },
      home,
    )
    expect(stats.favProvince).toBe('GP')
  })

  it('returns an empty report with no entries', () => {
    const stats = playerStats(undefined, home)
    expect(stats.quests).toBe(0)
    expect(stats.km).toBe(0)
    expect(stats.hours).toBe(0)
    expect(stats.favProvince).toBeNull()
  })
})

describe('completedCountByProvince / totalQuestsInProvince', () => {
  it('counts quest completions per province', () => {
    const p = progressWith(provinceQuestIds('GP').slice(0, 3))
    const counts = completedCountByProvince(p)
    expect(counts.GP).toBe(3)
    expect(counts.WC).toBe(0)
    for (const id of Object.keys(PROVINCES) as ProvinceId[]) {
      expect(counts[id]).toBeGreaterThanOrEqual(0)
    }
  })

  it('counts chain completions in the chain’s province', () => {
    const chain = CHAINS[0]
    const counts = completedCountByProvince({ completedIds: [], completedChainIds: [chain.id], xp: 0, streak: 0 })
    expect(counts[chain.province]).toBe(1)
  })

  it('every province has quests to complete', () => {
    for (const prov of Object.values(PROVINCES)) {
      expect(totalQuestsInProvince(prov.id), prov.id).toBeGreaterThan(0)
    }
  })
})

describe('totalCompleted', () => {
  it('sums quests and chains', () => {
    expect(totalCompleted(progressWith(['a', 'b'], { completedChainIds: ['chain-x'] }))).toBe(3)
  })
})

// ── Formatting helpers ───────────────────────────────────────────────────────
describe('formatting helpers', () => {
  it('formats durations', () => {
    expect(fmtDuration(30)).toBe('30 min')
    expect(fmtDuration(60)).toBe('1h')
    expect(fmtDuration(90)).toBe('1h 30m')
  })

  it('formats costs', () => {
    expect(fmtCost(0)).toBe('FREE')
    expect(fmtCost(250)).toBe('R250')
  })

  it('prefers the real ticket price over the flat cost', () => {
    expect(questCostLabel({ cost: 0, ticketInfo: { required: true, price: 'from R150' } })).toBe('from R150')
    expect(questCostLabel({ cost: 0, ticketInfo: { required: true } })).toBe('Tickets')
    expect(questCostLabel({ cost: 120 })).toBe('R120')
  })

  it('renders difficulty stars', () => {
    expect(difficultyStars(3)).toBe('⭐⭐⭐')
  })
})

// ── Geo helpers ──────────────────────────────────────────────────────────────
describe('geo helpers', () => {
  it('haversine returns 0 for identical points', () => {
    expect(haversineKm(-26.2041, 28.0473, -26.2041, 28.0473)).toBe(0)
  })

  it('haversine matches the Johannesburg → Cape Town great-circle distance (~1 270 km)', () => {
    const km = haversineKm(-26.2041, 28.0473, -33.9249, 18.4241)
    expect(km).toBeGreaterThan(1200)
    expect(km).toBeLessThan(1400)
  })

  it('nearestBase returns the closest city base', () => {
    const jhb = HOME_BASES.find((b) => b.id === 'jhb')!
    expect(nearestBase(jhb.lat, jhb.lng).id).toBe('jhb')
  })
})

import { describe, expect, it } from 'vitest'
import { ALL_QUESTS, CHAINS, PROVINCES, registerCustomQuests, unregisterCustomQuest } from '../data/quests'
import {
  totalQuests,
  questsInProvince,
} from './quests'

describe('canonical quest counts (single source of truth)', () => {
  it('totalQuests includes static quests + chains AND custom runtime quests', () => {
    const before = totalQuests()
    registerCustomQuests([{
      id: 'custom:test',
      title: 'Test',
      province: 'GP',
      lat: -26,
      lng: 28,
      category: 'free',
      vibe: 'chill',
      cost: 0,
      duration: 30,
      img: '',
      emoji: '🧪',
    }])
    try {
      expect(totalQuests() - before).toBe(1)
    } finally {
      unregisterCustomQuest('custom:test')
    }
  })

  it('questsInProvince matches the static definition exactly', () => {
    const staticGp =
      ALL_QUESTS.filter((q) => q.province === 'GP').length +
      CHAINS.filter((c) => c.province === 'GP').length
    expect(questsInProvince('GP')).toBe(staticGp)
  })

  it('totalQuests equals the sum of all province counts (no quest left uncounted)', () => {
    const sumByProvince = Object.keys(PROVINCES).reduce(
      (acc, id) => acc + questsInProvince(id as keyof typeof PROVINCES),
      0,
    )
    expect(totalQuests()).toBe(sumByProvince)
  })

  it('two calls to questsInProvince return identical values (stable, no session drift)', () => {
    expect(questsInProvince('GP')).toBe(questsInProvince('GP'))
  })
})

import { describe, expect, it } from 'vitest'
import { ALL_QUESTS, CHAINS, customQuests, PROVINCES, registerCustomQuests, unregisterCustomQuest } from '../data/quests'
import type { Quest, ProvinceId } from '../data/quests'
import { totalQuests, questsInProvince } from './quests'

// A minimal valid Quest for the customRegistry test.
const TEST_QUEST: Quest = {
  id: 'custom:test',
  title: 'Test Quest',
  emoji: '🧪',
  category: 'free',
  province: 'GP',
  provinceName: 'Gauteng',
  city: 'Johannesburg',
  region: 'Gauteng',
  lat: -26.2,
  lng: 28.0,
  durationMin: 30,
  cost: 0,
  players: [1, 4],
  difficulty: 1,
  vibe: ['chill'],
  description: 'A test quest.',
  tags: [],
  completionLine: 'You tested something.',
  xp: 10,
}

describe('canonical quest counts (single source of truth)', () => {
  it('totalQuests includes static quests + chains AND custom runtime quests', () => {
    const before = totalQuests()
    const beforeCustom = customQuests().length
    registerCustomQuests([TEST_QUEST])
    try {
      expect(totalQuests() - before).toBe(1)
      expect(customQuests().length - beforeCustom).toBe(1)
    } finally {
      unregisterCustomQuest('custom:test')
    }
  })

  it('questsInProvince matches the static definition exactly', () => {
    const staticGp =
      ALL_QUESTS.filter((q) => q.province === 'GP').length +
      CHAINS.filter((c) => c.province === 'GP').length
    // With no custom quests loaded, the canonical count equals the static count.
    expect(questsInProvince('GP')).toBe(staticGp)
  })

  it('totalQuests equals the sum of all province counts (no quest left uncounted)', () => {
    const sumByProvince = (Object.keys(PROVINCES) as ProvinceId[]).reduce(
      (acc, id) => acc + questsInProvince(id),
      0,
    )
    expect(totalQuests()).toBe(sumByProvince)
  })

  it('two calls to questsInProvince return identical values (stable, no session drift)', () => {
    expect(questsInProvince('GP')).toBe(questsInProvince('GP'))
  })
})

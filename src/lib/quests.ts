// ─────────────────────────────────────────────────────────────────────────────
// Canonical quest-counting — the SINGLE source of truth every screen must read.
//
// Problem it fixes (SideQuest-Review.pdf §1):
//   "Quest counts don't agree: 280, 393, 430 … Gauteng 0/145 on one profile
//    screen and 0/110 on another."
//
// Root cause: ALL_QUESTS (src/data/quests.ts) is STATIC only — it omits the
// runtime customRegistry (user-made + friends' quests, loaded at runtime via
// registerCustomQuests). Different surfaces read different sources:
//   - Profile used totalQuestsInProvince() → static only → 145
//   - Map used [...ALL_QUESTS, ...liveQuests, ...customQuests] → 110
// This module unifies that: questsInProvince() always includes custom quests,
// so every count is stable and comparable.
// ─────────────────────────────────────────────────────────────────────────────
import { ALL_QUESTS, CHAINS, customQuests, type ProvinceId } from '../data/quests'

/** Every quest the app knows about right now: official + chains + runtime custom. */
export const allQuests = (): (typeof ALL_QUESTS[number])[] => [
  ...ALL_QUESTS,
  ...CHAINS,
  ...customQuests(),
]

/** Total quests + chains available in a province — the single canonical number. */
export const questsInProvince = (province: ProvinceId): number =>
  allQuests().filter((q) => q.province === province).length

/** Total quests across all provinces. */
export const totalQuests = (): number => allQuests().length

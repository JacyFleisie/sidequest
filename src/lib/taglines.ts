// ─────────────────────────────────────────────────────────────────────────────
// Sneaky micro-copy — the alternate taglines, rotated one per day so they
// quietly change in small places (empty states, footers) without ever getting
// noisy. The main slogan stays on the Home hero; these are the whispers.
// ─────────────────────────────────────────────────────────────────────────────

export const TAGLINES = [
  'Adventure is closer than you think.',
  'Bored? That’s a side quest waiting to happen.',
  'Every day is a quest. Go play.',
] as const

/** Today's tagline — stable within a day, different tomorrow. */
export const taglineOfTheDay = (): string => {
  const days = Math.floor(Date.now() / 86_400_000)
  return TAGLINES[days % TAGLINES.length]
}

// ─────────────────────────────────────────────────────────────────────────────
// Single gate for update notices — the fix for SideQuest-Review.pdf §1:
//   "The 'SideQuest updated to v1.0.27' changelog modal stacks on top of the UI
//    across nearly every screen… A separate 'Update available' toast shows up
//    in a different set of screens, sometimes on top of the changelog modal."
//
// Previously App.tsx root-mounted BOTH <UpdateBanner/> (available) and
// <UpdatedNotice/> (just-updated), so each fired independently on every screen
// that re-rendered. This module gives each notice type a once-per-(version,
// session) flag so they never stack and never re-fire mid-session.
// ─────────────────────────────────────────────────────────────────────────────

/** In-memory session gate: which (kind, version) pairs already showed. */
const SESSION_SHOWN = new Set<string>()

export function shouldShowUpdatedNotice(version: string): boolean {
  const key = `updated:${version}`
  if (SESSION_SHOWN.has(key)) return false
  SESSION_SHOWN.add(key)
  return true
}

export function shouldShowUpdateBanner(version: string): boolean {
  const key = `banner:${version}`
  if (SESSION_SHOWN.has(key)) return false
  SESSION_SHOWN.add(key)
  return true
}

/** Exposed for tests — clears the session gate. */
export function resetUpdateGates(): void {
  SESSION_SHOWN.clear()
}

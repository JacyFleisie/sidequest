import { describe, expect, it } from 'vitest'
import { shouldShowUpdatedNotice, shouldShowUpdateBanner, resetUpdateGates } from './updates'

describe('update notice gate (review §1: no double prompt)', () => {
  it('shows each notice type once per version per session', () => {
    resetUpdateGates()
    // First call for the "just updated" notice: YES
    expect(shouldShowUpdatedNotice('1.0.27')).toBe(true)
    // Second call in the same session: NO (prevents stacking on every screen)
    expect(shouldShowUpdatedNotice('1.0.27')).toBe(false)
    // The update *available* banner is independent — it can also show once
    expect(shouldShowUpdateBanner('1.0.27')).toBe(true)
    expect(shouldShowUpdateBanner('1.0.27')).toBe(false)
  })

  it('resets when the version changes', () => {
    resetUpdateGates()
    expect(shouldShowUpdatedNotice('1.0.26')).toBe(true)
    // Different version → the "updated to 1.0.27" notice is a distinct message
    expect(shouldShowUpdatedNotice('1.0.27')).toBe(true)
  })

  it('two different versions do not cross-gate each other', () => {
    resetUpdateGates()
    expect(shouldShowUpdatedNotice('1.0.27')).toBe(true)
    expect(shouldShowUpdatedNotice('1.0.27')).toBe(false)
    // banner for a DIFFERENT version is unaffected
    expect(shouldShowUpdateBanner('1.0.28')).toBe(true)
  })
})

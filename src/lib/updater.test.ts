import { describe, expect, it } from 'vitest'
import {
  compareVersions,
  cleanReleaseNotes,
  hashMatches,
} from './updater'
import { expectedApkHash, APK_HASHES } from './apk-hashes'

describe('compareVersions', () => {
  it('orders semantic versions correctly', () => {
    expect(compareVersions('1.0.24', '1.0.23')).toBe(1)
    expect(compareVersions('1.0.23', '1.0.24')).toBe(-1)
    expect(compareVersions('1.0.24', '1.0.24')).toBe(0)
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1)
  })
  it('ignores a leading "v"', () => {
    expect(compareVersions('v1.0.24', '1.0.23')).toBe(1)
  })
})

describe('cleanReleaseNotes', () => {
  it('drops automation noise but keeps real lines', () => {
    const notes = [
      '# What\'s new',
      'Removed stale events.',
      '',
      'Generated with Codebuff',
      'Co-Authored-By: Codebuff <noreply@codebuff.com>',
      'Automated release build',
    ].join('\n')
    const lines = cleanReleaseNotes(notes)
    expect(lines).toContain('# What\'s new')
    expect(lines).toContain('Removed stale events.')
    expect(lines.some((l) => /codebuff|co-authored|automated release/i.test(l))).toBe(false)
  })
})

describe('hashMatches — APK integrity gate', () => {
  const GOOD = 'abc123'
  it('matches a correct pin case-insensitively', () => {
    expect(hashMatches('ABC123', GOOD)).toBe(true)
    expect(hashMatches('abc123', GOOD)).toBe(true)
  })
  it('rejects a mismatched hash', () => {
    expect(hashMatches('deadbeef', GOOD)).toBe(false)
  })
  it('allows an unpinned version (null/empty expected) without verification', () => {
    expect(hashMatches('whatever', null)).toBe(true)
    expect(hashMatches('whatever', '')).toBe(true)
  })
})

describe('expectedApkHash', () => {
  it('returns the pinned entry for a known release version', () => {
    const entry = expectedApkHash('1.0.24')
    expect(entry).not.toBeNull()
    expect(entry!.sha256).toBe(APK_HASHES['1.0.24'].sha256)
  })
  it('returns null for an unpinned version so the updater skips the check', () => {
    expect(expectedApkHash('9.9.9')).toBeNull()
  })
})

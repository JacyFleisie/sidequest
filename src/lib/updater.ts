// ─────────────────────────────────────────────────────────────────────────────
// Self-update — the Android app checks GitHub Releases on launch, downloads a
// newer APK when one exists, and offers to install it. The repo must stay
// public (no API key needed). The browser build can't install APKs, so it just
// records the version for the "what's new" toast.
// ─────────────────────────────────────────────────────────────────────────────
import { Capacitor, registerPlugin } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { expectedApkHash } from './apk-hashes'

// The public GitHub repo hosting SideQuest releases (the APK is attached to each
// release as an asset). Public is required so the app can check it with no API key.
export const REPO = 'JacyFleisie/sidequest'

// Keep in sync with package.json + android/app/build.gradle (the release script does it).
export const APP_VERSION = '1.0.24'

interface SideQuestUpdaterPlugin {
  downloadApk(options: { url: string; fileName?: string }): Promise<{ path: string }>
  installApk(options: { fileName?: string }): Promise<void>
  verifyApk(options: { fileName?: string; expectedSha256: string | null }): Promise<{ ok: boolean; verified: boolean; actual?: string }>
  showUpdatedNotification(options: { version: string; notes: string }): Promise<void>
}

// A test seam: the pure functions below are trivially unit-testable, but the
// native plugin calls go through this indirection so tests can stub them.
const SideQuestUpdater = registerPlugin<SideQuestUpdaterPlugin>('SideQuestUpdater')

export interface UpdateInfo {
  current: string
  latest: string
  notes: string
  downloadUrl: string
}

/** Only the Android app self-updates — the browser version refreshes itself. */
export function isAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

/** Returns >0 when a is newer than b, <0 when older, 0 when equal. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na !== nb) return na > nb ? 1 : -1
  }
  return 0
}

/** Version currently installed on the device (native) or the web build version. */
export async function getCurrentVersion(): Promise<string> {
  if (isAndroid()) {
    try {
      const info = await CapApp.getInfo()
      if (info.version) return info.version
    } catch {
      // fall through to APP_VERSION
    }
  }
  return APP_VERSION
}

// Where the app remembers the version it last ran, so it can notice "we just updated".
const LAST_SEEN_VERSION_KEY = 'sidequest-last-seen-version'

/** The version the app saw on its previous launch, or null on a fresh install. */
export function getLastSeenVersion(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_VERSION_KEY)
  } catch {
    return null
  }
}

/** Records the current version so the next launch can detect an update. */
export function rememberVersion(version: string): void {
  try {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, version)
  } catch {
    // storage unavailable — we just won't be able to detect the next update
  }
}

/**
 * Fetches the release notes for a specific version from GitHub (public repo — no key).
 * Returns null when the release or its notes don't exist. Never throws.
 */
export async function fetchReleaseNotes(version: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/v${version}`)
    if (!res.ok) return null
    const release = await res.json()
    const body = typeof release.body === 'string' ? release.body.trim() : ''
    return body || null
  } catch {
    return null
  }
}

export interface UpdatedInfo {
  version: string
  notes: string | null
}

/**
 * Detects whether the app was updated since the last launch — the Android installer
 * restarts the app on the new version, so an installed version newer than the last
 * one we saw means "we just updated". Returns null on first install or no change,
 * and always records the current version so the next launch compares against it.
 */
export async function detectJustUpdated(): Promise<UpdatedInfo | null> {
  const current = await getCurrentVersion()
  const last = getLastSeenVersion()
  if (last !== null && compareVersions(current, last) > 0) {
    const notes = await fetchReleaseNotes(current)
    rememberVersion(current)
    // Also drop a system notification in the phone's tray (fire-and-forget — the
    // in-app toast covers the celebration if the notification can't be posted).
    if (isAndroid()) {
      try {
        await SideQuestUpdater.showUpdatedNotification({ version: current, notes: notes ?? '' })
      } catch {
        // permission denied or plugin hiccup — the toast still shows
      }
    }
    return { version: current, notes }
  }
  rememberVersion(current)
  return null
}

export interface LatestReleaseInfo {
  version: string
  notes: string
  publishedAt: string | null
}

/** Fetches the latest release (any platform — used by the What's new sheet). */
export async function fetchLatestRelease(): Promise<LatestReleaseInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
    if (!res.ok) return null
    const r = (await res.json()) as { tag_name?: string; body?: string; published_at?: string }
    return {
      version: String(r.tag_name ?? '').replace(/^v/, ''),
      notes: typeof r.body === 'string' ? r.body.trim() : '',
      publishedAt: r.published_at ?? null,
    }
  } catch {
    return null
  }
}

/** Cleans raw GitHub release notes into display lines (drops automation noise). */
export function cleanReleaseNotes(notes: string): string[] {
  return notes
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !/^(generated with codebuff|co-authored-by|automated release build|release v\d)/i.test(l))
}

/**
 * Checks GitHub for the latest release. Returns update details when a newer version
 * exists, otherwise null. Never throws — a failed check just means "no update known".
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isAndroid()) return null
  const current = await getCurrentVersion()
  let release: { tag_name?: string; body?: string; assets?: { name?: string; browser_download_url?: string }[] }
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
    if (!res.ok) return null
    release = await res.json()
  } catch {
    return null
  }
  const latest = String(release.tag_name ?? '').replace(/^v/, '')
  if (!latest || compareVersions(latest, current) <= 0) return null
  const asset = (release.assets ?? []).find((a) => typeof a.name === 'string' && a.name.endsWith('.apk'))
  if (!asset?.browser_download_url) return null
  return { current, latest, notes: release.body ?? '', downloadUrl: asset.browser_download_url }
}

/** Downloads the update (natively — no CORS) and hands it to the Android installer. */
export async function downloadAndInstall(info: UpdateInfo): Promise<void> {
  await SideQuestUpdater.downloadApk({ url: info.downloadUrl, fileName: 'sidequest-update.apk' })
  // Integrity gate: never install an APK whose hash doesn't match the pinned
  // value for this version. On a mismatch the native plugin rejects, so the
  // install below never runs with a tampered/corrupted file.
  const pin = expectedApkHash(info.latest)
  await SideQuestUpdater.verifyApk({ fileName: 'sidequest-update.apk', expectedSha256: pin ? pin.sha256 : null })
  await SideQuestUpdater.installApk({ fileName: 'sidequest-update.apk' })
}

/**
 * Pure helper: compares a computed lowercase SHA-256 against the expected pin.
 * Case-insensitive, and an expected value of null/empty means "no pin — skip".
 * Kept pure so it can be unit-tested without a device or native plugin.
 */
export function hashMatches(actualSha256: string, expectedSha256: string | null | undefined): boolean {
  if (!expectedSha256) return true // unpinned version — allowed (just unverified)
  return actualSha256.trim().toLowerCase() === expectedSha256.trim().toLowerCase()
}

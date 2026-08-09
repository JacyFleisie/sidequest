// ── Share links: chains travel as URL params, no backend needed ─────────────
import { Capacitor } from '@capacitor/core'

// The public copy of the web app (GitHub Pages). Inside the installed app the origin
// is a private https://localhost, so links generated there must point here instead —
// otherwise a friend receiving a quest/card link would get a dead localhost URL.
export const SHARE_BASE = 'https://jacyfleisie.github.io/sidequest'

export const shareBase = (): string => {
  if (Capacitor.isNativePlatform()) return `${SHARE_BASE}/`
  return `${window.location.origin}${window.location.pathname.split('/').slice(0, -1).join('/')}/`
}

export interface SharedChain {
  t: string // title
  e: string // emoji
  q: string[] // quest ids in order
}

export const encodeChainShare = (title: string, emoji: string, questIds: string[]): string => {
  const json = JSON.stringify({ t: title, e: emoji, q: questIds })
  // base64url without padding — safe for URLs, handles unicode
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const decodeChainShare = (raw: string): SharedChain | null => {
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = decodeURIComponent(escape(atob(padded)))
    const data = JSON.parse(json) as SharedChain
    if (typeof data.t !== 'string' || typeof data.e !== 'string' || !Array.isArray(data.q)) return null
    if (data.q.length < 2 || data.q.length > 12) return null
    return { t: data.t.slice(0, 60), e: data.e.slice(0, 8), q: data.q.slice(0, 12).map((x) => String(x)) }
  } catch {
    return null
  }
}

export const chainShareUrl = (title: string, emoji: string, questIds: string[]): string =>
  `${shareBase()}?chain=${encodeChainShare(title, emoji, questIds)}`

export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      return true
    } catch {
      return false
    }
  }
}

export const shareViaNative = async (text: string, url: string): Promise<boolean> => {
  if (navigator.share) {
    try {
      await navigator.share({ text, url })
      return true
    } catch {
      return false // user cancelled — fall back to clipboard
    }
  }
  return false
}

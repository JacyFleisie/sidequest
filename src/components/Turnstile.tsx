import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string
          theme?: 'light' | 'dark' | 'auto'
          callback: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
        },
      ) => string
      remove: (widgetId: string) => void
    }
  }
}

/** The public Turnstile site key, baked in at build time. Empty = captcha off. */
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ?? ''
export const turnstileEnabled = Boolean(TURNSTILE_SITE_KEY)

let scriptPromise: Promise<void> | null = null
function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => resolve() // never hang — the flow will fail with a captcha error instead
    document.head.appendChild(s)
  })
  return scriptPromise
}

/**
 * Acquires a fresh Turnstile token INVISIBLY (no visible widget) for
 * background flows such as anonymous sign-in. Returns null when captcha is
 * off, the challenge failed, or it timed out. Never throws.
 */
export async function acquireTurnstileToken(): Promise<string | null> {
  if (!TURNSTILE_SITE_KEY || typeof window === 'undefined') return null
  try {
    await loadTurnstileScript()
    const turnstile = window.turnstile
    if (!turnstile) return null
    return await new Promise<string | null>((resolve) => {
      // Render off-screen so the user never sees it.
      const host = document.createElement('div')
      host.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:300px;height:65px'
      document.body.appendChild(host)
      let settled = false
      let widgetId = ''
      const finish = (token: string | null) => {
        if (settled) return
        settled = true
        resolve(token)
        try {
          if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
        } catch {
          // best effort
        }
        host.remove()
      }
      try {
        widgetId = turnstile.render(host, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          callback: (token) => finish(token),
          'expired-callback': () => finish(null),
          'error-callback': () => finish(null),
        })
      } catch {
        finish(null)
        return
      }
      window.setTimeout(() => finish(null), 15000)
    })
  } catch {
    return null
  }
}

/**
 * Cloudflare Turnstile widget for the sign-in sheet. Invisible for normal
 * users; only suspicious traffic gets a challenge. Tokens are single-use and
 * expire after 5 minutes — remount with a different `key` after each attempt.
 */
export default function Turnstile({
  onToken,
  onExpire,
}: {
  onToken: (token: string) => void
  onExpire: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<string | null>(null)
  const cbRef = useRef({ onToken, onExpire })
  cbRef.current = { onToken, onExpire }

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !hostRef.current) return

    let cancelled = false
    // A fresh container per effect run — React StrictMode double-invokes
    // effects, and Turnstile rejects rendering twice into the SAME element
    // (which previously made the second render error and clear the token).
    const host = document.createElement('div')
    hostRef.current.appendChild(host)

    const render = () => {
      if (cancelled || !window.turnstile) return
      try {
        widgetRef.current = window.turnstile.render(host, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          callback: (token) => cbRef.current.onToken(token),
          'expired-callback': () => cbRef.current.onExpire(),
          'error-callback': () => cbRef.current.onExpire(),
        })
      } catch {
        // container already has a widget (shouldn't happen with the fresh div)
      }
    }

    if (window.turnstile) {
      render()
    } else {
      void loadTurnstileScript().then(() => {
        if (!cancelled) render()
      })
    }

    return () => {
      cancelled = true
      if (widgetRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetRef.current)
        } catch {
          // widget already gone
        }
      }
      host.remove()
    }
  }, [])

  return <div ref={hostRef} className="turnstile" />
}

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

/**
 * Cloudflare Turnstile widget. Invisible for normal users; only suspicious
 * traffic gets a challenge. Tokens are single-use and expire after 5 minutes —
 * the parent should remount this (different `key`) after every attempt.
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
    const render = () => {
      if (cancelled || !window.turnstile || !hostRef.current) return
      widgetRef.current = window.turnstile.render(hostRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        callback: (token) => cbRef.current.onToken(token),
        'expired-callback': () => cbRef.current.onExpire(),
        'error-callback': () => cbRef.current.onExpire(),
      })
    }

    if (window.turnstile) {
      render()
      return
    }
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = render
    document.head.appendChild(s)

    return () => {
      cancelled = true
      if (widgetRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetRef.current)
        } catch {
          // widget already gone
        }
      }
    }
  }, [])

  return <div ref={hostRef} className="turnstile" />
}

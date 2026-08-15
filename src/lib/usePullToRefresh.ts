// ─────────────────────────────────────────────────────────────────────────────
// Pull-to-refresh gesture hook — shared by the feed, map, and friends screens.
// Tracks touch distance against PULL_THRESHOLD and calls onRefresh once when
// the gesture completes. Purely additive: returns inert values where the
// gesture isn't supported (desktop, non-touch).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, type RefObject } from 'react'

export const PULL_THRESHOLD = 64
export const PULL_MAX = 110

interface Options {
  /**
   * When set, the gesture only activates when the touch STARTS within the top
   * `startYMax` pixels of the viewport — used on the map, where a pull
   * anywhere else is the pan gesture.
   */
  startYMax?: number
}

/**
 * Pull-to-refresh, usable from any page: attach `ref` to the page's root
 * element, then drag down from the top to trigger `onRefresh`. Returns the
 * pull distance + refreshing flag for a PullHint indicator.
 *
 * Touches inside overlays/sheets/popovers never trigger it, and it no-ops
 * once the window is scrolled down (so it only grabs the very top).
 */
export function usePullToRefresh(
  ref: RefObject<HTMLElement | null>,
  onRefresh: () => void | Promise<void>,
  options: Options = {},
): { pull: number; refreshing: boolean } {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const cbRef = useRef(onRefresh)
  cbRef.current = onRefresh
  const optsRef = useRef(options)
  optsRef.current = options

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let startY = 0
    let active = false
    let pulled = 0
    const inOverlay = (t: EventTarget | null) =>
      t instanceof Element && Boolean(t.closest('.sheet-overlay, .loc-popover, [role="dialog"]'))
    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || inOverlay(e.target)) return
      const startYMax = optsRef.current.startYMax
      if (startYMax !== undefined && e.touches[0].clientY > startYMax) return
      startY = e.touches[0].clientY
      active = true
      pulled = 0
      setPull(0)
    }
    const onMove = (e: TouchEvent) => {
      if (!active) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0) {
        pulled = 0
        setPull(0)
        return
      }
      pulled = Math.min(dy, PULL_MAX)
      setPull(pulled)
      if (pulled > 4) e.preventDefault()
    }
    const end = () => {
      if (!active) return
      active = false
      setPull(0)
      if (pulled >= PULL_THRESHOLD) {
        setRefreshing(true)
        // Safety net: never leave the spinner stuck if a refresh hangs.
        const timer = window.setTimeout(() => setRefreshing(false), 2500)
        void Promise.resolve(cbRef.current()).finally(() => {
          window.clearTimeout(timer)
          setRefreshing(false)
        })
      }
      pulled = 0
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref])

  return { pull, refreshing }
}

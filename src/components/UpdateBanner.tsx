import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { checkForUpdate, downloadAndInstall, isAndroid, type UpdateInfo } from '../lib/updater'

type State =
  | { kind: 'idle' }
  | { kind: 'available'; info: UpdateInfo }
  | { kind: 'downloading' }
  | { kind: 'error'; message: string }
  | { kind: 'done' }

/** How often the app re-checks GitHub for a release while it's open. */
const CHECK_INTERVAL_MS = 15 * 60 * 1000

export default function UpdateBanner() {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const checkingRef = useRef(false)

  const runCheck = useCallback(async () => {
    if (!isAndroid() || checkingRef.current) return
    checkingRef.current = true
    try {
      const info = await checkForUpdate()
      setState((s) => {
        // Never regress a shown banner (an in-flight re-check must not blink it).
        if (info) return { kind: 'available', info }
        return s.kind === 'available' || s.kind === 'downloading' ? s : { kind: 'idle' }
      })
    } finally {
      checkingRef.current = false
    }
  }, [])

  // Check on launch, then keep checking in realtime: every 15 min, whenever the
  // app comes back to the foreground (Android resume), and on web refocus.
  useEffect(() => {
    void runCheck()
    const t = window.setInterval(() => void runCheck(), CHECK_INTERVAL_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') void runCheck()
    }
    document.addEventListener('visibilitychange', onVis)
    let resumeListener: ReturnType<typeof CapApp.addListener> | null = null
    if (Capacitor.isNativePlatform()) {
      resumeListener = CapApp.addListener('resume', () => void runCheck())
    }
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
      resumeListener?.then((l) => l.remove())
    }
  }, [runCheck])

  const install = async (info: UpdateInfo) => {
    setState({ kind: 'downloading' })
    try {
      await downloadAndInstall(info)
      // The system installer takes over; nothing more to show when we come back.
      setState({ kind: 'done' })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  if (state.kind === 'idle' || state.kind === 'done') return null

  return (
    <div className="update-banner">
      {state.kind === 'available' && (
        <>
          <span className="update-banner-text">
            ⬇️ SideQuest <b>v{state.info.latest}</b> is ready
            <span className="update-banner-sub">you're on v{state.info.current}</span>
          </span>
          <button className="update-banner-btn" onClick={() => install(state.info)}>
            Update
          </button>
        </>
      )}
      {state.kind === 'downloading' && <span className="update-banner-text">⏳ Downloading update…</span>}
      {state.kind === 'error' && (
        <>
          <span className="update-banner-text">⚠️ Update failed: {state.message}</span>
          <button className="update-banner-btn" onClick={() => void runCheck()}>
            Retry
          </button>
        </>
      )}
    </div>
  )
}

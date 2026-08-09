import { useCallback, useEffect, useState } from 'react'
import { checkForUpdate, downloadAndInstall, isAndroid, type UpdateInfo } from '../lib/updater'

type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available'; info: UpdateInfo }
  | { kind: 'downloading' }
  | { kind: 'error'; message: string }
  | { kind: 'done' }

export default function UpdateBanner() {
  const [state, setState] = useState<State>({ kind: 'idle' })

  const runCheck = useCallback(async () => {
    if (!isAndroid()) return
    setState({ kind: 'checking' })
    const info = await checkForUpdate()
    setState(info ? { kind: 'available', info } : { kind: 'idle' })
  }, [])

  useEffect(() => {
    void runCheck()
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

  if (state.kind === 'idle' || state.kind === 'checking' || state.kind === 'done') return null

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

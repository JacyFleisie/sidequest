import { useEffect, useRef, useState } from 'react'
import { detectJustUpdated, type UpdatedInfo } from '../lib/updater'

/**
 * Appears when the app was updated since its last launch (the Android installer
 * restarts the app on the new version, and detectJustUpdated notices the bump).
 * Shows a celebratory toast with the new version and optional release notes.
 */
/** Strips the worst of GitHub markdown so notes read cleanly in a small toast. */
function cleanNotes(notes: string): string {
  return notes
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim()
}

export default function UpdatedNotice() {
  const [info, setInfo] = useState<UpdatedInfo | null>(null)
  const [showNotes, setShowNotes] = useState(false)
  const checked = useRef(false)

  useEffect(() => {
    if (checked.current) return
    checked.current = true
    void detectJustUpdated().then((u) => {
      if (u) setInfo(u)
    })
  }, [])

  if (!info) return null

  return (
    <div className="updated-notice" role="status">
      <div className="updated-notice-head">
        <span className="updated-notice-text">
          🎉 SideQuest updated to <b>v{info.version}</b>!
        </span>
        <button
          className="updated-notice-close"
          onClick={() => setInfo(null)}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      {info.notes && !showNotes && (
        <button className="updated-notice-notes-btn" onClick={() => setShowNotes(true)}>
          📜 What&apos;s new
        </button>
      )}
      {info.notes && showNotes && (
        <div className="updated-notice-notes">{cleanNotes(info.notes)}</div>
      )}
    </div>
  )
}

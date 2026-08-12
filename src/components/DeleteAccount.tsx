import { useState } from 'react'
import { deleteAccount, signOutAccount } from '../lib/sync'
import { useGame } from '../lib/store'
import { Button, Sheet } from './ui'

/**
 * Permanent account deletion — POPIA right to erasure. The user must type
 * their exact username to arm the button; once confirmed, the account, all
 * server-side data and the local save are gone for good.
 */
export default function DeleteAccount({ onClose }: { onClose: () => void }) {
  const { playerName } = useGame()
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const matches = confirm.trim().toLowerCase() === playerName.trim().toLowerCase()
  const armed = matches && confirm.trim().length > 0 && !busy

  const doDelete = async () => {
    if (!armed) return
    setBusy(true)
    setError(null)
    const res = await deleteAccount()
    if (!res.ok) {
      setBusy(false)
      setError(res.error ?? 'Something went wrong — try again.')
      return
    }
    // Account + server data are gone. Clear the local save and start fresh
    // as a guest; ensureIdentity self-heals to a new anonymous identity.
    try {
      await signOutAccount()
    } catch {
      // best effort — the session may already be invalidated server-side
    }
    localStorage.removeItem('sidequest-state-v1')
    setDone(true)
    window.setTimeout(() => window.location.reload(), 700)
  }

  return (
    <Sheet onClose={onClose}>
      <div className="signin-sheet delete-sheet">
        <span className="signin-brand">SideQuest</span>
        <h2 className="signin-title">Delete your account</h2>
        {done ? (
          <p className="signin-done">✓ Your account and all your data have been deleted.</p>
        ) : (
          <>
            <p className="signin-sub">
              This permanently deletes <b>@{playerName}</b> and everything attached: XP, badges,
              stats, memories, friends, community quests and your login. This cannot be undone.
            </p>
            <label className="signin-label" htmlFor="delete-confirm">
              Type @{playerName} to confirm
            </label>
            <input
              id="delete-confirm"
              className="signin-input delete-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={`@${playerName}`}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            {matches && confirm.trim() && (
              <p className="delete-warning">
                ⚠️ This is permanent — there is no undo and no way to recover your data.
              </p>
            )}
            {error && <p className="signin-error">{error}</p>}
            <div className="delete-actions">
              <Button variant="ghost" onClick={onClose} disabled={busy} className="delete-cancel">
                Cancel
              </Button>
              <button
                className={`btn delete-confirm-btn ${armed ? 'delete-confirm-armed' : ''}`}
                onClick={() => void doDelete()}
                disabled={!armed}
              >
                {busy ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
            <p className="signin-note">Afterwards you can make a fresh account anytime.</p>
          </>
        )}
      </div>
    </Sheet>
  )
}

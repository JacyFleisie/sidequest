import { useState } from 'react'
import { signOutAccount, updatePassword } from '../lib/sync'
import { Button, Sheet } from './ui'

/** Shown when the user opens a password-reset email link (recovery session). */
export default function ResetPassword({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async () => {
    setError(null)
    if (password.length < 6) {
      setError('Password needs at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    const res = await updatePassword(password)
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Could not update the password — try again.')
      return
    }
    setDone(true)
  }

  const backToSignIn = async () => {
    await signOutAccount()
    onClose()
    window.location.reload()
  }

  return (
    <Sheet onClose={onClose}>
      <div className="signin-sheet">
        <div className="signin-brand">🗺️ SideQuest</div>
        <h2 className="signin-title">🔑 Set a new password</h2>
        <p className="signin-sub">
          {done
            ? 'Your password was updated. Sign in with your new password to continue.'
            : 'Choose a new password for your account. At least 6 characters.'}
        </p>

        {done && <div className="signin-done">✅ Password updated!</div>}

        {!done && (
          <>
            <label className="signin-label" htmlFor="sq-new-pass">New password</label>
            <input
              id="sq-new-pass"
              className="signin-input"
              type="password"
              autoComplete="new-password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />

            <label className="signin-label" htmlFor="sq-confirm-pass">Confirm password</label>
            <input
              id="sq-confirm-pass"
              className="signin-input"
              type="password"
              autoComplete="new-password"
              placeholder="Type it again"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && password && confirm) void submit()
              }}
            />

            {error && <div className="signin-error">⚠️ {error}</div>}

            <Button variant="gold" className="signin-submit" onClick={() => void submit()} disabled={busy}>
              {busy ? 'Working…' : 'Update password'}
            </Button>
          </>
        )}

        {done && (
          <Button variant="gold" className="signin-submit" onClick={() => void backToSignIn()}>
            Go to sign in
          </Button>
        )}
      </div>
    </Sheet>
  )
}

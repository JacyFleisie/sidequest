import { useState } from 'react'
import { signInToAccount, upgradeToAccount } from '../lib/sync'
import { Button, Sheet } from './ui'

export default function SignIn({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'signin' | 'create'>('create')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async () => {
    setError(null)
    const cleanEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Enter a valid email address.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setBusy(true)
    const res =
      mode === 'create'
        ? await upgradeToAccount(cleanEmail, password)
        : await signInToAccount(cleanEmail, password)
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Something went wrong — try again.')
      return
    }
    setDone(true)
    // Reload so the whole app re-syncs against the account identity.
    window.setTimeout(() => window.location.reload(), 600)
  }

  return (
    <Sheet onClose={onClose}>
      <div className="signin-sheet">
        <h2 className="signin-title">{mode === 'create' ? 'Create your account' : 'Welcome back'}</h2>
        <p className="signin-sub">
          {mode === 'create'
            ? 'Your progress, stats and friends get saved to your account — survive reinstalls and work on any device.'
            : 'Sign in to pull up your profile, stats and friends on this device.'}
        </p>

        {done && <div className="signin-done">✅ {mode === 'create' ? 'Account created!' : 'Signed in!'} Reloading…</div>}

        <label className="signin-label" htmlFor="sq-email">
          Email
        </label>
        <input
          id="sq-email"
          className="signin-input"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />

        <label className="signin-label" htmlFor="sq-password">
          Password
        </label>
        <input
          id="sq-password"
          className="signin-input"
          type="password"
          autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
          placeholder={mode === 'create' ? 'At least 6 characters' : 'Your password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />

        {error && <div className="signin-error">{error}</div>}

        <Button variant="gold" className="signin-submit" onClick={() => void submit()} disabled={busy}>
          {busy ? 'Working…' : mode === 'create' ? 'Create account' : 'Sign in'}
        </Button>

        <button className="signin-switch" onClick={() => { setMode(mode === 'create' ? 'signin' : 'create'); setError(null) }} disabled={busy}>
          {mode === 'create' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>

        <p className="signin-note">
          🔒 Free and private — your data is stored on your own Supabase project. No ads, ever.
        </p>
      </div>
    </Sheet>
  )
}

import { useState } from 'react'
import { sendPasswordReset, signInToAccount, upgradeToAccount } from '../lib/sync'
import Turnstile, { turnstileEnabled } from './Turnstile'
import { Button, Sheet } from './ui'

export default function SignIn({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'signin' | 'create'>('create')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  // Remounts the Turnstile widget after each attempt — tokens are single-use.
  const [attempt, setAttempt] = useState(0)

  const requireCaptcha = (): boolean => {
    if (turnstileEnabled && !captchaToken) {
      setError('Complete the security check first.')
      return false
    }
    return true
  }

  const afterAttempt = () => {
    setCaptchaToken(null)
    setAttempt((n) => n + 1)
  }

  // The invisible captcha solves in the background (~2–4s). Until it has a
  // token, the submit buttons stay disabled so users never hit a wall.
  const captchaPending = turnstileEnabled && !captchaToken

  const finish = () => {
    setDone(true)
    // Reload so the whole app re-syncs against the account identity.
    window.setTimeout(() => window.location.reload(), 600)
  }

  const submit = async () => {
    setError(null)
    const cleanEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.')
      return
    }
    if (password.length < 6) {
      setError('Password needs at least 6 characters.')
      return
    }
    if (!requireCaptcha()) return
    setBusy(true)
    const res =
      mode === 'create'
        ? await upgradeToAccount(cleanEmail, password)
        : await signInToAccount(cleanEmail, password, captchaToken ?? undefined)
    setBusy(false)
    if (!res.ok) {
      afterAttempt()
      setError(res.error ?? 'Something went wrong — try again.')
      return
    }
    finish()
  }

  const reset = async () => {
    setError(null)
    const cleanEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter the email you signed up with.')
      return
    }
    if (!requireCaptcha()) return
    setBusy(true)
    const res = await sendPasswordReset(cleanEmail, captchaToken ?? undefined)
    setBusy(false)
    if (!res.ok) {
      afterAttempt()
      setError(res.error ?? 'Could not send the reset email — try again.')
      return
    }
    setResetSent(true)
  }

  return (
    <Sheet onClose={onClose}>
      <div className="signin-sheet">
        <div className="signin-brand">🗺️ SideQuest</div>
        <h2 className="signin-title">{mode === 'create' ? '⚡ Create your account' : '👋 Welcome back'}</h2>
        <p className="signin-sub">
          {mode === 'create'
            ? 'Your quests, stats and friends sync to your account — so they survive reinstalls and follow you to any device.'
            : 'Sign in to pick up your quests, stats and friends right where you left off.'}
        </p>

        {done && <div className="signin-done">✅ {mode === 'create' ? 'Account created!' : 'Signed in!'} Reloading…</div>}

        {resetMode ? (
          <>
            {resetSent ? (
              <div className="signin-done">📧 Reset link sent! Check your inbox (and spam) — the link expires, so use it soon.</div>
            ) : (
              <>
                <p className="signin-sub">Enter your account email and we'll send you a link to set a new password. It arrives from SideQuest.</p>
                <label className="signin-label" htmlFor="sq-reset-email">Email</label>
                <input
                  id="sq-reset-email"
                  className="signin-input"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
                {error && <div className="signin-error">⚠️ {error}</div>}
                {turnstileEnabled && (
                  <div className="signin-captcha">
                    <Turnstile key={attempt} onToken={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
                  </div>
                )}
                <Button variant="gold" className="signin-submit" onClick={() => void reset()} disabled={busy || captchaPending}>
                  {busy ? 'Sending…' : captchaPending ? 'Verifying…' : 'Send reset link'}
                </Button>
                <button type="button" className="signin-switch" onClick={() => setResetMode(false)} disabled={busy}>
                  ← Back to sign in
                </button>
              </>
            )}
            {resetSent && (
              <button
                type="button"
                className="signin-switch"
                onClick={() => { setResetMode(false); setResetSent(false); setError(null) }}
              >
                ← Back to sign in
              </button>
            )}
          </>
        ) : (
          <form className="signin-form" onSubmit={(e) => { e.preventDefault(); void submit() }}>
            <label className="signin-label" htmlFor="sq-email">
              Email
            </label>
            <input
              id="sq-email"
              className="signin-input"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy || done}
            />

            <label className="signin-label" htmlFor="sq-password">
              Password
            </label>
            <div className="signin-pass-wrap">
              <input
                id="sq-password"
                className="signin-input"
                type={showPass ? 'text' : 'password'}
                name="password"
                autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
                placeholder={mode === 'create' ? 'At least 6 characters' : 'Your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy || done}
              />
              <button
                type="button"
                className="signin-pass-toggle"
                onClick={() => setShowPass((s) => !s)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>

            {error && <div className="signin-error">⚠️ {error}</div>}

            {turnstileEnabled && (
              <div className="signin-captcha">
                <Turnstile key={attempt} onToken={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
              </div>
            )}

            <Button type="submit" variant="gold" className="signin-submit" disabled={busy || done || captchaPending}>
              {busy ? 'Working…' : captchaPending ? 'Verifying…' : mode === 'create' ? 'Create account' : 'Sign in'}
            </Button>

            {mode === 'signin' && (
              <button
                type="button"
                className="signin-forgot"
                onClick={() => { setResetMode(true); setError(null) }}
                disabled={busy || done}
              >
                Forgot password?
              </button>
            )}

            <button
              type="button"
              className="signin-switch"
              onClick={() => { setMode(mode === 'create' ? 'signin' : 'create'); setError(null) }}
              disabled={busy || done}
            >
              {mode === 'create' ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </button>
          </form>
        )}

        <p className="signin-note">
          {turnstileEnabled
            ? '🛡️ Protected by Cloudflare security — your data stays safe.'
            : '🔒 Sign in on any device — your quests, stats and friends follow you.'}
        </p>
      </div>
    </Sheet>
  )
}

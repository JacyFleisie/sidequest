import { useState } from 'react'
import { getAccountInfo, sendPasswordReset, signInToAccount, signInWithGoogle, upgradeToAccount } from '../lib/sync'
import Turnstile, { turnstileEnabled } from './Turnstile'
import { Button, Sheet } from './ui'

/** The official multi-colour Google G, inline so it works offline. */
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export default function SignIn({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<'signin' | 'create'>('create')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)
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

  const finish = () => {
    setDone(true)
    // Reload so the whole app re-syncs against the account identity.
    window.setTimeout(() => window.location.reload(), 600)
  }

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
      setError('Enter the email you signed up with.')
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

  const google = async () => {
    setError(null)
    setGoogleBusy(true)
    const before = await getAccountInfo()
    const res = await signInWithGoogle()
    if (!res.ok) {
      setGoogleBusy(false)
      setError(res.error ?? 'Google sign-in failed — try again.')
      return
    }
    // On the web the flow finishes in a popup — watch for the session to
    // change, then reload. Linking keeps the same uid, so also watch for the
    // Google identity itself. On Android the whole app is backgrounded while
    // the browser handles Google, so the deep-link callback does the reload.
    const poll = window.setInterval(async () => {
      const after = await getAccountInfo()
      const linked = after && (after.uid !== before?.uid || after.providers.includes('google'))
      if (linked) {
        window.clearInterval(poll)
        setGoogleBusy(false)
        finish()
      }
    }, 700)
    window.setTimeout(() => window.clearInterval(poll), 120000)
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

        {resetMode ? (
          <>
            {resetSent ? (
              <div className="signin-done">📧 Reset link sent!</div>
            ) : (
              <>
                <p className="signin-sub">Enter your account email and we'll send you a link to set a new password.</p>
                <label className="signin-label" htmlFor="sq-reset-email">Email</label>
                <input
                  id="sq-reset-email"
                  className="signin-input"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                />
                {error && <div className="signin-error">{error}</div>}
                {turnstileEnabled && (
                  <div className="signin-captcha">
                    <Turnstile key={attempt} onToken={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
                  </div>
                )}
                <Button variant="gold" className="signin-submit" onClick={() => void reset()} disabled={busy}>
                  {busy ? 'Sending…' : 'Send reset link'}
                </Button>
                <button className="signin-switch" onClick={() => setResetMode(false)} disabled={busy}>
                  ← Back to sign in
                </button>
              </>
            )}
            {resetSent && (
              <button className="signin-switch" onClick={() => { setResetMode(false); setResetSent(false); setError(null) }}>
                ← Back to sign in
              </button>
            )}
          </>
        ) : (
          <>
        <button className="google-btn" onClick={() => void google()} disabled={googleBusy || busy || done}>
          <GoogleG />
          {googleBusy ? 'Opening Google…' : 'Continue with Google'}
        </button>

        <div className="signin-divider">or continue with email</div>

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
          disabled={busy || done}
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
          disabled={busy || done}
        />

        {error && <div className="signin-error">{error}</div>}

        {turnstileEnabled && (
          <div className="signin-captcha">
            <Turnstile key={attempt} onToken={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />
          </div>
        )}

        <Button variant="gold" className="signin-submit" onClick={() => void submit()} disabled={busy || googleBusy || done}>
          {busy ? 'Working…' : mode === 'create' ? 'Create account' : 'Sign in'}
        </Button>

        {mode === 'signin' && (
          <button
            className="signin-forgot"
            onClick={() => { setResetMode(true); setError(null) }}
            disabled={busy || googleBusy || done}
          >
            Forgot password?
          </button>
        )}

        <button
          className="signin-switch"
          onClick={() => { setMode(mode === 'create' ? 'signin' : 'create'); setError(null) }}
          disabled={busy || googleBusy || done}
        >
          {mode === 'create' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
          </>
        )}

        <p className="signin-note">🔒 Your stats stay synced across devices — sign in on any phone to pick up where you left off.</p>
      </div>
    </Sheet>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useGame } from '../lib/store'
import { ensureIdentity, isUsernameAvailable, syncProfile, usernameError } from '../lib/sync'
import { Button, Sheet } from './ui'

/**
 * The proper way to change your username: validated, checked for availability
 * against the server, and synced immediately — no sloppy inline editing.
 */
export default function EditProfile({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: (name: string) => void
}) {
  const { state, playerName, setPlayerName } = useGame()
  const [draft, setDraft] = useState(playerName)
  const [check, setCheck] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const uidRef = useRef<string | null>(null)

  useEffect(() => {
    let alive = true
    void ensureIdentity().then((uid) => {
      if (alive) uidRef.current = uid
    })
    return () => {
      alive = false
    }
  }, [])

  // Live availability — debounced, only when the name changed and is valid.
  useEffect(() => {
    const name = draft.trim()
    const invalid = usernameError(name)
    if (invalid || name.toLowerCase() === playerName.toLowerCase() || !uidRef.current) {
      setCheck('idle')
      return
    }
    setCheck('checking')
    const t = window.setTimeout(() => {
      void isUsernameAvailable(uidRef.current!, name).then((free) =>
        setCheck(free ? 'available' : 'taken'),
      )
    }, 400)
    return () => window.clearTimeout(t)
  }, [draft, playerName])

  const save = async () => {
    const name = draft.trim()
    const invalid = usernameError(name)
    if (invalid) {
      setError(invalid)
      return
    }
    const uid = uidRef.current ?? (await ensureIdentity())
    if (!uid) {
      setError('Not connected to the sync server — try again.')
      return
    }
    // No change — just close.
    if (name.toLowerCase() === playerName.toLowerCase()) {
      onClose()
      return
    }
    const free = await isUsernameAvailable(uid, name)
    if (!free) {
      setCheck('taken')
      setError('That username is already taken — try another.')
      return
    }
    setSaving(true)
    setError(null)
    setPlayerName(name)
    await syncProfile(uid, { ...state, playerName: name })
    setSaving(false)
    // Close the sheet and let the caller flash a brief confirmation.
    onSaved(name)
  }

  return (
    <Sheet onClose={onClose}>
      <div className="signin-sheet">
        <div className="signin-brand">🗺️ SideQuest</div>
        <h2 className="signin-title">✏️ Edit profile</h2>
        <p className="signin-sub">
          Pick a username your friends can find you by. It has to be unique — no two questers share a name.
        </p>

        <form className="signin-form" onSubmit={(e) => { e.preventDefault(); void save() }}>
            <label className="signin-label" htmlFor="sq-edit-username">
              Username
            </label>
            <input
              id="sq-edit-username"
              className="signin-input"
              type="text"
              name="username"
              autoComplete="nickname"
              placeholder="Your quest name"
              maxLength={20}
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setError(null) }}
              disabled={saving}
              autoFocus
            />
            {check !== 'idle' && !error && (
              <p className={`edit-profile-check edit-profile-${check}`}>
                {check === 'checking' && '⏳ Checking availability…'}
                {check === 'available' && `✓ @${draft.trim()} is available`}
                {check === 'taken' && `✕ @${draft.trim()} is already taken`}
              </p>
            )}
            {error && <div className="signin-error">⚠️ {error}</div>}

          <Button type="submit" variant="gold" className="signin-submit" disabled={saving || check === 'checking'}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </div>
    </Sheet>
  )
}

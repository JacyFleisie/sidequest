import { useEffect, useRef, useState } from 'react'
import {
  createSquad,
  disbandSquad,
  fetchMySquad,
  inviteToSquad,
  leaveSquad,
  removeFromSquad,
  SQUAD_BONUS_PCT,
  subscribeSquad,
  type Squad,
} from '../lib/squads'
import { ensureIdentity, type RealFriend } from '../lib/sync'
import { Sheet } from './ui'

const SQUAD_EMOJIS = ['🛡️', '🐉', '🦁', '⚡', '🏀', '🎧', '🌊', '🚀', '🔥', '🍕']

/** Co-op crew panel: create / invite / live roster / leave, plus the +XP bonus. */
export default function SquadPanel({ realFriends }: { realFriends: RealFriend[] }) {
  const [squad, setSquad] = useState<Squad | null>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🛡️')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const uidRef = useRef<string | null>(null)

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  const refresh = async (myUid: string) => {
    setSquad(await fetchMySquad(myUid))
    setLoading(false)
  }

  useEffect(() => {
    let unsub: (() => void) | null = null
    let cancelled = false
    void (async () => {
      const myUid = await ensureIdentity()
      if (cancelled || !myUid) return
      uidRef.current = myUid
      await refresh(myUid)
      // Live roster: someone joins, leaves or gets removed → refetch instantly.
      unsub = subscribeSquad(myUid, () => void refresh(myUid))
    })()
    return () => {
      cancelled = true
      unsub?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const uid = async (): Promise<string | null> => uidRef.current ?? (await ensureIdentity())

  const onCreate = async () => {
    const myUid = await uid()
    if (!myUid || !name.trim()) return
    setBusy(true)
    const res = await createSquad(myUid, name, emoji)
    setBusy(false)
    if (!res.ok) {
      flash(res.error ?? 'Could not create the squad.')
      return
    }
    flash(`🎉 ${emoji} ${name.trim()} is live! Invite your friends below.`)
    setName('')
    await refresh(myUid)
  }

  const onInvite = async (friend: RealFriend) => {
    const myUid = await uid()
    if (!myUid || !squad) return
    setBusy(true)
    const res = await inviteToSquad(myUid, squad.id, friend.id)
    setBusy(false)
    if (res.ok) flash(`🎉 ${friend.emoji} ${friend.name} joined ${squad.name}!`)
    else flash(res.error ?? "Couldn't invite them.")
    void refresh(myUid)
  }

  const onRemove = async (memberId: string) => {
    const myUid = await uid()
    if (!myUid || !squad) return
    setBusy(true)
    const ok = await removeFromSquad(myUid, squad.id, memberId)
    setBusy(false)
    if (ok) flash('Member removed.')
    else flash("Couldn't remove them.")
    void refresh(myUid)
  }

  const onLeave = async () => {
    const myUid = await uid()
    if (!myUid || !squad) return
    setBusy(true)
    const ok = squad.isLeader ? await disbandSquad(myUid, squad.id) : await leaveSquad(myUid, squad.id)
    setBusy(false)
    setConfirmLeave(false)
    if (ok) {
      flash(squad.isLeader ? `🛡️ ${squad.name} disbanded.` : 'You left the squad.')
      setSquad(null)
    } else {
      flash("Couldn't do that — try again.")
    }
  }

  if (loading) {
    return (
      <section className="squad-panel">
        <div className="squad-loading">Loading your squad…</div>
      </section>
    )
  }

  if (!squad) {
    return (
      <section className="squad-panel">
        <div className="squad-head">
          <div className="squad-head-main">
            <h2 className="section-title">🛡️ Start a squad</h2>
            <p className="section-sub">
              Crew up with your friends — every quest you finish together earns an extra{' '}
              <b>+{SQUAD_BONUS_PCT}% XP</b>. One squad per player, so choose your crew wisely.
            </p>
          </div>
        </div>
        <input
          className="find-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Squad name… (e.g. Midrand Menace)"
          maxLength={40}
        />
        <div className="squad-emoji-row">
          {SQUAD_EMOJIS.map((e) => (
            <button
              key={e}
              className={`squad-emoji ${e === emoji ? 'squad-emoji-active' : ''}`}
              onClick={() => setEmoji(e)}
              aria-label={`Pick ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
        <button className="btn-primary squad-create-btn" disabled={busy || !name.trim()} onClick={() => void onCreate()}>
          {busy ? 'Creating…' : `Create ${emoji} ${name.trim() || 'squad'}`}
        </button>
        {toast && <div className="builder-toast">{toast}</div>}
      </section>
    )
  }

  const youId = uidRef.current
  const memberIds = new Set(squad.members.map((m) => m.profileId))
  const inviteable = realFriends.filter((f) => !memberIds.has(f.id))

  return (
    <section className="squad-panel">
      <div className="squad-head">
        <div className="squad-head-emoji">{squad.emoji}</div>
        <div className="squad-head-main">
          <h2 className="section-title">{squad.name}</h2>
          <p className="section-sub">
            {squad.members.length} member{squad.members.length === 1 ? '' : 's'} · updates live
          </p>
        </div>
        <span className="squad-bonus">+{SQUAD_BONUS_PCT}% XP</span>
      </div>

      <div className="squad-members">
        {squad.members.map((m) => (
          <div className="squad-member" key={m.profileId}>
            <span className="squad-member-avatar">{m.emoji}</span>
            <div className="squad-member-main">
              <div className="squad-member-name">
                {m.name}
                {m.role === 'leader' && <span className="friend-crown">👑</span>}
                {m.profileId === youId && <span className="squad-you">you</span>}
              </div>
              <div className="squad-member-meta">
                Level {m.level} · {m.xp.toLocaleString()} XP · {m.questsDone} quests
              </div>
            </div>
            {squad.isLeader && m.profileId !== youId && (
              <button
                className="squad-remove"
                onClick={() => void onRemove(m.profileId)}
                aria-label={`Remove ${m.name}`}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {squad.isLeader && (
        <div className="squad-invite">
          <h3 className="sheet-section-title">Invite friends</h3>
          {inviteable.length === 0 ? (
            <p className="sheet-empty-note">Everyone on your friends list is already in the squad.</p>
          ) : (
            <div className="squad-invite-list">
              {inviteable.map((f) => (
                <div className="squad-invite-row" key={f.id}>
                  <span className="find-avatar">{f.emoji}</span>
                  <div className="find-main">
                    <div className="find-name">{f.name}</div>
                    <div className="find-meta">
                      Level {f.level} · {f.xp.toLocaleString()} XP
                    </div>
                  </div>
                  <button className="find-add" disabled={busy} onClick={() => void onInvite(f)}>
                    {busy ? '…' : 'Invite'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        className={`squad-leave ${squad.isLeader ? 'squad-leave-danger' : ''}`}
        onClick={() => setConfirmLeave(true)}
      >
        {squad.isLeader ? 'Disband squad' : 'Leave squad'}
      </button>

      {confirmLeave && (
        <Sheet onClose={() => setConfirmLeave(false)}>
          <div className="friend-sheet">
            <div className="sheet-eyebrow">🛡️ Squad</div>
            <div className="friend-sheet-name">
              {squad.emoji} {squad.name}
            </div>
            <p className="squad-confirm-copy">
              {squad.isLeader
                ? 'Disbanding deletes the squad and removes everyone. This cannot be undone.'
                : 'Leaving removes you from the squad and turns off your +20% XP bonus.'}
            </p>
            <button className="btn-primary squad-leave-confirm" onClick={() => void onLeave()}>
              {busy ? 'Working…' : squad.isLeader ? 'Disband squad' : 'Leave squad'}
            </button>
            <button className="squad-cancel" onClick={() => setConfirmLeave(false)}>
              Cancel
            </button>
          </div>
        </Sheet>
      )}

      {toast && <div className="builder-toast">{toast}</div>}
    </section>
  )
}

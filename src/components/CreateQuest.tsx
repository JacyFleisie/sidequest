import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CATEGORY_META,
  HOME_BASES,
  PROVINCES,
  VIBE_META,
  regionProvince,
  type Category,
  type Quest,
  type Vibe,
} from '../data/quests'
import { findBlockedWords, fetchBlocklist, BLOCKLIST_WORDS } from '../lib/moderation'
import { taglineOfTheDay } from '../lib/taglines'
import { useGame } from '../lib/store'
import {
  ensureIdentity,
  getAccountInfo,
  saveCustomQuest as saveCustomQuestRemote,
  type CustomQuestDraft,
} from '../lib/sync'
import { Button, Chip, Sheet } from './ui'

const EMOJIS = [
  '✨', '🎯', '🧭', '🔥', '💪', '🫶', '😂', '🤪', '🍔', '☕',
  '📸', '🎨', '🎤', '🏃', '🚶', '🌳', '🌊', '⛰️', '🏀', '🎮',
  '🃏', '📚', '🧠', '🗣️', '👀', '🛒', '💡', '🌙', '🌸', '🎲',
]
const DURATIONS = [10, 15, 20, 30, 45, 60, 90, 120, 180]
const PLAYER_COUNTS = [1, 2, 3, 4, 6, 8]

const CATEGORIES = Object.entries(CATEGORY_META) as [Category, { label: string; color: string; emoji: string }][]
const VIBES = Object.entries(VIBE_META) as [Vibe, { label: string; emoji: string }][]

const xpFor = (duration: number, difficulty: number): number =>
  Math.min(800, Math.max(40, 40 + Math.round(duration / 10) * 10 + (difficulty - 1) * 25))

export default function CreateQuest({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { homeBaseId, playerName, saveCustomQuest } = useGame()

  // Creating a quest is accounts-only: guests (anonymous sessions) get a locked
  // explainer that points to Profile, where account creation lives.
  const [accountOk, setAccountOk] = useState<boolean | null>(null)
  useEffect(() => {
    let alive = true
    void getAccountInfo().then((info) => {
      if (alive) setAccountOk(Boolean(info && !info.isAnonymous))
    })
    return () => {
      alive = false
    }
  }, [])

  // Live blocklist from the server (falls back to the bundled list offline),
  // so words added later apply without an app update.
  const [blocklist, setBlocklist] = useState<string[]>(BLOCKLIST_WORDS)
  useEffect(() => {
    let alive = true
    void fetchBlocklist().then((list) => {
      if (alive) setBlocklist(list)
    })
    return () => {
      alive = false
    }
  }, [])

  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('✨')
  const [category, setCategory] = useState<Category>('free')
  const [vibes, setVibes] = useState<Vibe[]>(['random'])
  const [duration, setDuration] = useState(30)
  const [cost, setCost] = useState(0)
  const [players, setPlayers] = useState(2)
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<Quest | null>(null)
  const [syncNote, setSyncNote] = useState<string | null>(null)

  const xp = xpFor(duration, difficulty)

  const toggleVibe = (v: Vibe) => {
    setVibes((cur) =>
      cur.includes(v) ? cur.filter((x) => x !== v) : cur.length >= 3 ? cur : [...cur, v],
    )
  }

  const submit = async () => {
    const t = title.trim()
    if (t.length < 3) {
      setError('Give your quest a title — at least 3 characters.')
      return
    }
    if (vibes.length === 0) {
      setError('Pick at least one vibe.')
      return
    }
    const cleanTitle = t.slice(0, 60)
    const cleanDesc = description.trim().slice(0, 280)
    const tags = [...new Set([category, 'custom', ...vibes])]
    // Moderation gate: refuse language that isn't allowed before anything is
    // saved. The server re-checks with the same list (DB trigger), so this is
    // fast feedback, not the only line of defence.
    const blocked = findBlockedWords(`${cleanTitle} ${cleanDesc} ${tags.join(' ')}`, blocklist)
    if (blocked.length > 0) {
      setError(`That language isn’t allowed in quests: ${blocked.join(', ')}. Please reword it.`)
      return
    }
    setError(null)
    setSaving(true)

    const base = HOME_BASES.find((b) => b.id === homeBaseId) ?? HOME_BASES[0]
    const province = regionProvince(base.region)
    const draft: CustomQuestDraft = {
      title: cleanTitle,
      description: cleanDesc,
      emoji,
      category,
      vibe: vibes,
      durationMin: duration,
      cost,
      players: [players, players],
      difficulty,
      xp,
      tags,
    }
    const quest: Quest = {
      id: crypto.randomUUID(),
      title: cleanTitle,
      emoji,
      category,
      province,
      provinceName: PROVINCES[province].name,
      city: 'Anywhere',
      region: base.region,
      lat: base.lat,
      lng: base.lng,
      durationMin: duration,
      cost,
      players: [players, players],
      difficulty,
      vibe: vibes,
      description: cleanDesc,
      anywhere: true,
      completionLine: `Quest complete. ${cleanTitle} — done. Legend.`,
      xp,
      tags,
      completedCount: 0,
      ownerId: '',
      ownerName: '',
      ownerEmoji: '',
    }

    // Offline-first: save locally immediately, then share with friends.
    saveCustomQuest(quest)
    const uid = await ensureIdentity()
    const shared = uid ? await saveCustomQuestRemote(uid, quest.id, draft) : false
    setSaving(false)
    setSaved(quest)
    setSyncNote(
      shared
        ? 'Saved and shared with everyone on SideQuest! It’s in the feed now.'
        : "Saved on this device. It’ll be shared with everyone once you’re back online.",
    )
  }

  // Guests / offline users can't create quests — send them to Profile instead.
  if (accountOk === false) {
    return (
      <Sheet onClose={onClose}>
        <div className="create-success">
          <div className="create-success-emoji">🔒</div>
          <h2 className="create-success-title">Accounts only</h2>
          <p className="create-success-note">
            To create a quest and share it with everyone, you need an account. It takes 30
            seconds — your quests, stats and friends then follow you on any device.
          </p>
          <div className="create-success-actions">
            <Button
              variant="gold"
              onClick={() => {
                onClose()
                navigate('/profile')
              }}
            >
              Go to Profile — create an account
            </Button>
          </div>
        </div>
      </Sheet>
    )
  }

  if (accountOk === null) {
    return (
      <Sheet onClose={onClose}>
        <div className="create-success">
          <div className="create-success-emoji">⏳</div>
          <h2 className="create-success-title">Checking…</h2>
          <p className="create-success-note">{taglineOfTheDay()}</p>
        </div>
      </Sheet>
    )
  }

  if (saved) {
    return (
      <Sheet onClose={onClose} wide>
        <div className="create-success">
          <div className="create-success-emoji">{saved.emoji}</div>
          <h2 className="create-success-title">Quest created!</h2>
          <p className="create-success-name">
            {saved.title} · +{saved.xp} XP
          </p>
          <p className="create-success-note">{syncNote}</p>
          <div className="create-success-actions">
            <Button variant="gold" onClick={onClose}>
              Done
            </Button>
            <Button variant="ghost" onClick={() => setSaved(null)}>
              Create another
            </Button>
          </div>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet onClose={onClose} wide>
      <div className="create-head">
        <h2 className="create-title">✨ Create your own quest</h2>
        <p className="create-sub">
          Make up an anywhere-quest — doable wherever you are — and share it with everyone on SideQuest.
        </p>
      </div>

      {error && <div className="create-error">⚠️ {error}</div>}

      <div className="create-field">
        <label className="field-label">Title</label>
        <input
          className="create-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Dance Battle in the School Hall"
          maxLength={60}
        />
      </div>

      <div className="create-field">
        <label className="field-label">Emoji</label>
        <div className="emoji-grid">
          {EMOJIS.map((e) => (
            <button
              key={e}
              className={`emoji-opt ${emoji === e ? 'emoji-opt-active' : ''}`}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="create-field">
        <label className="field-label">Category</label>
        <div className="chips-row">
          {CATEGORIES.map(([c, meta]) => (
            <Chip
              key={c}
              label={meta.label}
              emoji={meta.emoji}
              color={meta.color}
              active={category === c}
              onClick={() => setCategory(c)}
            />
          ))}
        </div>
      </div>

      <div className="create-field">
        <label className="field-label">Vibes (up to 3)</label>
        <div className="chips-row">
          {VIBES.map(([v, meta]) => (
            <Chip
              key={v}
              label={meta.label}
              emoji={meta.emoji}
              active={vibes.includes(v)}
              onClick={() => toggleVibe(v)}
            />
          ))}
        </div>
      </div>

      <div className="create-grid">
        <div className="create-field">
          <label className="field-label">How long?</label>
          <div className="chips-row">
            {DURATIONS.map((d) => (
              <Chip
                key={d}
                label={d < 60 ? `${d} min` : `${Math.round(d / 60)}h`}
                active={duration === d}
                onClick={() => setDuration(d)}
              />
            ))}
          </div>
        </div>

        <div className="create-field">
          <label className="field-label">Players</label>
          <div className="chips-row">
            {PLAYER_COUNTS.map((p) => (
              <Chip
                key={p}
                label={p === 1 ? 'Solo' : `${p}`}
                active={players === p}
                onClick={() => setPlayers(p)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="create-grid">
        <div className="create-field">
          <label className="field-label">Cost per person (R)</label>
          <input
            className="create-input"
            type="number"
            min={0}
            max={2000}
            step={5}
            value={cost}
            onChange={(e) => setCost(Math.max(0, Math.min(2000, Number(e.target.value) || 0)))}
          />
        </div>

        <div className="create-field">
          <label className="field-label">Difficulty</label>
          <div className="chips-row">
            {([1, 2, 3, 4, 5] as const).map((d) => (
              <Chip
                key={d}
                label={'⭐'.repeat(d)}
                active={difficulty === d}
                onClick={() => setDifficulty(d)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="create-field">
        <label className="field-label">What’s the quest?</label>
        <textarea
          className="create-input create-textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tell your friends what to actually do…"
          maxLength={280}
          rows={3}
        />
        <div className="create-xp">🏆 Worth {xp} XP when someone finishes it</div>
      </div>

      <Button variant="gold" className="create-submit" onClick={submit} disabled={saving}>
        {saving ? 'Saving…' : `🚀 Create & share (${playerName || 'you'})`}
      </Button>
    </Sheet>
  )
}

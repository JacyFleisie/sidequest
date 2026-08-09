import { useMemo, useState } from 'react'
import { ALL_QUESTS, CATEGORY_META } from '../data/quests'
import {
  decodeFriendCard,
  encodeFriendCard,
  friendCardUrl,
  friendId,
  friendProfile,
  rivalry,
  timeAgo,
  type FriendBadge,
  type FriendCard,
  type FriendProfile,
} from '../lib/friends'
import { levelProgress, rankFromXp } from '../lib/game'
import { chainShareUrl, copyText, shareViaNative } from '../lib/share'
import { useGame, type Friend } from '../lib/store'
import { Button, Sheet } from './ui'

const AVATARS = ['🐆', '🦁', '🐘', '🦏', '🦒', '🐧', '🦈', '🦓', '🐢', '🦜', '🐨', '🐺', '🦉', '🦋', '🐊', '🦭']

const LEVEL_EMOJI = ['🌱', '🌿', '🔥', '⚡', '🌟', '💎', '👑', '🦁', '🚀', '🌍', '🏆', '🇿🇦']

const LEVEL_ICON = (level: number): string => LEVEL_EMOJI[Math.min(level - 1, LEVEL_EMOJI.length - 1)]

/** Pulls a friend card out of anything a friend might paste: a full link, a ?friend= param, or the raw code. */
export const parseFriendPayload = (raw: string): FriendCard | null => {
  const m = raw.match(/[?&]friend=([A-Za-z0-9_-]+)/)
  const payload = m ? m[1] : raw.trim()
  if (!payload) return null
  return decodeFriendCard(payload)
}

export default function Friends() {
  const { state, playerName, friends, addFriend, removeFriend } = useGame()
  const [tab, setTab] = useState<'squad' | 'activity'>('squad')
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<Friend | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2600)
  }

  const playerQuests = useMemo(
    () =>
      Object.keys(state.completed).filter(
        (id) => !id.startsWith('chain-') && !id.startsWith('s-') && !id.startsWith('c-') && !id.startsWith('f-'),
      ).length,
    [state.completed],
  )

  const progress = levelProgress(state.xp)
  const youEmoji = LEVEL_ICON(progress.level)

  const addByName = (name: string, emoji: string): boolean => {
    const trimmed = name.trim()
    if (!trimmed) {
      flash('Give your friend a name first.')
      return false
    }
    const id = friendId(trimmed, emoji)
    if (friends.some((f) => f.id === id)) {
      flash('That friend is already on your list.')
      return false
    }
    addFriend({ id, name: trimmed, emoji, addedAt: new Date().toISOString() })
    flash(`${emoji} ${trimmed} added to your squad!`)
    return true
  }

  const shareCard = async () => {
    const url = friendCardUrl(playerName, youEmoji)
    const native = await shareViaNative(`Join me on SideQuest — ${playerName} 🇿🇦`, url)
    if (native) return
    const ok = await copyText(url)
    flash(ok ? '📋 Your friend card link is copied — send it!' : "Couldn't copy the link.")
  }

  const copyCode = async () => {
    const code = encodeFriendCard(playerName, youEmoji)
    const ok = await copyText(code)
    flash(ok ? `📋 Your friend code is copied — friends paste it into “Add a friend”.` : "Couldn't copy the code.")
  }

  const challenge = async (friend: Friend) => {
    const pool = [...ALL_QUESTS].sort(() => Math.random() - 0.5)
    const quest = pool[0]
    const bonus = pool.find((q) => q.id !== quest.id && q.city === quest.city) ?? pool[1]
    const from = encodeURIComponent(playerName)
    const url = `${chainShareUrl(quest.title, quest.emoji, [quest.id, bonus.id])}&from=${from}`
    const text = `${friend.emoji} ${friend.name}: I challenge you to “${quest.title}”. Beat it first! 🏁`
    const native = await shareViaNative(text, url)
    if (native) return
    const ok = await copyText(`${text} ${url}`)
    flash(ok ? `📋 Challenge sent to ${friend.name}!` : "Couldn't copy the challenge link.")
  }

  const profiles = useMemo(
    () => new Map(friends.map((f) => [f.id, { friend: f, profile: friendProfile(f) }])),
    [friends],
  )

  const sorted = [...profiles.values()].sort((a, b) => b.profile.xp - a.profile.xp)
  const leaderId = sorted[0]?.friend.id

  const feed = useMemo(() => {
    const events: { friend: Friend; badge: FriendBadge }[] = []
    for (const { friend, profile } of profiles.values()) {
      for (const b of profile.badgeEvents) events.push({ friend, badge: b })
    }
    return events.sort((a, b) => b.badge.earnedAt.localeCompare(a.badge.earnedAt)).slice(0, 10)
  }, [profiles])

  return (
    <div className="page friends">
      <header className="page-head">
        <div className="bored-banner">👥 YOUR SQUAD</div>
        <h1 className="page-title">Friends</h1>
        <p className="page-sub">Add your crew, compare quests, and challenge each other across South Africa.</p>
      </header>

      <div className="seg">
        <button className={`seg-btn ${tab === 'squad' ? 'seg-active' : ''}`} onClick={() => setTab('squad')}>
          👥 Squad <span className="seg-count">{friends.length}</span>
        </button>
        <button className={`seg-btn ${tab === 'activity' ? 'seg-active' : ''}`} onClick={() => setTab('activity')}>
          🔔 Activity <span className="seg-count">{feed.length}</span>
        </button>
      </div>

      {tab === 'squad' ? (
        <>
          <section className="you-card">
            <div className="you-avatar">{youEmoji}</div>
            <div className="you-main">
              <div className="you-name">{playerName}</div>
              <div className="you-meta">
                Lv {progress.level} · {state.xp.toLocaleString()} XP · {playerQuests} quests · 🔥 {state.streak}-day streak
              </div>
              <div className="you-actions">
                <button className="you-btn you-btn-gold" onClick={shareCard}>
                  📤 Share my card
                </button>
                <button className="you-btn" onClick={copyCode}>
                  📋 Copy my code
                </button>
              </div>
            </div>
          </section>

          <button className="add-friend-btn" onClick={() => setAddOpen(true)}>
            ＋ Add a friend
          </button>

          {friends.length === 0 ? (
            <div className="empty-state">
              No friends yet. Tap <b>＋ Add a friend</b> above — or share your card so they can add you. You can
              challenge each other and compare quests once they're in.
            </div>
          ) : (
            <section className="friends-list">
              {sorted.map(({ friend, profile }) => {
                const rival = rivalry(profile, playerQuests, state.streak)
                return (
                  <button className="friend-card" key={friend.id} onClick={() => setSelected(friend)}>
                    <div className="friend-avatar">{friend.emoji}</div>
                    <div className="friend-main">
                      <div className="friend-name">
                        {friend.name}
                        {friend.id === leaderId && <span className="friend-crown">👑</span>}
                      </div>
                      <div className="friend-meta">
                        <span className="friend-chip">{LEVEL_ICON(profile.level)} Lv {profile.level}</span>
                        <span className="friend-chip">🔥 {profile.streak}</span>
                        <span className="friend-chip">📍 {profile.questsDone} quests</span>
                        <span className="friend-chip">{profile.xp.toLocaleString()} XP</span>
                      </div>
                      <div className={`friend-rival friend-rival-${rival.tone}`}>{rival.label}</div>
                      {profile.badgeEvents.length > 0 && (
                        <div className="friend-badge-chip">
                          🎖️ +{profile.badgeEvents.length} badge{profile.badgeEvents.length > 1 ? 's' : ''} this week
                        </div>
                      )}
                    </div>
                    <div className="friend-last">
                      <span className="friend-last-dot" />
                      {profile.lastActive}
                    </div>
                  </button>
                )
              })}
            </section>
          )}
        </>
      ) : (
        <>
          {feed.length > 0 ? (
            <section className="friends-feed">
              <h2 className="section-title">🔔 Badge buzz</h2>
              <p className="section-sub">Your friends are out there earning them.</p>
              <div className="feed-list">
                {feed.map(({ friend, badge }) => (
                  <button className="feed-row" key={`${friend.id}-${badge.id}`} onClick={() => setSelected(friend)}>
                    <span className="feed-avatar">{friend.emoji}</span>
                    <span className="feed-main">
                      <span className="feed-text">
                        <strong>{friend.name}</strong> just earned <strong>{badge.emoji} {badge.name}</strong>
                      </span>
                      <span className="feed-when">
                        {timeAgo(badge.earnedAt)} · tap to view {friend.name}'s profile
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <div className="empty-state">
              No activity yet. Friend profiles grow as time passes — when one of your squad crosses a badge
              threshold, it shows up here.
            </div>
          )}

          <section className="friends-howto">
            <h2 className="section-title">💡 How friends work</h2>
            <p className="section-sub">
              Send your card (via the 📤 button on your card) — when a friend opens the link they can add you
              straight from it. Or swap <b>friend codes</b>: paste one into “＋ Add a friend”. No accounts, no
              backend — profiles are stable per person and grow over time.
            </p>
          </section>
        </>
      )}

      {addOpen && (
        <AddFriendSheet
          existingIds={new Set(friends.map((f) => f.id))}
          onAdd={addByName}
          onShare={shareCard}
          onClose={() => setAddOpen(false)}
        />
      )}

      {selected && (
        <FriendSheet
          friend={selected}
          profile={profiles.get(selected.id)!.profile}
          onChallenge={() => challenge(selected)}
          onRemove={() => {
            removeFriend(selected.id)
            setSelected(null)
            flash(`${selected.emoji} ${selected.name} removed.`)
          }}
          onClose={() => setSelected(null)}
        />
      )}

      {toast && <div className="builder-toast">{toast}</div>}
    </div>
  )
}

function AddFriendSheet({
  existingIds,
  onAdd,
  onShare,
  onClose,
}: {
  existingIds: Set<string>
  onAdd: (name: string, emoji: string) => boolean
  onShare: () => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(AVATARS[0])
  const [paste, setPaste] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const card = useMemo(() => (paste.trim() ? parseFriendPayload(paste) : null), [paste])

  const addPasted = () => {
    if (!card) {
      setErr("Couldn't read that — paste the full link or code from your friend.")
      return
    }
    if (existingIds.has(friendId(card.n, card.e))) {
      setErr(`${card.e} ${card.n} is already on your list.`)
      return
    }
    onAdd(card.n, card.e)
    onClose()
  }

  const addNamed = () => {
    setErr(null)
    if (onAdd(name, emoji)) {
      setName('')
      onClose()
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="add-sheet">
        <h2 className="sheet-title">＋ Add a friend</h2>

        <label className="field-label">Their name</label>
        <div className="add-name-row">
          <input
            className="friend-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addNamed()}
            placeholder="Friend's name…"
            maxLength={20}
          />
          <Button onClick={addNamed}>＋ Add</Button>
        </div>

        <label className="field-label">Their avatar</label>
        <div className="emoji-grid">
          {AVATARS.map((a) => (
            <button
              key={a}
              className={`emoji-opt ${a === emoji ? 'emoji-opt-active' : ''}`}
              onClick={() => setEmoji(a)}
            >
              {a}
            </button>
          ))}
        </div>

        <div className="add-divider">— or paste their card link / code —</div>

        <input
          className="friend-name-input"
          value={paste}
          onChange={(e) => {
            setPaste(e.target.value)
            setErr(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && addPasted()}
          placeholder="Paste a friend's link or code…"
        />

        {paste.trim() && card && (
          <div className="paste-preview">
            <span className="paste-avatar">{card.e}</span>
            <span className="paste-name">{card.n}</span>
            <button className="paste-add" onClick={addPasted}>
              ＋ Add
            </button>
          </div>
        )}
        {err && <div className="paste-error">{err}</div>}

        <button className="text-btn add-share" onClick={onShare}>
          📤 …or share your own card so they can add you
        </button>
      </div>
    </Sheet>
  )
}

function FriendSheet({
  friend,
  profile,
  onChallenge,
  onRemove,
  onClose,
}: {
  friend: Friend
  profile: FriendProfile
  onChallenge: () => void
  onRemove: () => void
  onClose: () => void
}) {
  const rank = rankFromXp(profile.xp)
  return (
    <Sheet onClose={onClose}>
      <div className="friend-sheet">
        <div className="friend-sheet-hero">
          <span className="friend-sheet-emoji">{friend.emoji}</span>
          <div className="friend-sheet-name">{friend.name}</div>
          <div className="friend-sheet-level">
            {LEVEL_ICON(profile.level)} Level {profile.level} · {rank.rank.emoji} {rank.rank.name} ·{' '}
            {profile.xp.toLocaleString()} XP
          </div>
        </div>

        <div className="friend-sheet-stats">
          <div className="friend-sheet-stat">
            <div className="friend-sheet-stat-value">{profile.questsDone}</div>
            <div className="friend-sheet-stat-label">Quests</div>
          </div>
          <div className="friend-sheet-stat">
            <div className="friend-sheet-stat-value">🔥 {profile.streak}</div>
            <div className="friend-sheet-stat-label">Streak</div>
          </div>
          <div className="friend-sheet-stat">
            <div className="friend-sheet-stat-value">{profile.badges}</div>
            <div className="friend-sheet-stat-label">Badges</div>
          </div>
          <div className="friend-sheet-stat">
            <div className="friend-sheet-stat-value">🗺️ {profile.provinces}/9</div>
            <div className="friend-sheet-stat-label">Provinces</div>
          </div>
        </div>

        {profile.badgeEvents.length > 0 && (
          <div className="friend-just-earned">
            <h3 className="chain-steps-title">🎖️ Just earned</h3>
            {profile.badgeEvents.map((b) => (
              <div className="friend-just-earned-row" key={b.id}>
                <span className="friend-just-earned-badge">
                  {b.emoji} {b.name}
                </span>
                <span className="friend-just-earned-when">{timeAgo(b.earnedAt)}</span>
              </div>
            ))}
          </div>
        )}

        {profile.favourite && (
          <div className="friend-favourite">
            ⭐ Favourite quest: {profile.favourite.emoji} {profile.favourite.title}
          </div>
        )}

        <div className="friend-activity">
          <h3 className="chain-steps-title">🕑 Recent quests</h3>
          {profile.recent.map((a) => {
            const q = ALL_QUESTS.find((x) => x.id === a.questId)
            const meta = q ? CATEGORY_META[q.category] : null
            return (
              <div className="friend-activity-row" key={a.questId + a.when}>
                <div className="friend-activity-emoji">{a.emoji}</div>
                <div className="friend-activity-main">
                  <div className="friend-activity-title">{a.title}</div>
                  <div className="friend-activity-meta">
                    {a.city} · {meta ? `${meta.emoji} ${meta.label}` : ''}
                  </div>
                </div>
                <div className="friend-activity-when">{a.when}</div>
              </div>
            )
          })}
        </div>

        <Button variant="gold" className="accept-btn" onClick={onChallenge}>
          🏁 Challenge to a quest
        </Button>
        <button className="abandon-btn" onClick={onRemove}>
          🗑️ Remove friend
        </button>
      </div>
    </Sheet>
  )
}

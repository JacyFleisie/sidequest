import { useMemo, useState } from 'react'
import { ALL_QUESTS, CATEGORY_META } from '../data/quests'
import { friendId, friendProfile, friendCardUrl, rivalry, timeAgo, type FriendBadge, type FriendProfile } from '../lib/friends'
import { chainShareUrl, copyText, shareViaNative } from '../lib/share'
import { useGame, type Friend } from '../lib/store'
import { Button, Sheet } from './ui'

const AVATARS = ['🐆', '🦁', '🐘', '🦏', '🦒', '🐧', '🦈', '🦓', '🐢', '🦜', '🐨', '🐺']

const LEVEL_EMOJI = ['🌱', '🌿', '🔥', '⚡', '🌟', '💎', '👑', '🦁', '🚀', '🌍', '🏆', '🇿🇦']

const LEVEL_ICON = (level: number): string => LEVEL_EMOJI[Math.min(level - 1, LEVEL_EMOJI.length - 1)]

export default function Friends() {
  const { state, playerName, friends, addFriend, removeFriend } = useGame()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(AVATARS[0])
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

  const add = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      flash('Give your friend a name first.')
      return
    }
    const id = friendId(trimmed, emoji)
    if (friends.some((f) => f.id === id)) {
      flash('That friend is already on your list.')
      return
    }
    addFriend({ id, name: trimmed, emoji, addedAt: new Date().toISOString() })
    setName('')
    flash(`${emoji} ${trimmed} added to your squad!`)
  }

  const shareCard = async () => {
    const url = friendCardUrl(playerName, LEVEL_ICON(1))
    const native = await shareViaNative(`Join me on SideQuest — ${playerName} 🇿🇦`, url)
    if (native) return
    const ok = await copyText(url)
    flash(ok ? '📋 Your friend card link is copied — send it!' : "Couldn't copy the link.")
  }

  const challenge = async (friend: Friend) => {
    // Pick a quest that fits their level roughly, plus one more stop to make it a real quest.
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

      <section className="friends-add">
        <div className="friends-add-row">
          <div className="avatar-picker">
            {AVATARS.map((a) => (
              <button key={a} className={`avatar-opt ${a === emoji ? 'avatar-opt-active' : ''}`} onClick={() => setEmoji(a)}>
                {a}
              </button>
            ))}
          </div>
          <input
            className="friend-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Friend's name…"
            maxLength={20}
          />
          <Button onClick={add}>＋ Add</Button>
        </div>
        <button className="text-btn" onClick={shareCard}>
          📤 Share my friend card
        </button>
      </section>

      {friends.length === 0 ? (
        <div className="empty-state">
          No friends yet. Add your crew above — they'll show up with their own quest stats, and you can challenge
          them to quests.
        </div>
      ) : (
        <section className="friends-list">
          {sorted.map(({ friend, profile }) => {
            const rival = rivalry(profile, playerQuests, state.streak)
            return (
              <button className="friend-card" key={friend.id} onClick={() => setSelected(friend)}>
                <div className="friend-avatar">{friend.emoji}</div>
                <div className="friend-main">
                  <div className="friend-name">{friend.name}</div>
                  <div className="friend-meta">
                    {LEVEL_ICON(profile.level)} Lv {profile.level} · 🔥 {profile.streak}-day streak · {profile.questsDone}{' '}
                    quests
                  </div>
                  <div className={`friend-rival friend-rival-${rival.tone}`}>{rival.label}</div>
                  {profile.badgeEvents.length > 0 && (
                    <div className="friend-badge-chip">
                      🎖️ +{profile.badgeEvents.length} badge{profile.badgeEvents.length > 1 ? 's' : ''} this week
                    </div>
                  )}
                </div>
                <div className="friend-last">{profile.lastActive}</div>
              </button>
            )
          })}
        </section>
      )}

      {feed.length > 0 && (
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
      )}

      <section className="friends-howto">
        <h2 className="section-title">💡 How friends work</h2>
        <p className="section-sub">
          Friends get stable profiles from their friend card, so the same person always has the same stats. Send your
          card to a friend — when they open it they can add you straight from the link. No accounts, no backend.
        </p>
      </section>

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
  return (
    <Sheet onClose={onClose}>
      <div className="friend-sheet">
        <div className="friend-sheet-hero">
          <span className="friend-sheet-emoji">{friend.emoji}</span>
          <div className="friend-sheet-name">{friend.name}</div>
          <div className="friend-sheet-level">
            {LEVEL_ICON(profile.level)} Level {profile.level} · {profile.xp.toLocaleString()} XP
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

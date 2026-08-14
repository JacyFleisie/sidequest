import { useEffect, useMemo, useRef, useState } from 'react'
import { ALL_QUESTS, CATEGORY_META } from '../data/quests'
import {
  friendProfile,
  rivalry,
  timeAgo,
  type FriendBadge,
  type FriendProfile,
} from '../lib/friends'
import { levelProgress, rankFromXp } from '../lib/game'

import { useGame, type Friend } from '../lib/store'
import {
  acceptFriendRequest,
  declineFriendRequest,
  ensureIdentity,
  fetchFriendFeed,
  fetchIncomingRequests,
  fetchRealFriends,
  findPeople,
  sendFriendRequest,
  subscribeFriendFeed,
  subscribeIncomingRequests,
  syncEnabled,
  type FeedEvent,
  type FoundPerson,
  type IncomingRequest,
  type RealFriend,
} from '../lib/sync'
import { usePullToRefresh } from '../lib/usePullToRefresh'
import Leaderboard from './Leaderboard'
import SquadPanel from './SquadPanel'
import { Sheet } from './ui'
import PullHint from './PullHint'

const LEVEL_EMOJI = ['🌱', '🌿', '🔥', '⚡', '🌟', '💎', '👑', '🦁', '🚀', '🌍', '🏆', '🇿🇦']

const LEVEL_ICON = (level: number): string => LEVEL_EMOJI[Math.min(level - 1, LEVEL_EMOJI.length - 1)]

/** Pulls a friend card out of anything a friend might paste: a full link, a ?friend= param, or the raw code. */
export default function Friends() {
  const { state, playerName, friends, addFriend, removeFriend } = useGame()
  const [tab, setTab] = useState<'squad' | 'activity' | 'leaderboard'>('squad')
  const [selected, setSelected] = useState<Friend | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [incoming, setIncoming] = useState<IncomingRequest[]>([])
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([])
  const [realFriends, setRealFriends] = useState<RealFriend[]>([])
  const [uid, setUid] = useState<string | null>(null)
  const [synced, setSynced] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<FoundPerson[]>([])
  const [searching, setSearching] = useState(false)

  const flash = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2600)
  }

  // ── Real sync: incoming requests + real friends from Supabase ──────────────
  const refreshRequests = async (myUid: string) => {
    setIncoming(await fetchIncomingRequests(myUid))
  }
  const refreshFriends = async (myUid: string) => {
    setRealFriends(await fetchRealFriends(myUid))
  }
  const refreshFeed = async (myUid: string) => {
    setFeedEvents(await fetchFriendFeed(myUid))
  }

  useEffect(() => {
    if (!syncEnabled()) return
    let unsub: (() => void) | null = null
    let unsubFeed: (() => void) | null = null
    let cancelled = false
    void (async () => {
      const myUid = await ensureIdentity()
      if (cancelled || !myUid) return
      setUid(myUid)
      setSynced(true)
      await Promise.all([refreshRequests(myUid), refreshFriends(myUid), refreshFeed(myUid)])
      unsub = subscribeIncomingRequests(myUid, () => void refreshRequests(myUid))
      // Live feed: refetch when a friend completes a quest anywhere in the world.
      unsubFeed = subscribeFriendFeed(myUid, () => void refreshFeed(myUid))
    })()
    const onEvent = () => {
      if (uid) void refreshRequests(uid)
    }
    window.addEventListener('sidequest:friend-request', onEvent)
    return () => {
      cancelled = true
      unsub?.()
      unsubFeed?.()
      window.removeEventListener('sidequest:friend-request', onEvent)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const playerQuests = useMemo(
    () =>
      Object.keys(state.completed).filter(
        (id) => !id.startsWith('chain-') && !id.startsWith('s-') && !id.startsWith('c-') && !id.startsWith('f-'),
      ).length,
    [state.completed],
  )

  const progress = levelProgress(state.xp)
  const youEmoji = LEVEL_ICON(progress.level)

  /** Sends a real request to a person found via search. */
  const requestPerson = async (person: FoundPerson) => {
    const myUid = uid ?? (await ensureIdentity())
    if (!myUid || person.id === myUid) return
    const ok = await sendFriendRequest(myUid, person.id)
    if (ok) {
      flash(`📨 Request sent to ${person.emoji} ${person.name}!`)
      setResults((rs) => rs.filter((r) => r.id !== person.id))
    } else {
      flash("Couldn't send the request — check your connection.")
    }
  }

  const runSearch = async (q: string) => {
    setSearch(q)
    if (!q.trim()) {
      setResults([])
      return
    }
    const myUid = uid ?? (await ensureIdentity())
    if (!myUid) return
    setSearching(true)
    const found = await findPeople(q, myUid)
    setResults(found.filter((f) => !friends.some((x) => x.id === f.id)))
    setSearching(false)
  }

  const accept = async (req: IncomingRequest) => {
    const ok = await acceptFriendRequest(uid ?? '', req.id)
    if (!ok) {
      flash("Couldn't accept — check your connection.")
      return
    }
    addFriend({ id: req.senderId, name: req.senderName, emoji: req.senderEmoji, addedAt: new Date().toISOString() })
    setIncoming((xs) => xs.filter((x) => x.id !== req.id))
    flash(`${req.senderEmoji} ${req.senderName} is now your friend! 🎉`)
  }

  const decline = async (req: IncomingRequest) => {
    const ok = await declineFriendRequest(uid ?? '', req.id)
    if (!ok) {
      flash("Couldn't decline — check your connection.")
      return
    }
    setIncoming((xs) => xs.filter((x) => x.id !== req.id))
    flash(`Request from ${req.senderEmoji} ${req.senderName} declined.`)
  }

  // Real friends from the DB get their real stats; local-only friends keep the
  // deterministic demo profile until they also join the synced world.
  const profiles = useMemo(() => {
    const map = new Map(friends.map((f) => [f.id, { friend: f, profile: friendProfile(f) }]))
    for (const r of realFriends) {
      const f: Friend = { id: r.id, name: r.name, emoji: r.emoji, addedAt: new Date().toISOString() }
      map.set(r.id, {
        friend: f,
        profile: {
          xp: r.xp,
          level: r.level,
          streak: r.streak,
          questsDone: r.questsDone,
          badges: r.badges,
          provinces: 1,
          lastActive: r.lastActiveAt ? timeAgo(r.lastActiveAt) : 'online',
          recent: [],
          favourite: null,
          badgeEvents: [],
        },
      })
    }
    return map
  }, [friends, realFriends])

  const sorted = [...profiles.values()].sort((a, b) => b.profile.xp - a.profile.xp)
  const leaderId = sorted[0]?.friend.id

  const feed = useMemo(() => {
    const events: { friend: Friend; badge: FriendBadge }[] = []
    for (const { friend, profile } of profiles.values()) {
      for (const b of profile.badgeEvents) events.push({ friend, badge: b })
    }
    return events.sort((a, b) => b.badge.earnedAt.localeCompare(a.badge.earnedAt)).slice(0, 10)
  }, [profiles])

  const pageRef = useRef<HTMLDivElement | null>(null)
  // Bumped on every pull-to-refresh so the leaderboard refetches too.
  const [refreshCount, setRefreshCount] = useState(0)
  const refreshAll = () => {
    setRefreshCount((c) => c + 1)
    if (!uid) return
    void Promise.all([refreshRequests(uid), refreshFriends(uid), refreshFeed(uid)])
  }
  const { pull, refreshing } = usePullToRefresh(pageRef, refreshAll)

  return (
    <div className="page friends" ref={pageRef}>
      <PullHint pull={pull} refreshing={refreshing} />
      <header className="page-head">
        <div className="bored-banner">👥 Your squad</div>
        <h1 className="page-title">Friends</h1>
        <p className="page-sub">Add your crew, compare quests, and keep up with each other's quests across South Africa.</p>
      </header>

      <div className="seg">
        <button className={`seg-btn ${tab === 'squad' ? 'seg-active' : ''}`} onClick={() => setTab('squad')}>
          👥 Squad <span className="seg-count">{friends.length}</span>
        </button>
        <button className={`seg-btn ${tab === 'leaderboard' ? 'seg-active' : ''}`} onClick={() => setTab('leaderboard')}>
          🏆 Leaderboard
        </button>
        <button className={`seg-btn ${tab === 'activity' ? 'seg-active' : ''}`} onClick={() => setTab('activity')}>
          🔔 Activity <span className="seg-count">{feed.length + feedEvents.length}</span>
        </button>
      </div>

      {tab === 'leaderboard' && <Leaderboard uid={uid} refreshKey={refreshCount} />}

      {tab === 'squad' ? (
        <>
          <SquadPanel realFriends={realFriends} />

          <section className="you-card">
            <div className="you-avatar">{youEmoji}</div>
            <div className="you-main">
              <div className="you-name">{playerName}</div>
              <div className="you-meta">
                Lv {progress.level} · {state.xp.toLocaleString()} XP · {playerQuests} quests · 🔥 {state.streak}-day streak
              </div>

            </div>
          </section>

          {synced && (
            <div className="sync-strip">☁️ Synced — search for friends by name below.</div>
          )}

          <div className="find-box">
            <input
              className="find-input"
              value={search}
              onChange={(e) => void runSearch(e.target.value)}
              placeholder="🔍 Find friends by name…"
              maxLength={30}
            />
            {searching && <div className="find-hint">Searching…</div>}
            {results.length > 0 && (
              <div className="find-results">
                {results.map((p) => (
                  <div className="find-row" key={p.id}>
                    <span className="find-avatar">{p.emoji}</span>
                    <div className="find-main">
                      <div className="find-name">{p.name}</div>
                      <div className="find-meta">
                        Level {p.level} · {p.xp.toLocaleString()} XP
                      </div>
                    </div>
                    <button className="find-add" onClick={() => void requestPerson(p)}>
                      📨 Request
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!searching && search.trim() && results.length === 0 && (
              <div className="find-hint">No one named “{search}” is on SideQuest yet.</div>
            )}
          </div>

          {friends.length === 0 && realFriends.length === 0 && incoming.length === 0 ? (
            <div className="empty-state">
              No friends yet. <b>Search for them by name</b> above and send a request — once they accept, their quests
              and stats sync in here.
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
      ) : tab === 'activity' ? (
        <>
          {feedEvents.length > 0 && (
            <section className="friends-feed">
              <h2 className="section-title">⚡ Live quest feed</h2>
              <p className="section-sub">Quests your squad just finished, straight from the database.</p>
              <div className="feed-list">
                {feedEvents.map((ev) => (
                  <button
                    className="feed-row"
                    key={`${ev.profileId}-${ev.questId}-${ev.completedAt}`}
                    onClick={() => setSelected({ id: ev.profileId, name: ev.name, emoji: ev.emoji, addedAt: ev.completedAt })}
                  >
                    <span className="feed-avatar">{ev.emoji}</span>
                    <span className="feed-main">
                      <span className="feed-text">
                        <strong>{ev.name}</strong> completed <strong>{ev.questTitle}</strong>
                        {ev.city ? ` in ${ev.city}` : ''}
                      </span>
                      <span className="feed-when">
                        {timeAgo(ev.completedAt)} · +{ev.xp} XP · tap to view {ev.name}'s profile
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {feed.length > 0 && (
            <section className="friends-feed">
              <h2 className="section-title">🎖️ Badge buzz</h2>
              <p className="section-sub">Friends crossing badge milestones.</p>
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

          {feedEvents.length === 0 && feed.length === 0 && (
            <div className="empty-state">
              No activity yet. When your friends complete quests, they'll show up here live.
            </div>
          )}

          <section className="friends-howto">
            <h2 className="section-title">💡 How friends work</h2>
            <p className="section-sub">
              Search for friends by name above and send a request. Once they accept, their quests and badges sync in
              live. Pull down anywhere to refresh.
            </p>
          </section>
        </>
      ) : null}

      {incoming.length > 0 && (
        <section className="incoming-requests">
          <h2 className="section-title">📨 Friend requests</h2>
          <p className="section-sub">These people want to be your friend — accept to sync real stats.</p>
          <div className="incoming-list">
            {incoming.map((req) => (
              <div className="incoming-row" key={req.id}>
                <span className="incoming-avatar">{req.senderEmoji}</span>
                <div className="incoming-main">
                  <div className="incoming-name">{req.senderName}</div>
                  <div className="incoming-meta">{req.senderXp.toLocaleString()} XP · Level {levelProgress(req.senderXp).level}</div>
                </div>
                <button className="incoming-accept" onClick={() => void accept(req)}>
                  ✓ Accept
                </button>
                <button className="incoming-decline" onClick={() => void decline(req)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {selected && (
        <FriendSheet
          friend={selected}
          profile={profiles.get(selected.id)!.profile}
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
  onRemove,
  onClose,
}: {
  friend: Friend
  profile: FriendProfile
  onRemove: () => void
  onClose: () => void
}) {
  const rank = rankFromXp(profile.xp)
  return (
    <Sheet onClose={onClose}>
      <div className="friend-sheet">
        <div className="sheet-eyebrow">👥 Friend</div>
        <div className="friend-sheet-hero">
          <span className="friend-sheet-avatar">{friend.emoji}</span>
          <div className="friend-sheet-name">{friend.name}</div>
          <div className="friend-sheet-level-pill">
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
            <h3 className="sheet-section-title">🎖️ Just earned</h3>
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
          <h3 className="sheet-section-title">🕑 Recent quests</h3>
          {profile.recent.length === 0 ? (
            <p className="sheet-empty-note">
              {friend.name} is on the synced build but hasn't shared quest history yet — their stats will fill in
              as they play.
            </p>
          ) : (
            profile.recent.map((a) => {
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
            })
          )}
        </div>

        <button className="remove-btn" onClick={onRemove}>
          🗑️ Remove friend
        </button>
      </div>
    </Sheet>
  )
}

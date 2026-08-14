import { useEffect, useState } from 'react'
import { fetchLeaderboard, type LeaderboardData, type LeaderboardScope } from '../lib/leaderboard'
import { levelProgress, rankFromXp } from '../lib/game'
import { useGame } from '../lib/store'
import { Chip } from './ui'

const LEVEL_EMOJI = ['🌱', '🌿', '🔥', '⚡', '🌟', '💎', '👑', '🦁', '🚀', '🌍', '🏆', '🇿🇦']

const SCOPES: { id: LeaderboardScope; label: string; emoji: string }[] = [
  { id: 'global', label: 'Global SA', emoji: '🌍' },
  { id: 'regional', label: 'Regional', emoji: '📍' },
  { id: 'friends', label: 'Friends', emoji: '👥' },
]

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard({ uid, refreshKey }: { uid: string | null; refreshKey: number }) {
  const { homeBaseId } = useGame()
  const [scope, setScope] = useState<LeaderboardScope>('global')
  const [data, setData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setFailed(false)
    void (async () => {
      if (!uid) {
        if (alive) {
          setData(null)
          setLoading(false)
        }
        return
      }
      const result = await fetchLeaderboard(uid, scope, homeBaseId)
      if (!alive) return
      setData(result)
      setFailed(result === null)
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [uid, scope, homeBaseId, refreshKey])

  const you = data?.you
  const youInList = data?.entries.some((e) => e.id === you?.id) ?? false

  const scopeHint = (): string => {
    if (scope === 'global') return 'Every SideQuester in South Africa, ranked by total XP.'
    if (scope === 'regional') {
      return data?.regionLabel
        ? `Players whose home base is near ${data.regionLabel} — your region and its neighbours.`
        : 'Players near your home base.'
    }
    return 'You and your friends, ranked by total XP.'
  }

  return (
    <section className="leaderboard">
      <div className="leaderboard-scopes">
        {SCOPES.map((s) => (
          <Chip key={s.id} label={s.label} emoji={s.emoji} active={scope === s.id} onClick={() => setScope(s.id)} />
        ))}
      </div>
      <p className="section-sub">{scopeHint()}</p>

      {loading ? (
        <p className="section-sub">⏳ Loading the leaderboard…</p>
      ) : failed || !data ? (
        <div className="empty-state">
          {uid
            ? "Couldn't load the leaderboard — check your connection and pull down to retry."
            : 'The leaderboard needs a connection — play a quest or two and come back online.'}
        </div>
      ) : data.entries.length === 0 ? (
        <div className="empty-state">
          {scope === 'friends'
            ? 'No friends on the board yet. Add friends from the Squad tab — their ranks show up here.'
            : 'No players found in this region yet.'}
        </div>
      ) : (
        <>
          <ol className="leaderboard-list">
            {data.entries.map((entry, i) => (
              <LeaderboardRow
                key={entry.id}
                rank={i + 1}
                entry={entry}
                isYou={entry.id === you?.id}
                showHome={scope === 'regional'}
              />
            ))}
          </ol>

          {you && !youInList && (
            <div className="leaderboard-you-pinned">
              <LeaderboardRow
                rank={data.yourRank ?? data.entries.length + 1}
                entry={you}
                isYou
                showHome={scope === 'regional'}
              />
              <p className="section-sub">
                {scope === 'global'
                  ? `You're outside the top ${data.entries.length} — keep questing to climb the board.`
                  : 'You were placed below the visible list.'}
              </p>
            </div>
          )}

          {scope === 'regional' && you && !data.yourRank && (
            <p className="section-sub">
              Your home base isn't part of this region, so you're not ranked here. Set a city home base on the
              Profile tab to join your regional board.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function LeaderboardRow({
  rank,
  entry,
  isYou,
  showHome,
}: {
  rank: number
  entry: { id: string; name: string; emoji: string; xp: number; streak: number; homeBaseLabel: string | null }
  isYou: boolean
  showHome: boolean
}) {
  const progress = levelProgress(entry.xp)
  const rankName = rankFromXp(entry.xp).rank.name
  const levelEmoji = LEVEL_EMOJI[Math.min(progress.level - 1, LEVEL_EMOJI.length - 1)]

  return (
    <li className={`leaderboard-row ${isYou ? 'leaderboard-row-you' : ''}`}>
      <span className="leaderboard-rank" aria-hidden="true">
        {rank <= 3 ? MEDALS[rank - 1] : rank}
      </span>
      <span className="leaderboard-avatar">{entry.emoji}</span>
      <span className="leaderboard-main">
        <span className="leaderboard-name">
          {entry.name}
          {isYou && <span className="leaderboard-you-tag">you</span>}
        </span>
        <span className="leaderboard-meta">
          {levelEmoji} Lv {progress.level} · {rankName}
          {showHome && entry.homeBaseLabel ? ` · ${entry.homeBaseLabel}` : ''} · 🔥 {entry.streak}
        </span>
      </span>
      <span className="leaderboard-xp">{entry.xp.toLocaleString()} XP</span>
    </li>
  )
}

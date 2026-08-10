import { useEffect, useState } from 'react'
import { CATEGORY_META, HOME_BASES, PROVINCES, type Category, type ProvinceId } from '../data/quests'
import { BADGES, completedCountByProvince, levelProgress, playerStats, rankFromXp, totalCompleted, totalQuestsInProvince, type BadgeDef, type Progress } from '../lib/game'
import { useGame } from '../lib/store'
import { checkForUpdate, downloadAndInstall, getCurrentVersion, isAndroid, type UpdateInfo } from '../lib/updater'
import { getAccountInfo, onAuthChange, signOutAccount, type AccountInfo } from '../lib/sync'
import SignIn from './SignIn'
import { Bar, Sheet } from './ui'

const LEVEL_EMOJI = ['🌱', '🌿', '🔥', '⚡', '🌟', '💎', '👑', '🦁', '🚀', '🌍', '🏆', '🇿🇦']

export default function Profile() {
  const { state, playerName, setPlayerName, homeBaseId, setHomeBaseId, startPlace, setStartPlace } = useGame()
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(playerName)
  const [selectedBadge, setSelectedBadge] = useState<BadgeDef | null>(null)

  const progress = levelProgress(state.xp)
  const levelEmoji = LEVEL_EMOJI[Math.min(progress.level - 1, LEVEL_EMOJI.length - 1)]
  const rank = rankFromXp(state.xp)

  const completedIds = Object.keys(state.completed).filter((id) => !id.startsWith('chain-') && !id.startsWith('s-'))
  const completedChainIds = Object.keys(state.completed).filter((id) => id.startsWith('chain-') || id.startsWith('s-'))
  const gameProgress = { completedIds, completedChainIds, xp: state.xp, streak: state.streak, entries: state.completed }
  const byProvince = completedCountByProvince(gameProgress)
  const total = totalCompleted(gameProgress)

  const home = HOME_BASES.find((b) => b.id === homeBaseId) ?? HOME_BASES[0]
  const stats = playerStats(state.completed, home)
  const favProv = stats.favProvince ? PROVINCES[stats.favProvince] : null
  const maxCat = Math.max(1, ...Object.values(stats.byCategory))
  const totalMin = Math.round(stats.hours * 60)
  const hoursText =
    totalMin === 0 ? '0 m' : totalMin >= 60 ? `${Math.floor(totalMin / 60)} h${totalMin % 60 ? ` ${totalMin % 60} m` : ''}` : `${totalMin} m`

  const saveName = () => {
    setPlayerName(nameDraft.trim() || 'SideQuester')
    setEditingName(false)
  }

  return (
    <div className="page profile">
      <header className="page-head">
        <h1 className="page-title">🏆 Your Profile</h1>
        <p className="page-sub">Every quest you complete maps a little more of South Africa.</p>
      </header>

      <section className="player-card">
        <div className="player-avatar">{levelEmoji}</div>
        <div className="player-info">
          {editingName ? (
            <div className="name-edit">
              <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} maxLength={20} autoFocus />
              <button className="name-save" onClick={saveName}>
                ✓
              </button>
            </div>
          ) : (
            <button className="player-name" onClick={() => { setNameDraft(playerName); setEditingName(true) }} title="Tap to edit">
              {playerName} ✏️
            </button>
          )}
          <div className="player-level">
            Level {progress.level} · <span className="player-streak">🔥 {state.streak}-day streak</span>
          </div>
          <div className="player-rank">
            <span className="player-rank-title">
              {rank.rank.emoji} {rank.rank.name}
            </span>
            {rank.next && (
              <span className="player-rank-next">
                {Math.max(0, rank.next.minXp - state.xp).toLocaleString()} XP to {rank.next.name}
              </span>
            )}
          </div>
          {rank.next && (
            <div className="rank-progress">
              <Bar pct={rank.pct} color="#a55eea" />
            </div>
          )}
          <div className="player-xp-row">
            <div className="player-xp-text">
              {progress.into.toLocaleString()} / {progress.needed.toLocaleString()} XP to level {progress.level + 1}
            </div>
            <div className="player-xp-total">{state.xp.toLocaleString()} XP total</div>
          </div>
          <Bar pct={progress.pct} />
          <div className="player-stats">
            <span>🗺️ {total} quests done</span>
            <span>🏅 {BADGES.filter((b) => b.earned(gameProgress)).length}/{BADGES.length} badges</span>
          </div>
        </div>
      </section>

      <section className="profile-section">
        <h2 className="section-title">📊 Stats dashboard</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-emoji">⏱️</span>
            <span className="stat-value">{hoursText}</span>
            <span className="stat-label">total quest time</span>
          </div>
          <div className="stat-card">
            <span className="stat-emoji">📍</span>
            <span className="stat-value">{stats.quests}</span>
            <span className="stat-label">places visited</span>
          </div>
          <div className="stat-card">
            <span className="stat-emoji">{favProv?.emoji ?? '🤔'}</span>
            <span className="stat-value">{favProv?.name ?? '—'}</span>
            <span className="stat-label">favourite province</span>
          </div>
        </div>

        <h3 className="stats-sub">Quests per category</h3>
        <div className="stats-cats">
          {(Object.keys(CATEGORY_META) as Category[]).map((cat) => {
            const meta = CATEGORY_META[cat]
            const count = stats.byCategory[cat]
            return (
              <div className="stats-cat-row" key={cat}>
                <span className="stats-cat-name">
                  {meta.emoji} {meta.label}
                </span>
                <div className="stats-cat-bar">
                  <div className="stats-cat-fill" style={{ width: `${(count / maxCat) * 100}%`, background: meta.color }} />
                </div>
                <span className="stats-cat-count">{count}</span>
              </div>
            )
          })}
        </div>
        {stats.quests === 0 && <p className="section-sub">Complete your first quest and these stats come alive.</p>}
      </section>

      <section className="profile-section">
        <h2 className="section-title">🇿🇦 South Africa completion</h2>
        <p className="section-sub">Finish quests in all 9 provinces to complete the country.</p>
        {Object.values(PROVINCES).map((prov) => {
          const done = byProvince[prov.id as ProvinceId]
          const totalInProv = totalQuestsInProvince(prov.id as ProvinceId)
          const pct = totalInProv === 0 ? 0 : done / totalInProv
          return (
            <div className="province-row" key={prov.id}>
              <span className="province-emoji">{prov.emoji}</span>
              <div className="province-main">
                <div className="province-top">
                  <span className="province-name">
                    {prov.name} <span className="province-badge-name">{prov.badge}</span>
                  </span>
                  <span className="province-count">
                    {done}/{totalInProv}
                  </span>
                </div>
                <Bar pct={pct} color={pct >= 1 ? 'var(--green)' : 'var(--gold)'} />
              </div>
            </div>
          )
        })}
      </section>

      <section className="profile-section">
        <h2 className="section-title">🎖️ Badges</h2>
        <div className="badge-grid">
          {BADGES.map((b) => {
            const earned = b.earned(gameProgress)
            return (
              <button key={b.id} className={`badge ${earned ? 'badge-earned' : 'badge-locked'}`} title={b.description} onClick={() => setSelectedBadge(b)}>
                <div className="badge-emoji">{earned ? b.emoji : '🔒'}</div>
                <div className="badge-name">{b.name}</div>
              </button>
            )
          })}
        </div>
        <p className="section-sub">Tap a badge for details and progress.</p>
      </section>

      {selectedBadge && (
        <BadgeSheet badge={selectedBadge} progress={gameProgress} onClose={() => setSelectedBadge(null)} />
      )}

      <section className="profile-section">
        <h2 className="section-title">📍 Home base</h2>
        {startPlace ? (
          <>
            <div className="home-base-current">
              📍 {startPlace.label}
              <span className="home-base-from">— the spot you chose on the map</span>
            </div>
            <button className="home-base-reset" onClick={() => setStartPlace(null)}>
              ↩ Reset to a city base
            </button>
            <p className="section-sub">Your exact home base — the generator and badges measure "how far" from here.</p>
          </>
        ) : (
          <>
            <select className="home-base-select" value={homeBaseId} onChange={(e) => setHomeBaseId(e.target.value)}>
              {HOME_BASES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
            <p className="section-sub">
              Pick any spot on the Map tab's 📍 Start picker (or use your location) to make it your exact home base.
            </p>
          </>
        )}
      </section>

      <section className="profile-section">
        <h2 className="section-title">📸 Quest memories</h2>
        {state.memories.length === 0 ? (
          <p className="section-sub">No memories yet. Complete a quest and save one — future you will thank you.</p>
        ) : (
          <div className="memory-list">
            {state.memories.map((m) => (
              <div className="memory-card" key={m.id}>
                <div className="memory-title">
                  {m.questTitle} <span className="memory-date">{new Date(m.at).toLocaleDateString()}</span>
                </div>
                <div className="memory-text">{m.text}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="profile-section">
        <AccountCard />
      </section>

      <section className="profile-section">
        <UpdateCard />
      </section>

      <section className="profile-section">
        <button
          className="reset-btn"
          onClick={() => {
            if (window.confirm('Reset all SideQuest progress? This clears XP, badges, memories and your home base.')) {
              localStorage.removeItem('sidequest-state-v1')
              window.location.reload()
            }
          }}
        >
          🗑️ Reset progress
        </button>
      </section>
    </div>
  )
}

function AccountCard() {
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSignIn, setShowSignIn] = useState(false)

  const load = async () => {
    setLoading(true)
    setAccount(await getAccountInfo())
    setLoading(false)
  }

  useEffect(() => {
    void load()
    const unsub = onAuthChange(() => void load())
    return unsub
  }, [])

  const doSignOut = async () => {
    await signOutAccount()
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="update-card">
        <h2 className="section-title">🔑 Account</h2>
        <p className="update-card-status">⏳ Loading…</p>
      </div>
    )
  }

  return (
    <div className="update-card">
      <h2 className="section-title">🔑 Account</h2>
      {account && !account.isAnonymous ? (
        <>
          <p className="update-card-version">
            ✅ Signed in as <b>{account.email ?? 'connected user'}</b>
          </p>
          <p className="update-card-status" style={{ fontSize: 12, color: 'var(--muted)' }}>
            Your stats are synced to your account — they survive reinstalls and work on any device.
          </p>
          <button className="update-btn" onClick={() => void doSignOut()}>
            🚪 Sign out
          </button>
        </>
      ) : (
        <>
          <p className="update-card-version">
            👋 {account?.isAnonymous === false ? 'Guest mode' : 'Offline mode'} — progress saved on this device only.
          </p>
          <p className="update-card-status" style={{ fontSize: 12, color: 'var(--muted)' }}>
            Create an account so your stats and friends follow you across devices and reinstalls.
          </p>
          <button className="update-btn update-btn-gold" onClick={() => setShowSignIn(true)}>
            📧 Create account / Sign in
          </button>
        </>
      )}
      {showSignIn && <SignIn onClose={() => setShowSignIn(false)} />}
    </div>
  )
}

function UpdateCard() {
  const [version, setVersion] = useState('…')
  const [status, setStatus] = useState<'idle' | 'checking' | 'latest' | 'available' | 'error'>('idle')
  const [info, setInfo] = useState<UpdateInfo | null>(null)

  useEffect(() => {
    void getCurrentVersion().then(setVersion)
  }, [])

  const check = async () => {
    setStatus('checking')
    const found = await checkForUpdate()
    if (found) {
      setInfo(found)
      setStatus('available')
    } else {
      setStatus('latest')
    }
  }

  const install = async () => {
    if (!info) return
    setStatus('checking')
    try {
      await downloadAndInstall(info)
      setStatus('latest')
    } catch (e) {
      setInfo(null)
      setStatus('error')
    }
  }

  return (
    <div className="update-card">
      <h2 className="section-title">🔄 About & updates</h2>
      <p className="update-card-version">
        📍 SIDEQUEST <b>v{version}</b>
        {isAndroid() ? ' · Android app' : ' · web build (refresh for updates)'}
      </p>
      {status === 'idle' && (
        <button className="update-btn" onClick={() => void check()}>
          🔍 Check for updates
        </button>
      )}
      {status === 'checking' && <p className="update-card-status">⏳ Checking for updates…</p>}
      {status === 'latest' && (
        <p className="update-card-status">✓ You're on the latest version{info ? ` (installed v${info.latest})` : ''}.</p>
      )}
      {status === 'available' && info && (
        <div className="update-available">
          <p className="update-card-status">⬇️ Update available: v{info.latest} (you're on v{info.current}).</p>
          <button className="update-btn update-btn-gold" onClick={() => void install()}>
            ⬇️ Install v{info.latest}
          </button>
        </div>
      )}
      {status === 'error' && (
        <div className="update-available">
          <p className="update-card-status">⚠️ Couldn't install the update — check your connection and try again.</p>
          <button className="update-btn" onClick={() => void check()}>
            ↻ Try again
          </button>
        </div>
      )}
    </div>
  )
}

function BadgeSheet({ badge, progress, onClose }: { badge: BadgeDef; progress: Progress; onClose: () => void }) {
  const earned = badge.earned(progress)
  const prog = badge.progress ? badge.progress(progress) : null
  const rem = prog ? Math.max(0, prog.target - prog.done) : null

  return (
    <Sheet onClose={onClose}>
      <div className="badge-sheet">
        <div className={`badge-sheet-hero ${earned ? 'badge-sheet-hero-earned' : ''}`}>
          <div className="badge-sheet-emoji">{earned ? badge.emoji : '🔒'}</div>
          <h3 className="badge-sheet-name">{badge.name}</h3>
          <p className="badge-sheet-desc">{badge.description}</p>
        </div>

        {earned ? (
          <div className="badge-sheet-status badge-sheet-status-earned">
            {prog?.earnedAt
              ? `✓ Earned on ${new Date(prog.earnedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
              : '✓ Earned'}
          </div>
        ) : (
          <div className="badge-sheet-status badge-sheet-status-locked">🔒 Not earned yet</div>
        )}

        {prog && (
          <div className="badge-sheet-progress">
            <div className="badge-progress-top">
              <span>
                {prog.done} / {prog.target}
              </span>
              <span>{Math.round((prog.done / prog.target) * 100)}%</span>
            </div>
            <Bar pct={prog.target > 0 ? prog.done / prog.target : 0} />
            {!earned && rem !== null && (
              <p className="badge-sheet-need">
                {rem === 1 ? 'Just 1 more quest to unlock this.' : `You need ${rem} more quests to unlock this.`}
              </p>
            )}
          </div>
        )}

        {!prog && !earned && <p className="badge-sheet-need">Keep questing to unlock this badge.</p>}
      </div>
    </Sheet>
  )
}

import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { HOME_BASES } from '../data/quests'
import { levelProgress, rankFromXp, totalCompleted, type Progress } from '../lib/game'
import { taglineOfTheDay } from '../lib/taglines'
import { useGame } from '../lib/store'
import { ensureIdentity, syncCompletions, syncProfile } from '../lib/sync'
import { usePullToRefresh } from '../lib/usePullToRefresh'
import { Icon } from './Icon'
import PullHint from './PullHint'

export default function Home() {
  const navigate = useNavigate()
  const { state, homeBaseId, startPlace } = useGame()

  // Pull down to re-sync stats from the server (a fresh launch-equivalent).
  const pageRef = useRef<HTMLDivElement | null>(null)
  const refresh = () => {
    void (async () => {
      const uid = await ensureIdentity()
      if (!uid) return
      await syncProfile(uid, state)
      await syncCompletions(uid, state)
    })()
  }
  const { pull, refreshing } = usePullToRefresh(pageRef, refresh)

  const completedIds = Object.keys(state.completed).filter((id) => !id.startsWith('chain-') && !id.startsWith('s-'))
  const completedChainIds = Object.keys(state.completed).filter((id) => id.startsWith('chain-') || id.startsWith('s-'))
  const progress: Progress = {
    completedIds,
    completedChainIds,
    xp: state.xp,
    streak: state.streak,
    entries: state.completed,
  }
  const total = totalCompleted(progress)
  const rank = rankFromXp(state.xp)
  const level = levelProgress(state.xp).level

  return (
    <div className="page home" ref={pageRef}>
      <PullHint pull={pull} refreshing={refreshing} />
      <header className="home-hero">
        <div className="intro-logo">📍</div>
        <p className="home-greeting">
          Molo, <strong>{state.playerName}</strong> 👋
        </p>
        <h1 className="intro-title">
          SIDEQUEST <span className="intro-flag">🇿🇦</span>
          <span className="beta-chip">BETA</span>
        </h1>
        <div className="intro-byline">by Jacy</div>
        <p className="intro-tagline">Life is the main quest. Go find the side quests.</p>
        <p className="home-hero-sub">
          A lunch break, a long weekend, a road trip — wherever you are, there's a quest waiting: a kota in Soweto, a
          waterfall in KZN, a park you've never heard of.
        </p>
      </header>

      <section className="home-panel">
        <div className="home-stats">
          <button className="home-stat" onClick={() => navigate('/profile')}>
            <span className="home-stat-value">{total}</span>
            <span className="home-stat-label">quests done</span>
          </button>
          <button className="home-stat" onClick={() => navigate('/profile')}>
            <span className="home-stat-value">{state.xp.toLocaleString()}</span>
            <span className="home-stat-label">XP</span>
          </button>
          <button className="home-stat" onClick={() => navigate('/profile')}>
            <span className="home-stat-value">
              {state.streak} <span className="home-stat-fire">🔥</span>
            </span>
            <span className="home-stat-label">day streak</span>
          </button>
        </div>
        <div className="home-rank" onClick={() => navigate('/profile')}>
          🎖️ {rank.rank.emoji} {rank.rank.name} · Level {level}
          {rank.next ? ` · ${Math.max(0, rank.next.minXp - state.xp).toLocaleString()} XP to ${rank.next.name}` : ''}
        </div>
        <button className="home-cta" onClick={() => navigate('/map')}>
          <Icon name="map" size={18} />
          Explore the map
          <Icon name="arrow-right" size={18} />
        </button>
      </section>

      <section className="home-quick">
        <h2 className="section-title">Quick start</h2>
        <div className="home-quick-grid">
          <button className="home-action" onClick={() => navigate('/map')}>
            <span className="home-action-icon"><Icon name="map" size={22} /></span>
            <span className="home-action-main">
              <span className="home-action-title">Explore</span>
              <span className="home-action-sub">Browse every quest on the map</span>
            </span>
          </button>
          <button className="home-action" onClick={() => navigate('/feed')}>
            <span className="home-action-icon"><Icon name="feed" size={22} /></span>
            <span className="home-action-main">
              <span className="home-action-title">I'm bored</span>
              <span className="home-action-sub">Scroll the quest feed — shuffle for surprises</span>
            </span>
          </button>
          <button className="home-action" onClick={() => navigate('/builder')}>
            <span className="home-action-icon"><Icon name="build" size={22} /></span>
            <span className="home-action-main">
              <span className="home-action-title">Build</span>
              <span className="home-action-sub">Make your own multi-stop quest</span>
            </span>
          </button>
          <button className="home-action" onClick={() => navigate('/friends')}>
            <span className="home-action-icon"><Icon name="friends" size={22} /></span>
            <span className="home-action-main">
              <span className="home-action-title">Squad</span>
              <span className="home-action-sub">Friends, rivalries & live activity</span>
            </span>
          </button>
        </div>
      </section>

      <p className="home-foot">
        Home base: {startPlace?.label ?? HOME_BASES.find((b) => b.id === homeBaseId)?.label ?? homeBaseId} · Made in South Africa 🇿🇦
        <span className="home-tagline">{taglineOfTheDay()}</span>
      </p>
    </div>
  )
}

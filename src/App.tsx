import { useEffect, useMemo, useRef } from 'react'
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import ChainBuilder from './components/ChainBuilder'
import Friends from './components/Friends'
import Generator from './components/Generator'
import Home from './components/Home'
import MapScreen from './components/MapScreen'
import ActiveQuest from './components/ActiveQuest'
import CompletionModal from './components/CompletionModal'
import Profile from './components/Profile'
import UpdateBanner from './components/UpdateBanner'
import UpdatedNotice from './components/UpdatedNotice'
import { QuestSheet } from './components/QuestSheet'
import { ALL_QUESTS, type Chain, type Quest } from './data/quests'
import { decodeChainShare } from './lib/share'
import { useGame } from './lib/store'
import { ensureIdentity, subscribeIncomingRequests, syncCompletions, syncProfile } from './lib/sync'

export default function App() {
  const { state } = useGame()
  const [searchParams, setSearchParams] = useSearchParams()

  // ── Sync: sign in anonymously, push real stats, listen for friend requests ──
  const uidRef = useRef<string | null>(null)
  const pushedRef = useRef(false)
  useEffect(() => {
    let unsub: (() => void) | null = null
    let cancelled = false
    void (async () => {
      const uid = await ensureIdentity()
      if (cancelled) return
      uidRef.current = uid
      if (!uid) return
      // Push everything on launch (idempotent), then keep the profile fresh.
      await syncCompletions(uid, state)
      await syncProfile(uid, state)
      pushedRef.current = true
      unsub = subscribeIncomingRequests(uid, () => {
        // A request arrived — refetch and surface it via the friends screen.
        window.dispatchEvent(new CustomEvent('sidequest:friend-request'))
      })
    })()
    return () => {
      cancelled = true
      unsub?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Push stat changes as they happen (debounced — the game fires many updates).
  useEffect(() => {
    const uid = uidRef.current
    if (!uid || !pushedRef.current) return
    const t = window.setTimeout(() => {
      void syncProfile(uid, state)
      void syncCompletions(uid, state)
    }, 1500)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.xp, state.streak, state.playerName, state.completed])

  // A friend's shared chain arrives as ?chain=… — decode it once and show it.
  const shared = useMemo(() => {
    const raw = searchParams.get('chain')
    if (!raw) return null
    const decoded = decodeChainShare(raw)
    if (!decoded) return null
    const quests = decoded.q
      .map((id) => ALL_QUESTS.find((q) => q.id === id))
      .filter((q): q is Quest => Boolean(q))
    if (quests.length < 1) return null
    const first = quests[0]
    const chain: Chain = {
      id: `shared-${raw.slice(0, 12)}`,
      title: decoded.t,
      emoji: decoded.e,
      province: first.province,
      city: first.city,
      region: first.region,
      lat: first.lat,
      lng: first.lng,
      vibe: first.vibe,
      description:
        quests.length === 1
          ? 'A single quest, sent by a SideQuester. Accept the challenge — then make it your own.'
          : `${quests.length} stops, hand-assembled and shared by a SideQuester. Accept the challenge — then make it your own.`,
      completionLine: 'You took on a friend\'s quest. The streets of South Africa remember your name.',
      xpBonus: 150,
      steps: quests.map((q) => ({ questId: q.id })),
    }
    return chain
  }, [searchParams])

  const challenger = searchParams.get('from')

  return (
    <div className="app">
      <UpdateBanner />
      <UpdatedNotice />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/map" element={<MapScreen />} />
        <Route path="/generate" element={<Generator />} />
        <Route path="/builder" element={<ChainBuilder />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
      <ActiveQuest />
      <CompletionModal />
      {shared && (
        <QuestSheet
          chain={shared}
          banner={challenger ? `🎁 ${challenger} challenged you with this quest!` : '🎁 A friend shared this quest with you!'}
          onClose={() => setSearchParams({})}
        />
      )}
    </div>
  )
}

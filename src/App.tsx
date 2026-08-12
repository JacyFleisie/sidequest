import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from './lib/supabase'
import BottomNav from './components/BottomNav'
import ChainBuilder from './components/ChainBuilder'
import Friends from './components/Friends'
import Generator from './components/Generator'
import Home from './components/Home'
import MapScreen from './components/MapScreen'
import ActiveQuest from './components/ActiveQuest'
import CompletionModal from './components/CompletionModal'
import Profile from './components/Profile'
import ResetPassword from './components/ResetPassword'
import UpdateBanner from './components/UpdateBanner'
import UpdatedNotice from './components/UpdatedNotice'
import { initPushNotifications, setPushActionHandler } from './lib/push'
import { QuestSheet } from './components/QuestSheet'
import { ALL_QUESTS, type Chain, type Quest } from './data/quests'
import { decodeChainShare } from './lib/share'
import { useGame } from './lib/store'
import {
  ensureIdentity,
  fetchIncomingRequests,
  handleAuthCallback,
  subscribeIncomingRequests,
  syncCompletions,
  syncProfile,
} from './lib/sync'
import { fetchMySquad, subscribeSquad } from './lib/squads'

export default function App() {
  const { state } = useGame()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [recovery, setRecovery] = useState(false)

  // Realtime notification toasts — surfaced wherever you are in the app, and
  // tapping one jumps to the Friends screen.
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([])
  const pushToast = useCallback((text: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text }].slice(-3))
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000)
  }, [])

  // ── Password reset: a recovery email link starts a recovery session ───────
  useEffect(() => {
    if (!supabase) return
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Sync: sign in anonymously, push real stats, listen for friend requests ──
  const uidRef = useRef<string | null>(null)
  const pushedRef = useRef(false)
  const unsubSquadRef = useRef<(() => void) | null>(null)
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
      // Register for FCM so releases, friend requests and challenges arrive
      // even when the app is closed. Tapping a request/challenge push lands on
      // the Friends tab (the in-app toast already covers the open-app case).
      setPushActionHandler((data) => {
        if (
          data.type === 'friend-request' ||
          data.type === 'challenge' ||
          data.type === 'friend-accepted' ||
          data.type === 'challenge-accepted'
        ) {
          navigate('/friends')
        }
      })
      void initPushNotifications()
      unsub = subscribeIncomingRequests(uid, () => {
        // A request arrived — surface it instantly, wherever the app is open.
        window.dispatchEvent(new CustomEvent('sidequest:friend-request'))
        void (async () => {
          const reqs = await fetchIncomingRequests(uid)
          const latest = reqs[0]
          if (latest) pushToast(`${latest.senderEmoji} ${latest.senderName} sent you a friend request`)
        })()
      })
      // Squad membership: keeps the +20% XP bonus live everywhere in the app
      // (not just while the Friends tab is open) and refreshes on any roster
      // change or disband.
      void fetchMySquad(uid)
      const unsubSquad = subscribeSquad(uid, () => void fetchMySquad(uid))
      unsubSquadRef.current = unsubSquad
    })()
    return () => {
      cancelled = true
      unsub?.()
      unsubSquadRef.current?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Google OAuth deep-link callback (Android) ──────────────────────────────
  // Google redirects to com.jacy.sidequest://auth/callback; Android re-opens
  // the app and hands us the URL. Exchange the PKCE code, then reload so the
  // whole app re-syncs against the new identity.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const handle = (url: string) => {
      if (!url.includes('auth/callback')) return
      void handleAuthCallback(url).then((ok) => {
        if (ok) window.location.href = '/' // hard reload → fresh sync
      })
    }
    const listener = CapApp.addListener('appUrlOpen', (data) => handle(data.url))
    void CapApp.getLaunchUrl().then((res) => {
      if (res?.url) handle(res.url)
    })
    return () => {
      void listener.then((l) => l.remove())
    }
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
      <div className="notif-toasts">
        {toasts.map((t) => (
          <button
            key={t.id}
            className="notif-toast"
            onClick={() => {
              setToasts((x) => x.filter((y) => y.id !== t.id))
              navigate('/friends')
            }}
          >
            {t.text}
          </button>
        ))}
      </div>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/map" element={<MapScreen />} />
        <Route path="/feed" element={<Generator />} />
        {/* Old /generate links (shared quests, bookmarks) redirect to the new route. */}
        <Route path="/generate" element={<Navigate to="/feed" replace />} />
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
      {recovery && <ResetPassword onClose={() => setRecovery(false)} />}
    </div>
  )
}

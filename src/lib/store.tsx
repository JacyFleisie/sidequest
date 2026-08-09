import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ALL_QUESTS, CHAINS, questById, type Chain, type Quest } from '../data/quests'
import { levelFromXp, rankFromXp } from './game'

// ── Types ────────────────────────────────────────────────────────────────────
export interface CompletedEntry {
  at: string
  xp: number
  weather?: import('./game').WeatherKind
  distFromHomeKm?: number
}

export interface Memory {
  id: string
  questId: string
  questTitle: string
  text: string
  at: string
}

export interface SessionStep {
  questId: string
  questTitle: string
  questEmoji: string
  questCity: string
  done: boolean
  xp: number
}

export interface ActiveSession {
  id: string
  title: string
  emoji: string
  kind: 'quest' | 'chain'
  sourceChainId?: string
  steps: SessionStep[]
  totalXp: number
  startedAt: string
}

export interface LastCompletion {
  title: string
  emoji: string
  questId: string
  xp: number
  line: string
  steps: string[]
  at: string
  leveledUp: boolean
  newLevel?: number
  newRank?: { name: string; emoji: string }
}

export interface StartPlace {
  label: string
  lat: number
  lng: number
}

export interface CustomChain {
  id: string
  title: string
  emoji: string
  questIds: string[]
  createdAt: string
}

export interface Friend {
  id: string
  name: string
  emoji: string
  addedAt: string
}

interface PersistedState {
  version: number
  playerName: string
  homeBaseId: string
  startPlace: StartPlace | null
  xp: number
  streak: number
  lastQuestDate: string | null
  completed: Record<string, CompletedEntry>
  memories: Memory[]
  activeSession: ActiveSession | null
  lastCompletion: LastCompletion | null
  seenIntro: boolean
  customChains: CustomChain[]
  friends: Friend[]
  recentGenerated: string[] // quest ids suggested lately, so the generator avoids repeats
}

const DEFAULT_STATE: PersistedState = {
  version: 1,
  playerName: 'SideQuester',
  homeBaseId: 'jhb',
  startPlace: null,
  xp: 0,
  streak: 0,
  lastQuestDate: null,
  completed: {},
  memories: [],
  activeSession: null,
  lastCompletion: null,
  seenIntro: false,
  customChains: [],
  friends: [],
  recentGenerated: [],
}

const KEY = 'sidequest-state-v1'

const load = (): PersistedState => {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_STATE
    return { ...DEFAULT_STATE, ...(JSON.parse(raw) as PersistedState) }
  } catch {
    return DEFAULT_STATE
  }
}

const hash = (s: string): number => {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 1000
  return h
}

const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const uid = (): string => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

// ── Context ──────────────────────────────────────────────────────────────────
interface GameApi {
  state: PersistedState
  playerName: string
  homeBaseId: string
  startPlace: StartPlace | null
  xp: number
  streak: number
  completed: Record<string, CompletedEntry>
  startQuest: (quest: Quest) => void
  startChain: (chain: Chain) => void
  startGenerated: (quests: Quest[], title: string, emoji: string) => void
  completeActiveSession: (meta?: { weather?: import('./game').WeatherKind; distFromHomeKm?: Record<string, number> }) => void
  abandonActiveSession: () => void
  dismissCompletion: () => void
  addMemory: (questId: string, text: string) => void
  setPlayerName: (name: string) => void
  setHomeBaseId: (id: string) => void
  setStartPlace: (place: StartPlace | null) => void
  setSeenIntro: () => void
  customChains: CustomChain[]
  recentGenerated: string[]
  recordGenerated: (questIds: string[]) => void
  saveCustomChain: (chain: CustomChain) => void
  deleteCustomChain: (id: string) => void
  startCustomChain: (chain: CustomChain) => void
  friends: Friend[]
  addFriend: (friend: Friend) => void
  removeFriend: (id: string) => void
}

const GameContext = createContext<GameApi | null>(null)

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<PersistedState>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // storage full or unavailable — play on without persistence
    }
  }, [state])

  const api = useMemo<GameApi>(() => {
    const makeSession = (
      id: string,
      title: string,
      emoji: string,
      kind: 'quest' | 'chain',
      quests: Quest[],
      bonusXp: number,
      sourceChainId?: string,
    ): ActiveSession => ({
      id,
      title,
      emoji,
      kind,
      sourceChainId,
      steps: quests.map((x) => ({
        questId: x.id,
        questTitle: x.title,
        questEmoji: x.emoji,
        questCity: x.city,
        done: false,
        xp: x.xp,
      })),
      totalXp: quests.reduce((a, x) => a + x.xp, 0) + bonusXp,
      startedAt: new Date().toISOString(),
    })

    return {
      state,
      playerName: state.playerName,
      homeBaseId: state.homeBaseId,
      startPlace: state.startPlace,
      xp: state.xp,
      streak: state.streak,
      completed: state.completed,
      recentGenerated: state.recentGenerated,

      recordGenerated: (questIds: string[]) =>
        setState((s) => ({
          ...s,
          recentGenerated: [...new Set([...questIds, ...s.recentGenerated])].slice(0, 18),
        })),

      startQuest: (quest: Quest) =>
        setState((s) => ({
          ...s,
          activeSession: makeSession(uid(), quest.title, quest.emoji, 'quest', [quest], 0),
        })),

      startChain: (chain: Chain) => {
        const quests = chain.steps.map((st) => questById(st.questId))
        setState((s) => ({
          ...s,
          activeSession: makeSession(chain.id, chain.title, chain.emoji, 'chain', quests, chain.xpBonus, chain.id),
        }))
      },

      startGenerated: (quests: Quest[], title: string, emoji: string) =>
        setState((s) => ({
          ...s,
          activeSession: makeSession(uid(), title, emoji, 'chain', quests, 150),
        })),

      customChains: state.customChains,
      friends: state.friends,

      addFriend: (friend: Friend) =>
        setState((s) => {
          if (s.friends.some((f) => f.id === friend.id)) return s
          return { ...s, friends: [...s.friends, friend] }
        }),

      removeFriend: (id: string) => setState((s) => ({ ...s, friends: s.friends.filter((f) => f.id !== id) })),

      saveCustomChain: (chain: CustomChain) =>
        setState((s) => {
          const exists = s.customChains.some((c) => c.id === chain.id)
          return {
            ...s,
            customChains: exists
              ? s.customChains.map((c) => (c.id === chain.id ? chain : c))
              : [chain, ...s.customChains].slice(0, 50),
          }
        }),

      deleteCustomChain: (id: string) =>
        setState((s) => ({ ...s, customChains: s.customChains.filter((c) => c.id !== id) })),

      startCustomChain: (chain: CustomChain) => {
        const quests = chain.questIds.map((id) => ALL_QUESTS.find((x) => x.id === id)).filter((x): x is Quest => Boolean(x))
        if (quests.length === 0) return
        setState((s) => ({
          ...s,
          activeSession: makeSession(chain.id, chain.title, chain.emoji, 'chain', quests, 150, chain.id),
        }))
      },

      completeActiveSession: (meta?: { weather?: import('./game').WeatherKind; distFromHomeKm?: Record<string, number> }) => {
        const session = state.activeSession
        if (!session) return
        const today = dateKey(new Date())
        const yesterday = dateKey(new Date(Date.now() - 86400000))

        let streak = state.streak
        if (state.lastQuestDate !== today) {
          streak = state.lastQuestDate === yesterday ? streak + 1 : 1
        }

        const completed = { ...state.completed }
        let awarded = 0
        const stepXpTotal = session.steps.reduce((a, st) => a + st.xp, 0)

        for (const step of session.steps) {
          if (!completed[step.questId]) {
            completed[step.questId] = {
              at: new Date().toISOString(),
              xp: step.xp,
              weather: meta?.weather,
              distFromHomeKm: meta?.distFromHomeKm?.[step.questId],
            }
            awarded += step.xp
          }
        }

        // The session "head": a real chain id or a synthetic generated-chain id.
        // Its own XP contribution is whatever isn't already covered by its steps.
        const bonus = session.totalXp - stepXpTotal
        const headId = session.kind === 'chain' ? session.sourceChainId ?? session.id : null
        if (headId) {
          if (!completed[headId]) {
            completed[headId] = { at: new Date().toISOString(), xp: bonus }
            awarded += bonus
          }
        } else if (session.kind === 'quest' && !completed[session.steps[0].questId]) {
          // Single quest: the step loop already counted it.
        }

        const beforeRank = rankFromXp(state.xp)
        const afterRank = rankFromXp(state.xp + awarded)
        const before = levelFromXp(state.xp)
        const after = levelFromXp(state.xp + awarded)

        let line = 'You completed a SideQuest. The map of South Africa thanks you.'
        if (session.kind === 'quest') line = questById(session.steps[0].questId).completionLine
        if (session.kind === 'chain' && session.sourceChainId) {
          const chain = CHAINS.find((c) => c.id === session.sourceChainId)
          if (chain) line = chain.completionLine
        } else if (session.kind === 'chain') {
          const lines = [
            'You completed a quest with no meaning and it meant everything. Statistically proven.',
            'The generator speaks. The generator is pleased. Go lie down.',
            'You followed a random sequence of events and survived. Legend status unlocked.',
            'Somewhere, a bored algorithm is proud of you.',
          ]
          line = lines[hash(session.id) % lines.length]
        }

        const completion: LastCompletion = {
          title: session.title,
          emoji: session.emoji,
          questId: headId ?? session.steps[0].questId,
          xp: awarded,
          line,
          steps: session.steps.map((st) => `${st.questEmoji} ${st.questTitle}`),
          at: new Date().toISOString(),
          leveledUp: after > before,
          newLevel: after > before ? after : undefined,
          newRank: afterRank.rank.name !== beforeRank.rank.name ? { name: afterRank.rank.name, emoji: afterRank.rank.emoji } : undefined,
        }

        setState((s) => ({
          ...s,
          xp: s.xp + awarded,
          streak,
          lastQuestDate: today,
          completed,
          activeSession: null,
          lastCompletion: completion,
        }))
      },

      abandonActiveSession: () => setState((s) => ({ ...s, activeSession: null })),

      dismissCompletion: () => setState((s) => ({ ...s, lastCompletion: null })),

      addMemory: (questId: string, text: string) =>
        setState((s) => {
          const quest = ALL_QUESTS.find((x) => x.id === questId)
          return {
            ...s,
            memories: [
              { id: uid(), questId, questTitle: quest?.title ?? 'SideQuest', text, at: new Date().toISOString() },
              ...s.memories,
            ].slice(0, 100),
          }
        }),

      setPlayerName: (name: string) => setState((s) => ({ ...s, playerName: name })),

      setHomeBaseId: (id: string) => setState((s) => ({ ...s, homeBaseId: id })),

      setStartPlace: (place: StartPlace | null) => setState((s) => ({ ...s, startPlace: place })),

      setSeenIntro: () => setState((s) => ({ ...s, seenIntro: true })),
    }
  }, [state])

  return <GameContext.Provider value={api}>{children}</GameContext.Provider>
}

export const useGame = (): GameApi => {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}

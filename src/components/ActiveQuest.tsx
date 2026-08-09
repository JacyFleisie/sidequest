import { useEffect, useState } from 'react'
import { ALL_QUESTS, HOME_BASES, questById } from '../data/quests'
import { fetchWeather, fmtDuration, getDevicePosition, haversineKm } from '../lib/game'
import { useGame } from '../lib/store'
import { Button, Sheet } from './ui'

const RADIUS_KM = 5

export default function ActiveQuest() {
  const { state, completeActiveSession, abandonActiveSession } = useGame()
  const [open, setOpen] = useState(false)
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set())
  const [locating, setLocating] = useState(false)
  const [proximity, setProximity] = useState<Record<string, number> | null>(null)
  const [locSource, setLocSource] = useState<'device' | 'assumed' | null>(null)
  const [blocked, setBlocked] = useState(false)

  const session = state.activeSession

  // Resolve the player's position: device GPS first, else their typed start
  // location, else their home base.
  const resolvePosition = async (): Promise<{ pos: { lat: number; lng: number }; source: 'device' | 'assumed' }> => {
    const dev = await getDevicePosition()
    if (dev) return { pos: dev, source: 'device' }
    const assumed =
      state.startPlace ??
      (() => {
        const b = HOME_BASES.find((x) => x.id === state.homeBaseId) ?? HOME_BASES[0]
        return { lat: b.lat, lng: b.lng }
      })()
    return { pos: assumed, source: 'assumed' }
  }

  const stepDistances = (pos: { lat: number; lng: number }): Record<string, number> => {
    const out: Record<string, number> = {}
    for (const s of session?.steps ?? []) {
      const q = questById(s.questId)
      out[s.questId] = q ? haversineKm(pos.lat, pos.lng, q.lat, q.lng) : 0
    }
    return out
  }

  // Passive proximity check when the sheet opens, so badges are live.
  useEffect(() => {
    if (!session || !open) return
    let alive = true
    void (async () => {
      const { pos, source } = await resolvePosition()
      if (!alive) return
      setProximity(stepDistances(pos))
      setLocSource(source)
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.id])

  if (!session) return null

  const totalDuration = session.steps.reduce((a, s) => a + questDuration(s.questId), 0)
  const doneCount = doneSteps.size

  const toggleStep = (i: number) => {
    setDoneSteps((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const handleFinish = async () => {
    setLocating(true)
    setBlocked(false)
    const { pos, source } = await resolvePosition()
    setLocSource(source)
    const dists = stepDistances(pos)
    setProximity(dists)
    setLocating(false)

    const outOfRange = session.steps.filter((s) => (dists[s.questId] ?? 0) > RADIUS_KM)
    if (outOfRange.length > 0) {
      setBlocked(true)
      return
    }

    // Record the context of this completion for badges: weather where you are
    // (free Open-Meteo) and each stop's distance from your home base — which is
    // the exact spot chosen on the map when one is set.
    const homePos = state.startPlace ?? HOME_BASES.find((x) => x.id === state.homeBaseId) ?? HOME_BASES[0]
    const distFromHomeKm: Record<string, number> = {}
    for (const s of session.steps) {
      const q = questById(s.questId)
      distFromHomeKm[s.questId] = q ? haversineKm(homePos.lat, homePos.lng, q.lat, q.lng) : 0
    }
    const weather = await fetchWeather(pos.lat, pos.lng)
    completeActiveSession({ weather, distFromHomeKm })
  }

  const near = (questId: string): boolean => (proximity?.[questId] ?? 0) <= RADIUS_KM
  const outOfRangeSteps = proximity
    ? session.steps.filter((s) => (proximity[s.questId] ?? 0) > RADIUS_KM)
    : []

  return (
    <>
      <button className="active-banner" onClick={() => setOpen(true)}>
        <span className="active-banner-emoji">▶️</span>
        <span className="active-banner-title">
          {session.emoji} {session.title}
        </span>
        <span className="active-banner-progress">
          {doneCount}/{session.steps.length} steps
        </span>
      </button>

      {open && (
        <Sheet onClose={() => setOpen(false)} wide>
          <div className="active-head">
            <div className="active-emoji">{session.emoji}</div>
            <h2 className="active-title">{session.title}</h2>
            <p className="active-sub">
              {session.kind === 'chain' ? 'Multi-stop quest' : 'SideQuest'} · started{' '}
              {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="active-steps">
            {session.steps.map((s, i) => {
              const km = proximity ? proximity[s.questId] : null
              return (
                <button key={s.questId} className={`active-step ${doneSteps.has(i) ? 'active-step-done' : ''}`} onClick={() => toggleStep(i)}>
                  <span className="active-step-check">{doneSteps.has(i) ? '✅' : '⬜'}</span>
                  <span className="active-step-main">
                    <span className="active-step-title">
                      {s.questEmoji} {s.questTitle}
                    </span>
                    <span className="active-step-meta">
                      {s.questCity} · {fmtDuration(questDuration(s.questId))} · +{s.xp} XP
                    </span>
                    <span className={`active-step-prox ${km !== null && near(s.questId) ? 'active-prox-near' : km !== null ? 'active-prox-far' : ''}`}>
                      {locating && proximity === null
                        ? '📡 locating…'
                        : km === null
                          ? '📍 checking…'
                          : near(s.questId)
                            ? '📍 you are here'
                            : `📍 ${km.toFixed(1)} km away`}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="active-stats">
            <span>⏱️ ~{fmtDuration(totalDuration)}</span>
            <span>🏆 +{session.totalXp} XP</span>
          </div>

          <div className="active-loc-note">
            📍 Must be within {RADIUS_KM} km of every stop to finish
            {locSource === 'device' ? ' · verified with device GPS' : locSource === 'assumed' ? ' · using your start location (device GPS unavailable)' : ''}
          </div>

          {blocked && (
            <div className="active-block">
              <strong>⛔ Not close enough yet.</strong>
              <span>
                {outOfRangeSteps.map((s) => (
                  <span key={s.questId} className="active-block-line">
                    {s.questEmoji} {s.questTitle} — {(proximity?.[s.questId] ?? 0).toFixed(1)} km away
                  </span>
                ))}
              </span>
              <span className="active-block-hint">Get to the stops above, then finish again.</span>
            </div>
          )}

          <Button className="finish-btn" onClick={handleFinish} disabled={locating}>
            {locating ? '📡 Checking location…' : '🎉 FINISH QUEST'}
          </Button>
          <button className="abandon-btn" onClick={abandonActiveSession}>
            Abandon quest (no shame)
          </button>
        </Sheet>
      )}
    </>
  )
}

const questDuration = (id: string): number => ALL_QUESTS.find((q) => q.id === id)?.durationMin ?? 60

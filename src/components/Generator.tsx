import { useMemo, useState } from 'react'
import { HOME_BASES, VIBE_META, chainStats, type Vibe } from '../data/quests'
import { fmtCost, fmtDuration, generateQuest, getUserLocation, nearestBase, type GeneratorInput } from '../lib/game'
import { useGame, type StartPlace } from '../lib/store'
import LocationPicker from './LocationPicker'
import { Button, QuestStats, Stat } from './ui'

type PeopleValue = 1 | 2 | 4 | 8
type TimeValue = 15 | 30 | 120 | 300 | 600
type DistanceValue = '500m' | '2km' | '5km' | '20km' | 'anywhere'

const PEOPLE = [
  { emoji: '👤', label: 'Just me', value: 1 },
  { emoji: '👥', label: '2', value: 2 },
  { emoji: '👥👥', label: '3–5', value: 4 },
  { emoji: '👨‍👩‍👧‍👦', label: '6+', value: 8 },
]
const TIME = [
  { emoji: '⚡', label: '15 min', value: 15 },
  { emoji: '🕐', label: '30 min', value: 30 },
  { emoji: '🕑', label: '1–2 hrs', value: 120 },
  { emoji: '🌇', label: '3–5 hrs', value: 300 },
  { emoji: '🌙', label: 'Whole day', value: 600 },
]
const BUDGET = [
  { emoji: '🤑', label: 'R0', value: 0 },
  { emoji: '💰', label: 'R50', value: 50 },
  { emoji: '💵', label: 'R100', value: 100 },
  { emoji: '💳', label: 'R250', value: 250 },
  { emoji: '💸', label: "Doesn't matter", value: Infinity },
]
const DISTANCE = [
  { emoji: '📍', label: '500 m', value: '500m' },
  { emoji: '📍', label: '2 km', value: '2km' },
  { emoji: '📍', label: '5 km', value: '5km' },
  { emoji: '🚗', label: '20 km', value: '20km' },
  { emoji: '🛣️', label: 'Anywhere', value: 'anywhere' },
]
const VIBES = Object.entries(VIBE_META) as [Vibe, { label: string; emoji: string }][]

const STEP_LABELS = ['People', 'Time', 'Budget', 'Distance', 'Vibe']

export default function Generator() {
  const { homeBaseId, setHomeBaseId, startPlace, setStartPlace, startGenerated, startQuest, startChain, recentGenerated, recordGenerated } = useGame()
  const [step, setStep] = useState(0)
  const [people, setPeople] = useState<PeopleValue>(4)
  const [time, setTime] = useState<TimeValue>(120)
  const [budget, setBudget] = useState<number>(100)
  const [distance, setDistance] = useState<DistanceValue>('5km')
  const [vibe, setVibe] = useState<Vibe | null>(null)
  const [result, setResult] = useState<ReturnType<typeof generateQuest> | null>(null)

  const base = HOME_BASES.find((b) => b.id === homeBaseId) ?? HOME_BASES[0]
  const startLabel = startPlace?.label ?? base.label
  const startCoords = startPlace ?? { label: base.label, lat: base.lat, lng: base.lng }

  const pickStart = (place: StartPlace) => {
    setStartPlace(place)
    setHomeBaseId(nearestBase(place.lat, place.lng).id)
  }

  const useMyLocation = () => {
    getUserLocation(
      (latitude, longitude) => {
        const nearest = nearestBase(latitude, longitude)
        setStartPlace({ label: nearest.label, lat: latitude, lng: longitude })
        setHomeBaseId(nearest.id)
      },
      () => {},
    )
  }

  const input: GeneratorInput = useMemo(
    () => ({
      people,
      maxMinutes: time,
      budget,
      distanceTier: distance,
      vibe: vibe ?? 'random',
      base,
      exclude: recentGenerated.length > 0 ? new Set(recentGenerated) : undefined,
      customCoords: startPlace
        ? { lat: startPlace.lat, lng: startPlace.lng, label: startPlace.label }
        : undefined,
    }),
    [people, time, budget, distance, vibe, base, startPlace, recentGenerated],
  )

  const findQuest = (override?: Partial<GeneratorInput>) => {
    const result = generateQuest({ ...input, ...override })
    // Remember what we suggested so the next roll doesn't repeat it.
    const suggested = [
      ...(result.generated?.quests ?? []).map((q) => q.id),
      ...result.singles.map((q) => q.id),
    ]
    if (suggested.length > 0) recordGenerated(suggested)
    setResult(result)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (result) {
    return (
      <div className="page generator-result">
        <header className="page-head">
          <button className="text-btn" onClick={() => setResult(null)}>
            ← Tweak choices
          </button>
          <h1 className="page-title">🎮 YOUR SIDEQUEST</h1>
          <p className="page-sub">
            {result.matchedCount} quests found {result.nearbyLabel === 'South Africa' ? 'across South Africa' : `near ${result.nearbyLabel}`}
          </p>
        </header>

        {result.generated && (
          <section className="generated-card">
            <div className="generated-head">
              <span className="generated-emoji">{result.generated.emoji}</span>
              <div>
                <h2 className="generated-title">{result.generated.title}</h2>
                <p className="generated-sub">A chain of {result.generated.quests.length} SideQuests · starting in {startCoords.label}</p>
              </div>
            </div>
            <div className="generated-steps">
              {result.generated.quests.map((q, i) => (
                <div className="gen-step" key={q.id}>
                  <div className="gen-step-num">{i + 1}</div>
                  <div className="gen-step-main">
                    <div className="gen-step-title">
                      {q.emoji} {q.title}
                    </div>
                    <div className="gen-step-meta">
                      {q.city} · {fmtDuration(q.durationMin)} · {fmtCost(q.cost)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="generated-stats">
              <Stat icon="⏱️" label="Total time" value={fmtDuration(result.generated.durationMin)} />
              <Stat icon="💰" label="Per person" value={fmtCost(result.generated.cost)} />
              <Stat icon="👥" label="Players" value={`${result.generated.players[0]}–${result.generated.players[1]}`} />
              <Stat icon="🏆" label="XP" value={`+${result.generated.xp}`} />
            </div>
            <Button
              className="accept-btn"
              onClick={() =>
                startGenerated(result.generated!.quests, result.generated!.title, result.generated!.emoji)
              }
            >
              ⚡ ACCEPT QUEST
            </Button>
          </section>
        )}

        {result.featured && (
          <section className="featured-card">
            <div className="featured-head">
              <span className="featured-emoji">{result.featured.emoji}</span>
              <div>
                <h2 className="featured-title">🇿🇦 Featured: {result.featured.title}</h2>
                <p className="featured-sub">
                  {result.featured.city} · {result.featured.steps.length} stops · hand-crafted multi-stop quest
                </p>
              </div>
            </div>
            <QuestStats
              durationMin={chainStats(result.featured).durationMin}
              cost={chainStats(result.featured).cost}
              players={chainStats(result.featured).players}
            />
            <Button variant="ghost" className="accept-btn" onClick={() => startChain(result.featured!)}>
              ▶ START FEATURED QUEST
            </Button>
          </section>
        )}

        {result.singles.length > 0 && (
          <section className="singles">
            <h2 className="section-title">💡 More ideas near you</h2>
            {result.singles.map((q) => (
              <div className="single-card" key={q.id}>
                <div className="single-emoji">{q.emoji}</div>
                <div className="single-main">
                  <div className="single-title">{q.title}</div>
                  <div className="single-meta">
                    {q.city} · {fmtDuration(q.durationMin)} · {fmtCost(q.cost)} · +{q.xp} XP
                  </div>
                </div>
                <button className="single-start" onClick={() => startQuest(q)}>
                  ▶
                </button>
              </div>
            ))}
          </section>
        )}

        {!result.generated && result.singles.length === 0 && !result.featured && (
          <div className="empty-state">
            <p>Nothing matched your exact choices — South Africa still loves you.</p>
            {result.nearMisses.length > 0 && (
              <div className="near-misses">
                <p className="near-misses-title">Closest quests outside your range:</p>
                {result.nearMisses.map(({ quest, reason }) => (
                  <div className="near-miss" key={quest.id}>
                    <span className="near-miss-emoji">{quest.emoji}</span>
                    <span className="near-miss-main">
                      <span className="near-miss-title">{quest.title}</span>
                      <span className="near-miss-reason">{reason}</span>
                    </span>
                  </div>
                ))}
                <p className="near-misses-hint">Tweak your budget, time or distance to pull these in.</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const steps = [
    {
      title: 'How many people?',
      options: PEOPLE.map((o) => ({ ...o, active: people === o.value, onPick: () => { setPeople(o.value as PeopleValue); advance() } })),
    },
    {
      title: 'How long?',
      options: TIME.map((o) => ({ ...o, active: time === o.value, onPick: () => { setTime(o.value as TimeValue); advance() } })),
    },
    {
      title: 'Budget per person?',
      options: BUDGET.map((o) => ({ ...o, active: budget === o.value, onPick: () => { setBudget(o.value); advance() } })),
    },
    {
      title: 'How far are you willing to go?',
      options: DISTANCE.map((o) => ({ ...o, active: distance === o.value, onPick: () => { setDistance(o.value as DistanceValue); advance() } })),
    },
    {
      title: 'What vibe?',
      options: VIBES.map(([v, meta]) => ({
        emoji: meta.emoji,
        label: meta.label,
        active: vibe === v,
        onPick: () => { setVibe(v); advance({ vibe: v }) },
      })),
    },
  ]
  const current = steps[step]

  const advance = (override?: Partial<GeneratorInput>) => {
    if (step < steps.length - 1) {
      setStep((s) => s + 1)
    } else {
      findQuest(override)
    }
  }

  return (
    <div className="page generator">
      <header className="page-head">
        <div className="bored-banner">😐 WE'RE BORED</div>
        <h1 className="page-title">The SideQuest Generator</h1>
        <p className="page-sub">Answer 5 quick questions and we'll build your adventure.</p>
      </header>

      <div className="generator-start">
        <label className="field-label">Starting from</label>
        <LocationPicker
          currentLabel={startLabel}
          custom={Boolean(startPlace)}
          onPick={pickStart}
          onUseMyLocation={useMyLocation}
          onReset={() => setStartPlace(null)}
        />
      </div>

      <div className="stepper">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className={`stepper-item ${i === step ? 'stepper-active' : ''} ${i < step ? 'stepper-done' : ''}`}>
            <span className="stepper-dot">{i < step ? '✓' : i + 1}</span>
            <span className="stepper-label">{label}</span>
          </div>
        ))}
      </div>

      <div key={step} className="step-card">
        <h2 className="step-title">{current.title}</h2>
        <div className={`option-grid ${step === 4 ? 'option-grid-vibes' : ''}`}>
          {current.options.map((o, i) => (
            <button key={i} className={`option-btn ${o.active ? 'option-active' : ''}`} onClick={o.onPick}>
              <span className="option-emoji">{o.emoji}</span>
              <span className="option-label">{o.label}</span>
            </button>
          ))}
        </div>
        <div className="step-nav">
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              ← Back
            </Button>
          )}
          {step === 4 && (
            <Button onClick={findQuest} className="find-btn">
              🎲 FIND SIDEQUEST
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HOME_BASES } from '../data/quests'
import { getUserLocation, nearestBase, reverseGeocodeLabel } from '../lib/game'
import { useGame } from '../lib/store'

// Fun, student-y starter names the shuffle button cycles through.
const STARTER_NAMES = [
  'SideQuester', 'Rooikat', 'Bokkie', 'Saffa', 'Mzansi', 'Kagiso', 'Naledi',
  'Lerato', 'Thabo', 'Sipho', 'Zola', 'Laaitie', 'Jozi', 'Durbs', 'Kaapie',
  'Springbok', 'Cheetah', 'Bra Vibes', 'Sun City', 'Cape Crusader',
]

export default function Onboarding() {
  const navigate = useNavigate()
  const { setPlayerName, setHomeBaseId, setStartPlace, setOnboarded } = useGame()

  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState(() => STARTER_NAMES[Math.floor(Math.random() * STARTER_NAMES.length)])
  const [selectedBase, setSelectedBase] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)

  const shuffle = () => {
    const others = STARTER_NAMES.filter((n) => n !== name)
    setName(others[Math.floor(Math.random() * others.length)])
  }

  const useMyLocation = () => {
    setLocError(null)
    setLocating(true)
    getUserLocation(
      (lat, lng) => {
        const nearest = nearestBase(lat, lng)
        setSelectedBase(nearest.id)
        void reverseGeocodeLabel(lat, lng).then((label) => {
          setStartPlace({ label, lat, lng })
          setLocating(false)
        })
      },
      (msg) => {
        setLocError(msg)
        setLocating(false)
      },
    )
  }

  const finish = () => {
    setPlayerName(name.trim() || 'SideQuester')
    if (selectedBase) setHomeBaseId(selectedBase)
    setOnboarded()
    navigate('/map')
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        {step === 1 ? (
          <>
            <div className="onboarding-hero">
              <div className="onboarding-logo">🗺️</div>
              <h1 className="onboarding-title">SIDEQUEST 🇿🇦</h1>
              <p className="onboarding-slogan">Your life is the main story. South Africa is your map.</p>
            </div>

            <label className="onboarding-label" htmlFor="sq-onboard-name">
              What do we call you, explorer?
            </label>
            <div className="onboarding-name-row">
              <input
                id="sq-onboard-name"
                className="onboarding-input"
                value={name}
                maxLength={20}
                placeholder="Your quest name"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) setStep(2)
                }}
              />
              <button className="onboarding-shuffle" onClick={shuffle} title="Surprise me">
                🎲
              </button>
            </div>
            <p className="onboarding-hint">Friends will see this name when you sync. Change it anytime in Profile.</p>

            <button className="btn btn-gold onboarding-next" disabled={!name.trim()} onClick={() => setStep(2)}>
              Continue →
            </button>
          </>
        ) : (
          <>
            <div className="onboarding-hero onboarding-hero-small">
              <h1 className="onboarding-title">📍 Where's home base?</h1>
              <p className="onboarding-slogan">This is your starting point — quest distances measure from here.</p>
            </div>

            <button className="btn btn-primary onboarding-locate" onClick={useMyLocation} disabled={locating}>
              {locating ? '📡 Finding you…' : '📡 Use my location'}
            </button>
            {locError && <p className="onboarding-error">{locError}</p>}

            <div className="onboarding-bases">
              {HOME_BASES.map((b) => (
                <button
                  key={b.id}
                  className={`onboarding-base${selectedBase === b.id ? ' selected' : ''}`}
                  onClick={() => {
                    setSelectedBase(b.id)
                    setStartPlace(null) // a tapped city overrides any GPS pick
                  }}
                >
                  {selectedBase === b.id ? '✓ ' : ''}
                  {b.label}
                </button>
              ))}
            </div>
            <p className="onboarding-hint">Or tap a city. You can change this anytime.</p>

            <button className="btn btn-gold onboarding-next" disabled={!selectedBase} onClick={finish}>
              Start exploring →
            </button>
          </>
        )}
      </div>
    </div>
  )
}

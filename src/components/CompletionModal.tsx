import { useState } from 'react'
import { useGame } from '../lib/store'
import { Button, Sheet } from './ui'

const CONFETTI = ['🎉', '✨', '🎊', '⭐', '🇿🇦', '🏆']

export default function CompletionModal() {
  const { state, dismissCompletion, addMemory } = useGame()
  const [memory, setMemory] = useState('')

  const completion = state.lastCompletion
  if (!completion) return null

  const saveMemory = () => {
    if (memory.trim()) {
      addMemory(completion.questId, memory.trim())
      setMemory('')
    }
    dismissCompletion()
  }

  return (
    <Sheet onClose={dismissCompletion}>
      <div className="completion">
        <div className="confetti" aria-hidden>
          {CONFETTI.map((c, i) => (
            <span key={i} style={{ left: `${8 + i * 12}%`, animationDelay: `${i * 0.18}s` }}>
              {c}
            </span>
          ))}
        </div>

        <div className="completion-emoji">{completion.emoji}</div>
        <div className="completion-kicker">QUEST COMPLETE 🎉</div>
        <h2 className="completion-title">{completion.title}</h2>

        <div className="completion-xp">
          <span className="completion-xp-value">+{completion.xp} XP</span>
          {completion.leveledUp && completion.newLevel && (
            <span className="completion-levelup">⬆ LEVEL UP! You're level {completion.newLevel}</span>
          )}
          {completion.newRank && (
            <span className="completion-rankup">
              🏅 NEW RANK: {completion.newRank.emoji} {completion.newRank.name}
            </span>
          )}
        </div>

        <p className="completion-line">"{completion.line}"</p>

        {completion.steps.length > 1 && (
          <div className="completion-steps">
            {completion.steps.map((s) => (
              <div key={s} className="completion-step">
                {s}
              </div>
            ))}
          </div>
        )}

        <div className="completion-memory">
          <input
            className="memory-input"
            placeholder="Add a memory… e.g. 'Jacy fell off the pool table'"
            value={memory}
            onChange={(e) => setMemory(e.target.value)}
            maxLength={140}
          />
          <Button variant="gold" onClick={saveMemory}>
            Save memory
          </Button>
        </div>

        <Button onClick={dismissCompletion} className="completion-done">
          Done 🏆
        </Button>
      </div>
    </Sheet>
  )
}

import { createPortal } from 'react-dom'
import { ALL_QUESTS, CATEGORY_META, PROVINCES, VIBE_META, chainStats, type Chain, type Quest } from '../data/quests'
import { fmtDuration, recommendPct } from '../lib/game'
import { useGame } from '../lib/store'
import { Button, QuestStats, Sheet, Tag } from './ui'

export const QuestSheet = ({
  quest,
  chain,
  onClose,
  banner,
}: {
  quest?: Quest
  chain?: Chain
  onClose: () => void
  banner?: string
}) => {
  const { completed, startQuest, startChain } = useGame()

  if (!quest && !chain) return null

  const isChain = Boolean(chain)
  const stats = chain ? chainStats(chain) : null
  const done = quest ? Boolean(completed[quest.id]) : false
  const meta = quest ? CATEGORY_META[quest.category] : null
  const proofId = quest?.id ?? chain?.id ?? ''
  const title = quest?.title ?? chain?.title ?? ''
  const emoji = quest?.emoji ?? chain?.emoji ?? '📍'
  const location = quest
    ? `${quest.city} · ${quest.provinceName}`
    : chain
      ? `${chain.city} · ${PROVINCES[chain.province].name}`
      : ''
  const description = quest?.description ?? chain?.description ?? ''
  const vibe = quest?.vibe ?? chain?.vibe ?? []

  return createPortal(
    <Sheet onClose={onClose} wide={isChain}>
      {banner && <div className="sheet-banner">{banner}</div>}
      <div className="quest-sheet-hero" style={{ background: meta ? `${meta.color}22` : '#ffd23f22' }}>
        <div className="quest-sheet-emoji">{emoji}</div>
        {quest?.trending || chain?.trending ? <span className="trending-badge">🔥 TRENDING</span> : null}
      </div>

      <div className="quest-sheet-body">
        <div className="quest-sheet-title-row">
          <h2 className="quest-sheet-title">{title}</h2>
          {done && <span className="completed-badge">✓ DONE</span>}
        </div>
        <div className="quest-sheet-location">📍 {location}</div>

        <div className="quest-sheet-tags">
          {meta && (
            <span className="cat-badge" style={{ background: `${meta.color}22`, color: meta.color, borderColor: meta.color }}>
              {meta.emoji} {meta.label}
            </span>
          )}
          {vibe.map((v) => (
            <Tag key={v}>
              {VIBE_META[v].emoji} {VIBE_META[v].label}
            </Tag>
          ))}
        </div>

        <p className="quest-sheet-desc">{description}</p>
        {quest?.purpose && (
          <p className="quest-purpose">
            <strong>Purpose:</strong> {quest.purpose}
          </p>
        )}

        {isChain && chain && (
          <div className="chain-steps">
            <h3 className="chain-steps-title">🧩 Quest stops</h3>
            {chain.steps.map((st, i) => {
              const q = questsById[st.questId]
              return (
                <div className="chain-step" key={st.questId}>
                  <div className="chain-step-num">{i + 1}</div>
                  <div>
                    <div className="chain-step-title">
                      {q?.emoji} {q?.title ?? st.questId}
                    </div>
                    <div className="chain-step-note">
                      {st.note ?? ''} {q ? `· ${fmtDuration(q.durationMin)}` : ''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <QuestStats
          durationMin={quest?.durationMin ?? stats?.durationMin ?? 0}
          cost={quest?.cost ?? stats?.cost ?? 0}
          players={quest?.players ?? stats?.players ?? [1, 1]}
          difficulty={quest?.difficulty}
        />

        <div className="social-proof">
          <span>🔥 {proofCount(proofId).toLocaleString()} people completed this</span>
          <span>❤️ {recommendPct(proofId)}% would recommend</span>
        </div>

        <Button
          className="start-btn"
          onClick={() => {
            if (quest) startQuest(quest)
            if (chain) startChain(chain)
            onClose()
          }}
        >
          {done ? '▶ START AGAIN' : '▶ START QUEST'}
        </Button>
      </div>
    </Sheet>,
    document.body,
  )
}

const questsById: Record<string, Quest | undefined> = Object.fromEntries(ALL_QUESTS.map((q) => [q.id, q]))

const proofCount = (id: string): number => {
  let h = 0
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 4000
  return 120 + h
}

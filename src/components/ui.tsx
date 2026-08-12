import type { ReactNode } from 'react'
import { difficultyStars, fmtCost, fmtDuration } from '../lib/game'

export const Button = ({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className = '',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'gold'
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
}) => (
  <button type={type} className={`btn btn-${variant} ${className}`} onClick={onClick} disabled={disabled}>
    {children}
  </button>
)

export const Stat = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <div className="stat" title={label}>
    <span className="stat-icon">{icon}</span>
    <span className="stat-value">{value}</span>
  </div>
)

export const QuestStats = ({
  durationMin,
  cost,
  players,
  difficulty,
  costLabel,
}: {
  durationMin: number
  cost: number
  players: [number, number]
  difficulty?: number
  /** Overrides the 💰 stat — used to show the real ticket price on events. */
  costLabel?: string
}) => (
  <div className="stat-row">
    <Stat icon="⏱️" label="Duration" value={fmtDuration(durationMin)} />
    <Stat icon="💰" label="Cost per person" value={costLabel ?? fmtCost(cost)} />
    <Stat icon="👥" label="Players" value={players[0] === players[1] ? `${players[0]}` : `${players[0]}–${players[1]}`} />
    {difficulty !== undefined && <Stat icon="⭐" label="Difficulty" value={difficultyStars(difficulty)} />}
  </div>
)

export const Bar = ({ pct, color = 'var(--gold)' }: { pct: number; color?: string }) => (
  <div className="bar">
    <div className="bar-fill" style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%`, background: color }} />
  </div>
)

export const Sheet = ({
  children,
  onClose,
  wide,
}: {
  children: ReactNode
  onClose?: () => void
  wide?: boolean
}) => (
  <div className="sheet-overlay" onClick={onClose}>
    <div
      className={`sheet ${wide ? 'sheet-wide' : ''}`}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      {onClose && (
        <button className="sheet-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
      )}
      {children}
    </div>
  </div>
)

export const Tag = ({ children }: { children: ReactNode }) => <span className="tag">{children}</span>

export const Chip = ({
  label,
  emoji,
  active,
  color,
  onClick,
}: {
  label: string
  emoji?: string
  active: boolean
  color?: string
  onClick: () => void
}) => (
  <button
    className={`chip ${active ? 'chip-active' : ''}`}
    style={active && color ? { borderColor: color, color, background: `${color}1a` } : undefined}
    onClick={onClick}
  >
    {emoji && <span>{emoji}</span>}
    {label}
  </button>
)

export const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="section-title">{children}</h2>
)

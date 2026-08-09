import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', label: 'Home', emoji: '🏠' },
  { to: '/map', label: 'Map', emoji: '🗺️' },
  { to: '/generate', label: 'Generate', emoji: '🎲' },
  { to: '/builder', label: 'Build', emoji: '🔧' },
  { to: '/friends', label: 'Friends', emoji: '👥' },
  { to: '/profile', label: 'Profile', emoji: '🏆' },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}
          end={t.to === '/'}
        >
          <span className="nav-emoji">{t.emoji}</span>
          <span className="nav-label">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

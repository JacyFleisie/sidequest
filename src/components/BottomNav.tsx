import { NavLink } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Home', icon: 'home' },
  { to: '/map', label: 'Map', icon: 'map' },
  { to: '/feed', label: 'Feed', icon: 'feed' },
  { to: '/builder', label: 'Build', icon: 'build' },
  { to: '/friends', label: 'Friends', icon: 'friends' },
  { to: '/profile', label: 'Profile', icon: 'profile' },
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
          <span className="nav-icon">
            <Icon name={t.icon} size={22} />
          </span>
          <span className="nav-label">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

import type { ReactNode } from 'react'

/**
 * UI icon set. Consistent 24px grid, 1.8 stroke, `currentColor` — so icons
 * inherit whatever color their context uses (nav active state, buttons…).
 * Emojis stay for quest *content*; these are for app chrome.
 */
const S = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

export type IconName =
  | 'home'
  | 'map'
  | 'feed'
  | 'build'
  | 'friends'
  | 'profile'
  | 'search'
  | 'close'
  | 'edit'
  | 'chevron-down'
  | 'locate'
  | 'sparkles'
  | 'arrow-right'

export const Icon = ({ name, size = 22 }: { name: IconName; size?: number }) => (
  <span className="icon" style={{ width: size, height: size }}>
    <S>
      {name === 'home' && (
        <>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </>
      )}
      {name === 'map' && (
        <>
          <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
          <path d="M9 4v14M15 6v14" />
        </>
      )}
      {name === 'feed' && (
        <>
          <rect x="4" y="3" width="16" height="18" rx="2.5" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </>
      )}
      {name === 'build' && (
        <>
          <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4L15 12l-3-3 2.7-2.7Z" />
        </>
      )}
      {name === 'friends' && (
        <>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.2A5.5 5.5 0 0 1 20.5 19" />
        </>
      )}
      {name === 'profile' && (
        <>
          <path d="M7 4.5 4 6.8v6.2c0 3.6 3.4 6.5 8 6.5s8-2.9 8-6.5V6.8l-3-2.3" />
          <path d="M4 6.8 7 4.5l5 3 5-3 3 2.3" />
          <path d="M12 7.5v12" />
        </>
      )}
      {name === 'search' && (
        <>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4.4-4.4" />
        </>
      )}
      {name === 'close' && <path d="m6 6 12 12M18 6 6 18" />}
      {name === 'edit' && (
        <>
          <path d="M4 20h4L20 8l-4-4L4 16v4Z" />
          <path d="m13.5 6.5 4 4" />
        </>
      )}
      {name === 'chevron-down' && <path d="m6 9 6 6 6-6" />}
      {name === 'locate' && (
        <>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </>
      )}
      {name === 'sparkles' && (
        <>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
          <path d="M12 7.5 13.4 11 17 12.5 13.4 14 12 17.5 10.6 14 7 12.5 10.6 11 12 7.5Z" />
        </>
      )}
      {name === 'arrow-right' && <path d="M4 12h16m-6-6 6 6-6 6" />}
    </S>
  </span>
)

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Optional custom fallback (e.g. a themed card). Defaults to the built-in one. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/**
 * Catches render-time errors anywhere in the tree so a single broken screen
 * shows a friendly "something broke" card instead of a blank white screen.
 * The app is fully client-side, so a render crash would otherwise take the
 * whole UI down with no recovery — this keeps the chrome (bottom nav, etc.)
 * mountable and offers a one-tap reset.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface it for debugging; the app has no remote logger yet (see health report).
    console.error('[ErrorBoundary] render crash:', error.message, info.componentStack)
  }

  private reset = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)
    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary-card">
          <div className="error-boundary-emoji">🧯</div>
          <h2 className="error-boundary-title">SideQuest hit a snag</h2>
          <p className="error-boundary-sub">
            Something went wrong while showing this screen. Your progress is safe on this device — try again before reloading.
          </p>
          <pre className="error-boundary-detail">{error.message}</pre>
          <button className="error-boundary-btn" onClick={this.reset}>
            ↻ Try again
          </button>
        </div>
      </div>
    )
  }
}

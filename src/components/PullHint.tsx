import { PULL_THRESHOLD } from '../lib/usePullToRefresh'

/**
 * The shared pull-to-refresh indicator. Rendered as the first child of a
 * page's root; when `overlay` it floats above the content (used on the map,
 * where the page has no document flow).
 */
export default function PullHint({
  pull,
  refreshing,
  overlay = false,
}: {
  pull: number
  refreshing: boolean
  overlay?: boolean
}) {
  return (
    <div
      className={`feed-pull ${overlay ? 'pull-overlay' : ''} ${refreshing ? 'feed-pull-refreshing' : pull > 0 ? 'feed-pull-visible' : ''}`}
      style={{
        height: refreshing ? 52 : pull,
        transition: pull > 0 && !refreshing ? 'none' : 'height 0.25s ease, opacity 0.2s ease',
      }}
    >
      {refreshing ? <span className="feed-pull-spin">⟳</span> : pull >= PULL_THRESHOLD ? 'Release to refresh' : '⬇️ Pull to refresh'}
    </div>
  )
}

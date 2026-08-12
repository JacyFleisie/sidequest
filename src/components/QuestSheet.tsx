import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { ALL_QUESTS, CATEGORY_META, EVENT_TYPE_META, HOME_BASES, PROVINCES, VIBE_META, chainStats, type Chain, type Quest } from '../data/quests'
import { fmtDuration, getUserLocation } from '../lib/game'
import { deleteReview, fetchReviews, reportReview, submitReview, type QuestReview, type ReviewStats } from '../lib/reviews'
import { ensureIdentity, isNativePlatform } from '../lib/sync'
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
  const { completed, startQuest, startChain, homeBaseId, startPlace } = useGame()

  if (!quest && !chain) return null

  const isChain = Boolean(chain)
  const stats = chain ? chainStats(chain) : null
  const done = quest ? Boolean(completed[quest.id]) : false
  const meta = quest ? CATEGORY_META[quest.category] : null
  const title = quest?.title ?? chain?.title ?? ''
  const emoji = quest?.emoji ?? chain?.emoji ?? '📍'
  const location = quest
    ? quest.anywhere
      ? 'Anywhere'
      : `${quest.city} · ${quest.provinceName}`
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

        {quest && !quest.anywhere && !isChain && (
          <Directions from={{ lat: quest.lat, lng: quest.lng }} fallbackFrom={startPlace} homeBaseId={homeBaseId} />
        )}

        {quest && <TicketBox quest={quest} />}

        {quest && <Reviews questId={quest.id} canReview={done} />}

        <Button
          className="start-btn"
          onClick={() => {
            if (quest) startQuest(quest)
            if (chain) startChain(chain)
            onClose()
          }}
        >
          {done ? '▶ Start again' : '▶ Start quest'}
        </Button>
      </div>
    </Sheet>,
    document.body,
  )
}

const questsById: Record<string, Quest | undefined> = Object.fromEntries(ALL_QUESTS.map((q) => [q.id, q]))

// ── Directions: drive time + Google Maps / Waze ─────────────────────────────

function Directions({
  from,
  fallbackFrom,
  homeBaseId,
}: {
  from: { lat: number; lng: number }
  fallbackFrom: { label: string; lat: number; lng: number } | null
  homeBaseId: string
}) {
  const [driveMin, setDriveMin] = useState<number | null>(null)
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    let alive = true
    const base = HOME_BASES.find((b) => b.id === homeBaseId) ?? HOME_BASES[0]
    // Prefer the real device location; fall back to the player's home base.
    getUserLocation(
      (lat, lng) => {
        if (!alive) return
        setOrigin({ lat, lng })
        void estimateDrive(lat, lng, from.lat, from.lng).then((m) => alive && setDriveMin(m))
      },
      () => {
        if (!alive) return
        const o = fallbackFrom ?? { lat: base.lat, lng: base.lng }
        setOrigin(o)
        void estimateDrive(o.lat, o.lng, from.lat, from.lng).then((m) => alive && setDriveMin(m))
      },
    )
    return () => {
      alive = false
    }
  }, [from.lat, from.lng, homeBaseId]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = (url: string) => {
    if (isNativePlatform()) window.open(url, '_system')
    else window.open(url, '_blank', 'noopener')
  }

  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${from.lat},${from.lng}${origin ? `&origin=${origin.lat},${origin.lng}` : ''}`
  const waze = `https://waze.com/ul?ll=${from.lat},${from.lng}&navigate=yes`

  return (
    <div className="quest-directions">
      <div className="directions-row">
        <span className="directions-label">🛣️ {driveMin === null ? 'Getting drive time…' : fmtDrive(driveMin)}</span>
        <span className="directions-actions">
          <a href={gmaps} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); open(gmaps) }}>
            🗺️ Google Maps
          </a>
          <a href={waze} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.preventDefault(); open(waze) }}>
            🧭 Waze
          </a>
        </span>
      </div>
      <p className="directions-note">Opens turn-by-turn directions in the app on your phone.</p>
    </div>
  )
}

// ── Tickets: price + exactly where to buy + a get-tickets link ─────────────

/** Whole days until an ISO deadline; negative when it has passed. */
const daysUntil = (iso: string): number => {
  const ms = new Date(iso).getTime() - Date.now()
  return Math.ceil(ms / 86_400_000)
}

function TicketCountdown({ quest }: { quest: Quest }) {
  const deadline = quest.startsAt ?? quest.expiresAt
  if (!deadline) return null
  const days = daysUntil(deadline)
  const isEvent = quest.startsAt !== undefined
  if (days < 0) {
    return <p className="tickets-countdown passed">⏳ This event has passed</p>
  }
  if (days === 0) {
    return (
      <p className="tickets-countdown urgent">
        {isEvent ? '⏳ Today — last chance to get tickets!' : '⏳ Ends today — last chance!'}
      </p>
    )
  }
  return (
    <p className={`tickets-countdown${days <= 3 ? ' urgent' : ''}`}>
      {isEvent
        ? `⏳ ${days} day${days === 1 ? '' : 's'} left to get tickets`
        : `⏳ Ends in ${days} day${days === 1 ? '' : 's'}`}
    </p>
  )
}

function TicketBox({ quest }: { quest: Quest }) {
  const t = quest.ticketInfo
  if (!t) return null
  const open = (url: string) => {
    if (isNativePlatform()) window.open(url, '_system')
    else window.open(url, '_blank', 'noopener')
  }
  return (
    <div className="quest-tickets">
      <div className="tickets-head">
        <span className="tickets-badge">
          {quest.eventType ? `${EVENT_TYPE_META[quest.eventType].emoji} ${EVENT_TYPE_META[quest.eventType].label}` : '🎟️'}{' '}
          {t.required ? '· tickets required' : '· free entry'}
        </span>
        {quest.when && <span className="tickets-when">📅 {quest.when}</span>}
      </div>
      <TicketCountdown quest={quest} />
      {t.price && <p className="tickets-price">💰 {t.price}</p>}
      {t.where && t.where.length > 0 && (
        <div className="tickets-where">
          <p className="tickets-where-label">🎟️ Get yours at:</p>
          {t.where.map((w) => (
            <p key={w.label} className="tickets-where-item">
              <span className="tickets-where-bullet">•</span>{' '}
              {w.url ? (
                <a
                  href={w.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault()
                    open(w.url as string)
                  }}
                  className="tickets-where-link"
                >
                  {w.label} ↗
                </a>
              ) : (
                <span>{w.label}</span>
              )}
            </p>
          ))}
        </div>
      )}
      {t.url && (
        <button className="tickets-btn" onClick={() => open(t.url as string)}>
          🎟️ Get tickets
        </button>
      )}
    </div>
  )
}

const haversineKm = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/** Real road time via free OSRM; falls back to a straight-line ~55 km/h estimate. */
const estimateDrive = async (fromLat: number, fromLng: number, toLat: number, toLng: number): Promise<number> => {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`,
      { signal: AbortSignal.timeout(6000) },
    )
    if (res.ok) {
      const data = (await res.json()) as { routes?: { duration?: number }[] }
      const dur = data.routes?.[0]?.duration
      if (typeof dur === 'number' && dur > 0) return Math.max(1, Math.round(dur / 60))
    }
  } catch {
    // offline or OSRM down — fall through to the estimate
  }
  const km = haversineKm(fromLat, fromLng, toLat, toLng)
  return Math.max(1, Math.round((km / 55) * 60))
}

const fmtDrive = (min: number): string =>
  min < 60 ? `About ${min} min drive` : `About ${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ''} drive`

// ── Reviews: real ratings from players who completed the quest ──────────────

function Reviews({ questId, canReview }: { questId: string; canReview: boolean }) {
  const [reviews, setReviews] = useState<QuestReview[]>([])
  const [stats, setStats] = useState<ReviewStats>({ count: 0, avg: null, recommend: null })
  const [myUid, setMyUid] = useState<string | null>(null)
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [reported, setReported] = useState<Set<string>>(new Set())
  const loadedFor = useRef('')

  const load = (qid: string) => {
    void fetchReviews(qid).then(({ reviews: r, stats: s }) => {
      setReviews(r)
      setStats(s)
    })
  }

  useEffect(() => {
    if (loadedFor.current === questId) return
    loadedFor.current = questId
    setStars(0)
    setComment('')
    setMsg(null)
    load(questId)
    void ensureIdentity().then((uid) => setMyUid(uid))
  }, [questId])

  const myReview = reviews.find((r) => r.profile_id === myUid)

  const save = async () => {
    if (stars === 0) {
      setMsg('Tap the stars to rate it first.')
      return
    }
    setBusy(true)
    setMsg(null)
    const res = await submitReview(questId, stars, comment)
    setBusy(false)
    setMsg(res.ok ? '✓ Review saved — thanks!' : res.error ?? 'Could not save — try again.')
    if (res.ok) {
      setStars(0)
      setComment('')
      load(questId)
    }
  }

  const remove = async () => {
    if (!myReview) return
    setBusy(true)
    await deleteReview(questId)
    setBusy(false)
    setMsg('Review deleted.')
    load(questId)
  }

  const flag = (id: string) => {
    if (reported.has(id)) return
    if (!window.confirm('Report this review as spam or inappropriate?')) return
    void reportReview(id).then((res) => {
      if (res.ok) {
        setReported((s) => new Set(s).add(id))
        setMsg('✓ Reported — thanks for keeping the community clean.')
      } else {
        setMsg(res.error ?? 'Could not report.')
      }
    })
  }

  return (
    <div className="quest-reviews">
      <div className="reviews-head">
        <span className="reviews-title">⭐ Ratings & reviews</span>
        {stats.count > 0 && (
          <span className="reviews-stats">
            {stats.avg !== null && <b>{stats.avg.toFixed(1)}</b>}
            {' · '}
            {stats.count} {stats.count === 1 ? 'review' : 'reviews'}
            {stats.recommend !== null && ` · ${stats.recommend}% recommend`}
          </span>
        )}
      </div>

      {stats.count === 0 && <p className="reviews-empty">No reviews yet — be the first after you complete it.</p>}

      {canReview && (
        <div className="review-form">
          {myReview ? (
            <>
              <p className="review-form-label">
                Your review: {starsRow(myReview.rating)}
                {myReview.comment && <span className="review-form-comment">“{myReview.comment}”</span>}
              </p>
              <div className="review-form-actions">
                <button className="review-link" onClick={() => void remove()} disabled={busy}>
                  Delete my review
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="review-form-label">You completed this — rate your experience</p>
              <div className="star-picker" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    className={`star-btn ${n <= stars ? 'star-on' : ''}`}
                    onClick={() => setStars(n)}
                    aria-label={`${n} star${n === 1 ? '' : 's'}`}
                  >
                    {n <= stars ? '★' : '☆'}
                  </button>
                ))}
              </div>
              <textarea
                className="review-input"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Short tip for the next person (optional)…"
                maxLength={280}
                rows={2}
              />
              <button className="review-submit" onClick={() => void save()} disabled={busy}>
                {busy ? 'Saving…' : 'Post review'}
              </button>
            </>
          )}
        </div>
      )}

      {!canReview && (
        <p className="reviews-gate">Complete this quest to rate it — reviews only come from people who've actually been there.</p>
      )}

      {msg && <p className="review-msg">{msg}</p>}

      {reviews.length > 0 && (
        <div className="review-list">
          {reviews.map((r) => (
            <div className="review-card" key={r.id}>
              <div className="review-top">
                <span className="review-author">
                  {r.author_emoji} @{r.author_name}
                </span>
                <span className="review-stars">{starsRow(r.rating)}</span>
                <button className="review-flag" onClick={() => flag(r.id)} aria-label="Report review" title="Report review">
                  🚩
                </button>
              </div>
              {r.comment && <p className="review-comment">{r.comment}</p>}
              <span className="review-date">{new Date(r.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const starsRow = (n: number): string => '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(Math.max(0, 5 - n))

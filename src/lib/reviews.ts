// ─────────────────────────────────────────────────────────────────────────────
// Community quest reviews — a star rating + comment per quest, stored in
// Supabase and shown on quest sheets. Every function no-ops when offline or
// unsigned-in, so reviewing is a progressive enhancement, never a blocker.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase'
import { ensureIdentity } from './sync'

export interface QuestReview {
  id: string
  profile_id: string
  quest_id: string
  rating: number
  comment: string
  created_at: string
  /** Joined profile name for display (fetched via a second call — kept simple). */
  author_name?: string
  author_emoji?: string
}

export interface ReviewStats {
  count: number
  avg: number | null
  /** % of ratings >= 4 — the honest replacement for the old fake 'would recommend'. */
  recommend: number | null
}

/** Loads the visible reviews + stats for a quest. Never throws. */
export async function fetchReviews(questId: string): Promise<{ reviews: QuestReview[]; stats: ReviewStats }> {
  const empty = { reviews: [], stats: { count: 0, avg: null, recommend: null } }
  if (!supabase || !questId) return empty
  try {
    const { data, error } = await supabase
      .from('quest_reviews')
      .select('id, profile_id, quest_id, rating, comment, created_at')
      .eq('quest_id', questId)
      .eq('hidden', false)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) return empty
    const reviews = (data ?? []) as QuestReview[]

    // Attach author names (profile lookup in one batched call).
    const ids = [...new Set(reviews.map((r) => r.profile_id))]
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, emoji')
        .in('id', ids)
      const byId = new Map((profs ?? []).map((p) => [p.id, p]))
      for (const r of reviews) {
        const p = byId.get(r.profile_id)
        r.author_name = p?.name ?? 'SideQuester'
        r.author_emoji = p?.emoji ?? '🌱'
      }
    }

    const count = reviews.length
    const avg = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : null
    const recCount = reviews.filter((r) => r.rating >= 4).length
    const recommend = count > 0 ? Math.round((recCount / count) * 100) : null
    return { reviews, stats: { count, avg, recommend } }
  } catch {
    return empty
  }
}

/**
 * Submits (or updates) the user's review. The DB enforces the real rule — you
 * can only review a quest you've completed (RLS) — so an uncompleted quest
 * returns an error here. One review per person per quest.
 */
export async function submitReview(
  questId: string,
  rating: number,
  comment: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Not connected to the sync server.' }
  const uid = await ensureIdentity()
  if (!uid) return { ok: false, error: 'Sign in to leave a review.' }
  if (rating < 1 || rating > 5) return { ok: false, error: 'Pick 1–5 stars.' }
  const clean = comment.trim().slice(0, 280)
  const { error } = await supabase.from('quest_reviews').upsert(
    { profile_id: uid, quest_id: questId, rating, comment: clean },
    { onConflict: 'profile_id,quest_id' },
  )
  if (error) {
    // RLS rejects inserts for quests the user hasn't completed.
    if (/row-level security/i.test(error.message))
      return { ok: false, error: 'You can only review a quest you have completed.' }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/** Deletes the user's own review of a quest. */
export async function deleteReview(questId: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Not connected to the sync server.' }
  const uid = await ensureIdentity()
  if (!uid) return { ok: false, error: 'Sign in to manage your review.' }
  const { error } = await supabase
    .from('quest_reviews')
    .delete()
    .eq('profile_id', uid)
    .eq('quest_id', questId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Flags a review — auto-hides it once it reaches 5 reports. */
export async function reportReview(reviewId: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Not connected to the sync server.' }
  const uid = await ensureIdentity()
  if (!uid) return { ok: false, error: 'Sign in to report a review.' }
  const { error } = await supabase.from('review_reports').insert({ review_id: reviewId, reporter_id: uid })
  return error ? { ok: false, error: error.message } : { ok: true }
}

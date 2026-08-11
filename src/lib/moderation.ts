import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// SideQuest moderation
//
// Three layers keep the community feed clean:
//   1. CLIENT — the quest creator checks its title/description/tags against
//      this list before saving (fast feedback, works offline).
//   2. SERVER — a Postgres trigger re-checks the same words on INSERT/UPDATE
//      (in migration 0004) so nobody can bypass the client via the API.
//   3. REPORTS — friends flag quests; at REPORT_THRESHOLD the server trigger
//      auto-hides the quest from the feed.
//
// NOTE: keep BLOCKLIST_WORDS in sync with the seed in
// supabase/migrations/20260810000004_moderation.sql. Words must be
// letters/spaces only (no regex characters) so the SQL word-boundary check
// works without escaping.
// ─────────────────────────────────────────────────────────────────────────────

/** Auto-hide a community quest once it reaches this many reports. */
export const REPORT_THRESHOLD = 10

export const BLOCKLIST_WORDS: string[] = [
  // English profanity
  'anal', 'anus', 'arse', 'arsehole', 'arseholes', 'ass', 'asshole', 'assholes',
  'bastard', 'bastards', 'bint', 'bitch', 'bitches', 'bollocks', 'boner', 'boners',
  'boob', 'boobs', 'bullshit', 'clit', 'cock', 'cocks', 'cocksucker', 'cunt', 'cunts',
  'dick', 'dicks', 'dickhead', 'dickheads', 'doos', 'douche', 'dumbass', 'fag',
  'faggot', 'faggots', 'fuck', 'fucked', 'fucker', 'fuckers', 'fucking', 'fucks',
  'gash', 'hoe', 'hoes', 'hore', 'horny', 'jackass', 'jizz', 'kock', 'kunt',
  'motherfucker', 'motherfucking', 'naai', 'nigger', 'niggers', 'nigga', 'piss',
  'poes', 'porn', 'prick', 'pricks', 'pussy', 'pussies', 'rape', 'scrotum', 'semen',
  'sex', 'shit', 'shitty', 'shits', 'shite', 'slut', 'sluts', 'tit', 'tits',
  'tosser', 'tossers', 'twat', 'twats', 'wank', 'wanker', 'wankers', 'whore', 'whores',
  // South African / Afrikaans slurs & profanity
  'amakwerekwere', 'fok', 'hotnot', 'kaffir', 'kak', 'koelie', 'moffie', 'houtkop',
]

/** True when the given word appears as a whole word (case-insensitive). */
const hasWholeWord = (text: string, word: string): boolean => {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9_])${escaped}([^a-z0-9_]|$)`, 'i').test(text)
}

/** Returns every blocked word found in the text (whole-word, case-insensitive). */
export const findBlockedWords = (text: string, list: string[] = BLOCKLIST_WORDS): string[] =>
  list.filter((w) => w && hasWholeWord(text, w))

/**
 * Fetches the live blocklist from Supabase (so words added later apply without
 * an app update). Falls back to the bundled list when offline/unconfigured,
 * always merging the two so a stale fetch never weakens the check.
 */
export async function fetchBlocklist(): Promise<string[]> {
  if (!supabase) return BLOCKLIST_WORDS
  try {
    const { data, error } = await supabase.from('moderation_blocks').select('word')
    if (error || !data || data.length === 0) return BLOCKLIST_WORDS
    const server = data.map((r) => String((r as { word: string }).word).toLowerCase())
    return [...new Set([...BLOCKLIST_WORDS, ...server])]
  } catch {
    return BLOCKLIST_WORDS
  }
}

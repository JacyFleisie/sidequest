-- ============================================================================
-- SideQuest — migration 0016: remove the XP guard + legacy view
--
-- Reverts migration 0015 (the server-side XP validation triggers) so
-- profiles.xp is client-writable again, and drops the unused v_leaderboard
-- view that predated it. All drops are idempotent (IF EXISTS) so this is safe
-- whether or not 0015 was ever applied to this database.
-- ============================================================================

-- ── XP guard triggers + functions (created by migration 0015) ──────────────

DROP TRIGGER IF EXISTS profiles_xp_guard ON profiles;
DROP TRIGGER IF EXISTS quest_completions_xp_guard ON quest_completions;
DROP TRIGGER IF EXISTS chain_completions_xp_guard ON chain_completions;

DROP FUNCTION IF EXISTS validate_profile_xp();
DROP FUNCTION IF EXISTS validate_completion_xp();

-- ── Legacy read model (created in migration 0000, never used by the app) ───

DROP VIEW IF EXISTS v_leaderboard;

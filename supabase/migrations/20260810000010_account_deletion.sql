-- ============================================================================
-- SideQuest — migration 0010: account deletion (POPIA right to erasure)
--
-- The `delete-account` edge function wipes a user's data (profile row → all
-- child tables cascade) and deletes their auth user. It runs with the service
-- role, but this project has "Automatically expose new tables" OFF and
-- migration 0002 only granted privileges to anon/authenticated — so the
-- service role could read (SELECT) but never DELETE.
--
-- Granting DELETE to service_role is safe: the anon/authenticated roles still
-- have NO DELETE on profiles (deliberately — the edge function is the only
-- path that may erase an account, so a user can never orphan their auth user
-- by deleting their own profile row via the client).
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON friend_requests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON friendships TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON quest_completions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON chain_completions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON badge_earnings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON custom_quests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON quest_reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON push_tokens TO service_role;
-- The quest_reports DELETE trigger re-checks the blocklist, which needs the
-- service role to read (and own) moderation_blocks too.
GRANT SELECT, INSERT, UPDATE, DELETE ON moderation_blocks TO service_role;

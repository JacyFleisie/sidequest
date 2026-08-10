-- ============================================================================
-- SideQuest — migration 0002: table grants for the Data API
--
-- The project has "Automatically expose new tables" OFF, so tables created by
-- migration 0001 carry no privileges for the app's publishable key (anon role)
-- or signed-in users (authenticated role). Without these grants every API call
-- fails with 42501 even though RLS policies exist. RLS still controls which
-- rows each user can see — this only lets the roles reach the tables at all.
-- ============================================================================

GRANT SELECT ON profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON profiles TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON friend_requests TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON friendships TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON quest_completions TO anon, authenticated;
GRANT SELECT, INSERT ON chain_completions TO anon, authenticated;
GRANT SELECT, INSERT ON badge_earnings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON challenges TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON push_tokens TO anon, authenticated;

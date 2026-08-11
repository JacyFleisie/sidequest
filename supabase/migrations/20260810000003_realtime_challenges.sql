-- ============================================================================
-- SideQuest — migration 0004: realtime for app subscriptions
--
-- The app live-subscribes to:
--   * challenges       → an incoming dare toasts the moment it's sent
--   * friend_requests  → an incoming request toasts instantly
--   * quest_completions → the friends' live activity feed
--   * custom_quests    → covered by migration 0003
--
-- Realtime is per-table, so each subscribed table must be in the publication.
-- Idempotent: a plain ALTER would fail if realtime was already enabled via the
-- dashboard toggle, so only add a table when it's missing.
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'challenges'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE challenges;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'friend_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'quest_completions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE quest_completions;
    END IF;
END
$$;

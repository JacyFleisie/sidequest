-- ============================================================================
-- SideQuest — migration 0009: remove the race/challenge feature
--
-- The race UI was removed in v1.0.15 (the "can't end a race" bug). This drops
-- the corresponding backend so no dead challenge data, triggers, or push
-- functions remain. Friend-request pushes are untouched — they use
-- notify_push / push_friend_request / push_friend_accepted, which stay.
-- ============================================================================

-- Drop the challenge triggers first (they reference the table + functions).
DROP TRIGGER IF EXISTS challenges_push ON challenges;
DROP TRIGGER IF EXISTS challenges_accepted_push ON challenges;

-- Drop the challenge push functions (create + accept notifications).
DROP FUNCTION IF EXISTS push_challenge();
DROP FUNCTION IF EXISTS push_challenge_accepted();

-- Remove challenges from the realtime publication so the app stops streaming it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'challenges'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.challenges;
  END IF;
END $$;

-- Drop the table itself (its indexes and RLS policies go with it).
DROP TABLE IF EXISTS challenges;

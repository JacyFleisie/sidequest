-- ============================================================================
-- SideQuest — migration 0003: user-created anywhere quests
--
-- Players build their own anywhere-quests and share them with friends. Rows
-- are visible only to the creator and their friends (RLS), so the quest feed
-- only ever shows quests from people you actually know.
-- ============================================================================

CREATE TABLE custom_quests (
    id            uuid PRIMARY KEY,            -- app-generated (matches the local quest id)
    profile_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    title         text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 60),
    description   text NOT NULL DEFAULT '' CHECK (char_length(description) <= 280),
    emoji         text NOT NULL DEFAULT '✨',
    category      text NOT NULL DEFAULT 'free'
                  CHECK (category IN ('free', 'chill', 'food', 'activity', 'adventure', 'event', 'mystery')),
    vibe          text[] NOT NULL DEFAULT '{random}',
    duration_min  integer NOT NULL DEFAULT 30 CHECK (duration_min BETWEEN 5 AND 600),
    cost          integer NOT NULL DEFAULT 0 CHECK (cost BETWEEN 0 AND 5000),
    players_min   integer NOT NULL DEFAULT 1 CHECK (players_min BETWEEN 1 AND 20),
    players_max   integer NOT NULL DEFAULT 4 CHECK (players_max BETWEEN players_min AND 20),
    difficulty    integer NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    xp            integer NOT NULL DEFAULT 100 CHECK (xp BETWEEN 20 AND 2000),
    tags          text[] NOT NULL DEFAULT '{}',
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_custom_quests_owner ON custom_quests (profile_id, created_at DESC);

ALTER TABLE custom_quests ENABLE ROW LEVEL SECURITY;

-- Visible to the creator and anyone they're friends with (either direction).
CREATE POLICY "cq_select_friends" ON custom_quests
    FOR SELECT USING (
        auth.uid() = profile_id
        OR EXISTS (
            SELECT 1 FROM friendships f
            WHERE (f.user_a_id = auth.uid() AND f.user_b_id = custom_quests.profile_id)
               OR (f.user_b_id = auth.uid() AND f.user_a_id = custom_quests.profile_id)
        )
    );

CREATE POLICY "cq_insert_own" ON custom_quests
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "cq_delete_own" ON custom_quests
    FOR DELETE USING (auth.uid() = profile_id);

-- Live feed: a friend creating a quest should appear without a manual refresh.
-- Idempotent: if realtime was already enabled for the table (dashboard toggle),
-- the plain ALTER would fail the deploy — only add when missing.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'custom_quests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE custom_quests;
    END IF;
END
$$;

-- Data API access (publishable key + signed-in users). RLS still scopes rows.
GRANT SELECT, INSERT, DELETE ON custom_quests TO anon, authenticated;

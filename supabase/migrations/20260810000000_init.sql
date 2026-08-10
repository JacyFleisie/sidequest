-- ============================================================================
-- SideQuest — initial schema (migration 0001)
-- Deployed automatically by the Supabase GitHub integration when pushed to main.
--
-- Conventions:
--   * UUIDs for row identity — the app signs in via Supabase Auth (anonymous
--     sign-in gives each device a stable uid) and uses that uid as its
--     profile id, so profiles.id = auth.uid().
--   * timestamptz everywhere — store UTC, display local.
--   * TEXT + CHECK instead of enums: adding a value later is a one-line ALTER.
--   * quest_id / chain_id are TEXT matching the app's data ids.
-- ============================================================================

-- ── Profiles: one row per player (id = the player's auth uid) ───────────────
CREATE TABLE profiles (
    id              uuid PRIMARY KEY,
    name            text NOT NULL DEFAULT 'SideQuester',
    emoji           text NOT NULL DEFAULT '🌱',
    xp              integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
    streak          integer NOT NULL DEFAULT 0 CHECK (streak >= 0),
    last_quest_at   timestamptz,              -- most recent quest date (streak maths)
    home_base_id    text,                     -- 'jhb', 'cpt', ... (matches app HOME_BASES)
    start_place     jsonb,                    -- { label, lat, lng } from the map picker
    created_at      timestamptz NOT NULL DEFAULT now(),
    last_active_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_name ON profiles (lower(name));

-- ── Friend requests: the pending → accept flow ──────────────────────────────
CREATE TABLE friend_requests (
    id            uuid PRIMARY KEY,
    sender_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    recipient_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    responded_at  timestamptz,
    CHECK (sender_id <> recipient_id)
);

-- One live request per pair; a new request after 'declined' replaces the old one.
CREATE UNIQUE INDEX uq_friend_req_live
    ON friend_requests (least(sender_id, recipient_id), greatest(sender_id, recipient_id))
    WHERE status = 'pending';

CREATE INDEX idx_friend_req_recipient
    ON friend_requests (recipient_id, status, created_at DESC);

-- ── Friendships: accepted, mutual pairs, stored once (user_a_id < user_b_id) ─
CREATE TABLE friendships (
    user_a_id   uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    user_b_id   uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_a_id, user_b_id),
    CHECK (user_a_id < user_b_id)
);

CREATE INDEX idx_friendships_b ON friendships (user_b_id, user_a_id);

-- ── Quest completions: the activity feed's raw material ─────────────────────
CREATE TABLE quest_completions (
    profile_id        uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    quest_id          text NOT NULL,           -- app quest id, e.g. 'nelson-mandela-square'
    completed_at      timestamptz NOT NULL DEFAULT now(),
    xp                integer NOT NULL DEFAULT 0,
    weather           text CHECK (weather IN ('rain', 'dry', 'unknown')),
    dist_from_home_km numeric(8, 2),
    PRIMARY KEY (profile_id, quest_id)
);

CREATE INDEX idx_quest_completions_at
    ON quest_completions (profile_id, completed_at DESC);

-- ── Chain completions: multi-stop quests (official + user-built) ────────────
CREATE TABLE chain_completions (
    profile_id   uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    chain_id     text NOT NULL,                -- app chain id or custom-chain id
    completed_at timestamptz NOT NULL DEFAULT now(),
    xp           integer NOT NULL DEFAULT 0,
    is_custom    boolean NOT NULL DEFAULT false,
    PRIMARY KEY (profile_id, chain_id)
);

-- ── Badge earnings: powers "friend got a badge" notifications ───────────────
CREATE TABLE badge_earnings (
    profile_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    badge_id   text NOT NULL,                  -- app badge id, e.g. 'night-owl'
    earned_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (profile_id, badge_id)
);

CREATE INDEX idx_badge_earnings_at
    ON badge_earnings (profile_id, earned_at DESC);

-- ── Challenges: one friend dares another ────────────────────────────────────
CREATE TABLE challenges (
    id              uuid PRIMARY KEY,
    challenger_id   uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    opponent_id     uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    kind            text NOT NULL DEFAULT 'race' CHECK (kind IN ('race', 'coop')),
    target_type     text NOT NULL CHECK (target_type IN ('quest', 'chain')),
    target_id       text NOT NULL,
    message         text,
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'expired')),
    challenger_done boolean NOT NULL DEFAULT false,
    opponent_done   boolean NOT NULL DEFAULT false,
    winner_id       uuid REFERENCES profiles (id) ON DELETE SET NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    responded_at    timestamptz,
    completed_at    timestamptz,
    CHECK (challenger_id <> opponent_id)
);

CREATE INDEX idx_challenges_opponent
    ON challenges (opponent_id, status, created_at DESC);
CREATE INDEX idx_challenges_challenger
    ON challenges (challenger_id, status, created_at DESC);

-- ── Push tokens: real device notifications later ────────────────────────────
CREATE TABLE push_tokens (
    profile_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    token       text NOT NULL,
    platform    text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (profile_id, token)
);

-- ============================================================================
-- Read models
-- ============================================================================
CREATE OR REPLACE VIEW v_leaderboard AS
    SELECT id, name, emoji, xp,
           rank() OVER (ORDER BY xp DESC) AS xp_rank
    FROM profiles;

CREATE OR REPLACE VIEW v_friend_feed AS
    SELECT q.profile_id, p.name AS player_name, p.emoji AS player_emoji,
           q.quest_id, q.completed_at, q.xp
    FROM quest_completions q
    JOIN profiles p ON p.id = q.profile_id
    ORDER BY q.completed_at DESC;

-- ============================================================================
-- Row Level Security
-- Everyone may READ profiles (that's how friends see each other); every other
-- table is locked to the people involved. The app uses the anon key with
-- anonymous auth, so auth.uid() is the signed-in device's stable identity.
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chain_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- profiles: readable by everyone; only the owner edits their own.
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- friend_requests: only sender + recipient can see or act on a request.
CREATE POLICY "req_select_involved" ON friend_requests
    FOR SELECT USING (auth.uid() IN (sender_id, recipient_id));
CREATE POLICY "req_insert_sender" ON friend_requests
    FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "req_update_involved" ON friend_requests
    FOR UPDATE USING (auth.uid() IN (sender_id, recipient_id)) WITH CHECK (auth.uid() IN (sender_id, recipient_id));

-- friendships: only the two members see the pair; either may insert/remove it
-- (the accept action inserts it, an unfriend deletes it).
CREATE POLICY "friendship_select_members" ON friendships
    FOR SELECT USING (auth.uid() IN (user_a_id, user_b_id));
CREATE POLICY "friendship_insert_members" ON friendships
    FOR INSERT WITH CHECK (auth.uid() IN (user_a_id, user_b_id));
CREATE POLICY "friendship_delete_members" ON friendships
    FOR DELETE USING (auth.uid() IN (user_a_id, user_b_id));

-- quest_completions / chain_completions / badge_earnings:
-- readable by all (powers feeds and rivalries); only the owner writes.
CREATE POLICY "completions_select_all" ON quest_completions FOR SELECT USING (true);
CREATE POLICY "completions_insert_own" ON quest_completions
    FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "completions_update_own" ON quest_completions
    FOR UPDATE USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "chains_select_all" ON chain_completions FOR SELECT USING (true);
CREATE POLICY "chains_insert_own" ON chain_completions
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "badges_select_all" ON badge_earnings FOR SELECT USING (true);
CREATE POLICY "badges_insert_own" ON badge_earnings
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- challenges: only the two players see or update their dare; challenger creates.
CREATE POLICY "challenge_select_involved" ON challenges
    FOR SELECT USING (auth.uid() IN (challenger_id, opponent_id));
CREATE POLICY "challenge_insert_challenger" ON challenges
    FOR INSERT WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "challenge_update_involved" ON challenges
    FOR UPDATE USING (auth.uid() IN (challenger_id, opponent_id))
    WITH CHECK (auth.uid() IN (challenger_id, opponent_id));

-- push_tokens: private to the owning profile.
CREATE POLICY "tokens_select_own" ON push_tokens FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "tokens_insert_own" ON push_tokens
    FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "tokens_delete_own" ON push_tokens FOR DELETE USING (auth.uid() = profile_id);

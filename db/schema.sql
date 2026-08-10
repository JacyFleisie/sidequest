-- ============================================================================
-- SideQuest — core database schema
-- Portable Postgres (9.6+). Runs unchanged on Supabase, Neon, Railway, Render,
-- or a plain $5 VPS Postgres — so the upgrade path stays open.
--
-- Conventions:
--   * UUIDs for row identity (the app generates them with crypto.randomUUID()).
--   * timestamptz everywhere — store UTC, display local.
--   * TEXT + CHECK instead of Postgres ENUM types: adding a value later is a
--     one-line ALTER instead of an enum migration.
--   * quest_id / chain_id are TEXT matching the app's data ids (e.g. 'jhb-...').
-- ============================================================================

BEGIN;

-- ── Profiles: one row per player ────────────────────────────────────────────
-- The source of truth for a player's stats once sync lands. The phone writes
-- its real numbers here; everyone else reads them from here.
CREATE TABLE IF NOT EXISTS profiles (
    id            uuid PRIMARY KEY,
    name          text NOT NULL DEFAULT 'SideQuester',
    emoji         text NOT NULL DEFAULT '🌱',
    xp            integer NOT NULL DEFAULT 0 CHECK (xp >= 0),
    streak        integer NOT NULL DEFAULT 0 CHECK (streak >= 0),
    last_quest_at timestamptz,                -- date of most recent quest (streak maths)
    home_base_id  text,                        -- 'jhb', 'cpt', ... (matches app HOME_BASES)
    start_place   jsonb,                       -- { label, lat, lng } from the map picker
    created_at    timestamptz NOT NULL DEFAULT now(),
    last_active_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_name ON profiles (lower(name));

-- ── Friend requests: the pending → accept flow ──────────────────────────────
-- Fixes "it just added me" — adding a friend now INSERTs a request row, and the
-- recipient's app polls/real-time-subscribes to see it as a *request*.
CREATE TABLE IF NOT EXISTS friend_requests (
    id           uuid PRIMARY KEY,
    sender_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    recipient_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    responded_at timestamptz,
    CHECK (sender_id <> recipient_id)
);

-- One live request per pair: a new request after 'declined' replaces the old one.
CREATE UNIQUE INDEX IF NOT EXISTS uq_friend_req_live
    ON friend_requests (least(sender_id, recipient_id), greatest(sender_id, recipient_id))
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_friend_req_recipient
    ON friend_requests (recipient_id, status, created_at DESC);

-- ── Friendships: accepted, mutual pairs ─────────────────────────────────────
-- Stored once per pair with (user_a_id < user_b_id) — no duplicate rows, no
-- matter which side initiated. Adding a friend = a friendship row appearing here.
CREATE TABLE IF NOT EXISTS friendships (
    user_a_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    user_b_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_a_id, user_b_id),
    CHECK (user_a_id < user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_b ON friendships (user_b_id, user_a_id);

-- ── Quest completions: the activity feed's raw material ─────────────────────
-- One row per quest the player has finished. First completion wins the row
-- (matches the app's 'completed' map); the row is updated if the quest is ever
-- redone, keeping one canonical entry per quest per player.
CREATE TABLE IF NOT EXISTS quest_completions (
    profile_id        uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    quest_id          text NOT NULL,            -- app quest id, e.g. 'nelson-mandela-square'
    completed_at      timestamptz NOT NULL DEFAULT now(),
    xp                integer NOT NULL DEFAULT 0,
    weather           text CHECK (weather IN ('rain', 'dry', 'unknown')),
    dist_from_home_km numeric(8, 2),            -- distance from the player's home base
    PRIMARY KEY (profile_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_quest_completions_at
    ON quest_completions (profile_id, completed_at DESC);

-- ── Chain completions: multi-stop quests (official + user-built) ────────────
CREATE TABLE IF NOT EXISTS chain_completions (
    profile_id   uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    chain_id     text NOT NULL,                 -- app chain id or custom-chain id
    completed_at timestamptz NOT NULL DEFAULT now(),
    xp           integer NOT NULL DEFAULT 0,
    is_custom    boolean NOT NULL DEFAULT false,
    PRIMARY KEY (profile_id, chain_id)
);

-- ── Badge earnings: powers "friend got a badge" notifications ───────────────
-- Badges are computed client-side from BADGES; the *result* is stored here so
-- friends' apps can subscribe to new rows and surface them in the feed.
CREATE TABLE IF NOT EXISTS badge_earnings (
    profile_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    badge_id   text NOT NULL,                   -- app badge id, e.g. 'night-owl'
    earned_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (profile_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_badge_earnings_at
    ON badge_earnings (profile_id, earned_at DESC);

-- ── Challenges: one friend dares another ────────────────────────────────────
-- target_type/target_id point at a quest or a chain. 'race' = first to finish
-- wins; 'coop' = both must finish. winner_id is set when the challenge closes.
CREATE TABLE IF NOT EXISTS challenges (
    id             uuid PRIMARY KEY,
    challenger_id  uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    opponent_id    uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    kind           text NOT NULL DEFAULT 'race' CHECK (kind IN ('race', 'coop')),
    target_type    text NOT NULL CHECK (target_type IN ('quest', 'chain')),
    target_id      text NOT NULL,
    message        text,
    status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'expired')),
    challenger_done boolean NOT NULL DEFAULT false,
    opponent_done   boolean NOT NULL DEFAULT false,
    winner_id      uuid REFERENCES profiles (id) ON DELETE SET NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    responded_at   timestamptz,
    completed_at   timestamptz,
    CHECK (challenger_id <> opponent_id)
);

CREATE INDEX IF NOT EXISTS idx_challenges_opponent
    ON challenges (opponent_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_challenger
    ON challenges (challenger_id, status, created_at DESC);

-- ── Optional: push tokens, for real device notifications later ──────────────
CREATE TABLE IF NOT EXISTS push_tokens (
    profile_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    token      text NOT NULL,
    platform   text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (profile_id, token)
);

-- ============================================================================
-- Views: read models the app uses directly
-- ============================================================================

-- Leaderboard-ish: everyone, ranked by XP (friends UI uses a filtered copy).
CREATE OR REPLACE VIEW v_leaderboard AS
    SELECT id, name, emoji, xp,
           rank() OVER (ORDER BY xp DESC) AS xp_rank
    FROM profiles;

-- Friend feed: completions joined with the friend's profile, newest first.
-- Used by the Activity tab and "friend completed X" entries.
CREATE OR REPLACE VIEW v_friend_feed AS
    SELECT q.profile_id, p.name AS player_name, p.emoji AS player_emoji,
           q.quest_id, q.completed_at, q.xp
    FROM quest_completions q
    JOIN profiles p ON p.id = q.profile_id
    ORDER BY q.completed_at DESC;

-- ============================================================================
-- Recommended indexes for the two hot query shapes (add when data grows):
--   1. "my friend list" — friendship lookups by either side:
--        CREATE INDEX ... ON friendships (user_a_id, user_b_id)  -- already PK
--        -- and idx_friendships_b above covers the B side.
--   2. "badges a friend earned since <date>" — covered by idx_badge_earnings_at.
-- ============================================================================

COMMIT;

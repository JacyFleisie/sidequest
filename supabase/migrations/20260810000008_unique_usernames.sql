-- ============================================================================
-- SideQuest — migration 0008: unique usernames
--
-- Usernames (profiles.name) must be unique, case-insensitively, so Find
-- Friends and the community feed never have two @handles that look the same.
--
-- Notes:
--   * The default name 'SideQuester' is EXCLUDED from uniqueness — anonymous
--     users who never picked a name all carry it, and the app must keep
--     syncing their stats (a hard unique constraint would break every profile
--     after the first).
--   * Existing duplicates (from the pre-uniqueness era) are renamed with a
--     short id suffix so the index can be created without manual cleanup.
-- ============================================================================

-- Rename duplicate usernames: keep the earliest profile, give later ones a
-- short suffix (e.g. "Bokkie" -> "Bokkie-a1b2") so nothing is lost.
UPDATE profiles p
SET name = p.name || '-' || left(p.id::text, 4)
WHERE p.id IN (
    SELECT id FROM (
        SELECT id, row_number() OVER (PARTITION BY lower(name) ORDER BY created_at, id) AS rn
        FROM profiles
    ) ranked
    WHERE ranked.rn > 1
);

-- Enforce uniqueness for real usernames (anything that isn't the anonymous
-- default). Case-insensitive, so "Bokkie" and "bokkie" can't coexist.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
    ON profiles (lower(name))
    WHERE lower(name) <> 'sidequester';

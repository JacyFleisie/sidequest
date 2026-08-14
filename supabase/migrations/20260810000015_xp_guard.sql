-- ============================================================================
-- SideQuest — migration 0015: server-side XP guard (anti-cheat)
--
-- profiles.xp is written by the app (syncProfile upserts the device's stats).
-- Before this migration a player could call the API directly and write ANY
-- value onto their own row — instantly topping the leaderboard. The triggers
-- below validate every write:
--
--   * profiles.xp must stay under a hard ceiling no legitimate play reaches.
--     The whole quest catalog sums to ~86 000 XP (max single quest 650, ~780
--     with the squad bonus); even years of live events + community quests
--     stay far below the 10 000 000 bound.
--   * an UPDATE may only GAIN a bounded amount per write. Legitimate syncs are
--     small (a quest or two per debounced push); the worst realistic case — a
--     full offline catch-up of the catalog + the player's own 100 custom
--     quests — is ~326 000, so 1 000 000 leaves ~3x headroom. Decreases are
--     always allowed (the in-app "Reset progress" syncs xp back to 0).
--   * a fresh INSERT (first sync, possibly carrying offline history) is capped
--     at the same 1 000 000 bound so a brand-new row can't be created at the
--     ceiling.
--   * streak gets a sanity ceiling too (it is shown on leaderboard rows; the
--     app's legitimate max is a few hundred days).
--
-- Per-row completion XP (quest_completions / chain_completions) is capped the
-- same way: the largest legitimate row is a ~2 400 XP custom quest (2 000 max
-- × squad bonus), so 10 000 blocks fake "+1 000 000 XP" rows from polluting
-- the activity feed, friend stats and review gating.
--
-- NOTE: this is a pragmatic bound, not a mathematical proof — a determined
-- attacker could still reach the ceiling over many writes. Fully
-- deterministic XP would require the server to own the quest catalog and
-- compute scores from validated completions (see docs/developer-handover.md
-- §33). The bounds are deliberately generous so no legitimate player is ever
-- rejected; they only stop absurd, clearly-fake values.
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_profile_xp() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.xp < 0 THEN
        RAISE EXCEPTION 'XP cannot be negative.';
    END IF;
    IF NEW.xp > 10000000 THEN
        RAISE EXCEPTION 'XP value is outside the allowed range.';
    END IF;
    IF NEW.streak < 0 OR NEW.streak > 3650 THEN
        RAISE EXCEPTION 'Streak value is outside the allowed range.';
    END IF;
    -- Fresh profile (first sync): bound the initial XP to the offline catch-up
    -- budget so a brand-new row can't be INSERTed at the ceiling.
    IF TG_OP = 'INSERT' AND NEW.xp > 1000000 THEN
        RAISE EXCEPTION 'Initial XP is outside the allowed range.';
    END IF;
    -- Updates may lose XP (resets) but only gain a bounded amount per write.
    IF TG_OP = 'UPDATE' AND NEW.xp - OLD.xp > 1000000 THEN
        RAISE EXCEPTION 'XP gain per sync is outside the allowed range.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_xp_guard ON profiles;
CREATE TRIGGER profiles_xp_guard
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION validate_profile_xp();

-- ── Completion rows: per-row XP cap (feeds, friend stats, reviews gate) ─────

CREATE OR REPLACE FUNCTION validate_completion_xp() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.xp < 0 OR NEW.xp > 10000 THEN
        RAISE EXCEPTION 'Completion XP is outside the allowed range.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quest_completions_xp_guard ON quest_completions;
CREATE TRIGGER quest_completions_xp_guard
    BEFORE INSERT OR UPDATE ON quest_completions
    FOR EACH ROW EXECUTE FUNCTION validate_completion_xp();

DROP TRIGGER IF EXISTS chain_completions_xp_guard ON chain_completions;
CREATE TRIGGER chain_completions_xp_guard
    BEFORE INSERT OR UPDATE ON chain_completions
    FOR EACH ROW EXECUTE FUNCTION validate_completion_xp();

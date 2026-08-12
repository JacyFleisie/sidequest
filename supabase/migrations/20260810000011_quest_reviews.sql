-- ============================================================================
-- SideQuest — migration 0011: quest ratings & reviews
--
-- Players rate and review quests they've ACTUALLY completed. The key rule:
-- a review can only be inserted when the reviewer has a quest_completion for
-- that quest (RLS WITH CHECK) — so nobody can talk about a place they haven't
-- experienced. One review per person per quest.
--
-- Moderation mirrors the community-quest layers:
--   * blocklist trigger on the comment (same word list as custom quests)
--   * review_reports — anyone can flag a review; auto-hide at 5 reports
--   * the app only fetches non-hidden reviews, and reviewers can edit/delete
--     their own
-- ============================================================================

CREATE TABLE IF NOT EXISTS quest_reviews (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id   uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    quest_id     text NOT NULL,                 -- app quest id
    rating       integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment      text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 280),
    report_count integer NOT NULL DEFAULT 0,
    hidden       boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (profile_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_quest_reviews_quest
    ON quest_reviews (quest_id, created_at DESC);

-- ── Reports on reviews ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS review_reports (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id   uuid NOT NULL REFERENCES quest_reviews (id) ON DELETE CASCADE,
    reporter_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (review_id, reporter_id)             -- one report per person per review
);

CREATE INDEX IF NOT EXISTS idx_review_reports_review ON review_reports (review_id);

ALTER TABLE quest_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_reports ENABLE ROW LEVEL SECURITY;

-- Reviews: everyone can read (hidden rows stay out via the app's query);
-- only the author writes/edits/deletes — and only AFTER completing the quest.
CREATE POLICY "review_select_all" ON quest_reviews FOR SELECT USING (true);

CREATE POLICY "review_insert_only_when_completed" ON quest_reviews
    FOR INSERT WITH CHECK (
        auth.uid() = profile_id
        AND EXISTS (
            SELECT 1 FROM quest_completions qc
            WHERE qc.profile_id = auth.uid() AND qc.quest_id = quest_reviews.quest_id
        )
    );

CREATE POLICY "review_update_own" ON quest_reviews
    FOR UPDATE USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "review_delete_own" ON quest_reviews
    FOR DELETE USING (auth.uid() = profile_id);

-- Reports: any signed-in user may flag a review they can see — never their own.
CREATE POLICY "rr_insert_public" ON review_reports
    FOR INSERT WITH CHECK (
        auth.uid() = reporter_id
        AND EXISTS (
            SELECT 1 FROM quest_reviews qr
            WHERE qr.id = review_reports.review_id AND qr.profile_id <> auth.uid()
        )
    );

-- ── Auto-hide at 5 reports ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION on_review_report() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE quest_reviews
           SET report_count = report_count + 1,
               hidden = (report_count + 1) >= 5
         WHERE id = NEW.review_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE quest_reviews
           SET report_count = GREATEST(report_count - 1, 0),
               hidden = (report_count - 1) >= 5
         WHERE id = OLD.review_id;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS review_report_trigger ON review_reports;
CREATE TRIGGER review_report_trigger
    AFTER INSERT OR DELETE ON review_reports
    FOR EACH ROW EXECUTE FUNCTION on_review_report();

-- ── Blocklist on review comments (same word list as community quests) ───────
CREATE OR REPLACE FUNCTION block_flagged_review() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    blocked_word text;
BEGIN
    SELECT mb.word INTO blocked_word
      FROM moderation_blocks mb
     WHERE NEW.comment ~* ('(^|[^a-zA-Z0-9_])' || mb.word || '([^a-zA-Z0-9_]|$)')
     LIMIT 1;
    IF blocked_word IS NOT NULL THEN
        RAISE EXCEPTION 'This review contains language that is not allowed.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quest_reviews_blocklist ON quest_reviews;
CREATE TRIGGER quest_reviews_blocklist
    BEFORE INSERT OR UPDATE ON quest_reviews
    FOR EACH ROW EXECUTE FUNCTION block_flagged_review();

-- ── Data API access ─────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON quest_reviews TO anon, authenticated;
GRANT SELECT, INSERT ON review_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON quest_reviews TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON review_reports TO service_role;

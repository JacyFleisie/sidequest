-- ============================================================================
-- SideQuest — migration 0004: community moderation
--
-- Three layers keep user-made quests clean:
--   1. moderation_blocks  — the blocklist (client fetches it live, and a
--      BEFORE INSERT/UPDATE trigger re-checks it server-side so nobody can
--      bypass the app via the API).
--   2. quest_reports      — friends can flag a quest; each user reports once.
--   3. report_count/hidden on custom_quests — the trigger below auto-hides a
--      quest once it reaches REPORT_THRESHOLD (10) reports.
-- ============================================================================

-- ── Blocklist ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS moderation_blocks (
    word text PRIMARY KEY
);

-- Words must be letters/spaces only — the trigger uses them inside a
-- word-boundary regex without escaping. Keep in sync with BLOCKLIST_WORDS in
-- src/lib/moderation.ts.
INSERT INTO moderation_blocks (word) VALUES
    ('anal'), ('anus'), ('arse'), ('arsehole'), ('arseholes'), ('ass'), ('asshole'), ('assholes'),
    ('bastard'), ('bastards'), ('bint'), ('bitch'), ('bitches'), ('bollocks'), ('boner'), ('boners'),
    ('boob'), ('boobs'), ('bullshit'), ('clit'), ('cock'), ('cocks'), ('cocksucker'), ('cunt'), ('cunts'),
    ('dick'), ('dicks'), ('dickhead'), ('dickheads'), ('doos'), ('douche'), ('dumbass'), ('fag'),
    ('faggot'), ('faggots'), ('fuck'), ('fucked'), ('fucker'), ('fuckers'), ('fucking'), ('fucks'),
    ('gash'), ('hoe'), ('hoes'), ('hore'), ('horny'), ('jackass'), ('jizz'), ('kock'), ('kunt'),
    ('motherfucker'), ('motherfucking'), ('naai'), ('nigger'), ('niggers'), ('nigga'), ('piss'),
    ('poes'), ('porn'), ('prick'), ('pricks'), ('pussy'), ('pussies'), ('rape'), ('scrotum'), ('semen'),
    ('sex'), ('shit'), ('shitty'), ('shits'), ('shite'), ('slut'), ('sluts'), ('tit'), ('tits'),
    ('tosser'), ('tossers'), ('twat'), ('twats'), ('wank'), ('wanker'), ('wankers'), ('whore'), ('whores'),
    ('amakwerekwere'), ('fok'), ('hotnot'), ('kaffir'), ('kak'), ('koelie'), ('moffie'), ('houtkop')
ON CONFLICT (word) DO NOTHING;

ALTER TABLE moderation_blocks ENABLE ROW LEVEL SECURITY;

-- Publicly readable so the app can fetch the live list without an account.
CREATE POLICY "mb_select_public" ON moderation_blocks
    FOR SELECT USING (true);

GRANT SELECT ON moderation_blocks TO anon, authenticated;

-- ── Reports ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quest_reports (
    id               uuid PRIMARY KEY,
    custom_quest_id  uuid NOT NULL REFERENCES custom_quests (id) ON DELETE CASCADE,
    reporter_id      uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (custom_quest_id, reporter_id)  -- one report per person per quest
);

CREATE INDEX IF NOT EXISTS idx_quest_reports_quest ON quest_reports (custom_quest_id);

ALTER TABLE quest_reports ENABLE ROW LEVEL SECURITY;

-- Any signed-in user may report a quest they can actually see — a friend's
-- quest (never their own, never a stranger's, since the custom_quests RLS
-- already scopes visibility to creator + friends).
CREATE POLICY "qr_insert_visible" ON quest_reports
    FOR INSERT WITH CHECK (
        auth.uid() = reporter_id
        AND EXISTS (
            SELECT 1 FROM custom_quests cq
            WHERE cq.id = quest_reports.custom_quest_id
              AND cq.profile_id <> auth.uid()
              AND EXISTS (
                  SELECT 1 FROM friendships f
                  WHERE (f.user_a_id = auth.uid() AND f.user_b_id = cq.profile_id)
                     OR (f.user_b_id = auth.uid() AND f.user_a_id = cq.profile_id)
              )
        )
    );

-- The quest's creator can see who reported their quest (transparency/appeals).
CREATE POLICY "qr_select_owner" ON quest_reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM custom_quests cq
            WHERE cq.id = quest_reports.custom_quest_id AND cq.profile_id = auth.uid()
        )
    );

GRANT SELECT, INSERT ON quest_reports TO authenticated;

-- ── Report count + auto-hide on custom_quests ───────────────────────────────
ALTER TABLE custom_quests ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 0;
ALTER TABLE custom_quests ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION on_quest_report() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE custom_quests
           SET report_count = report_count + 1,
               hidden = (report_count + 1) >= 10
         WHERE id = NEW.custom_quest_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE custom_quests
           SET report_count = GREATEST(report_count - 1, 0),
               hidden = (report_count - 1) >= 10
         WHERE id = OLD.custom_quest_id;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS quest_report_trigger ON quest_reports;
CREATE TRIGGER quest_report_trigger
    AFTER INSERT OR DELETE ON quest_reports
    FOR EACH ROW EXECUTE FUNCTION on_quest_report();

-- ── Blocklist trigger (server-side backstop) ────────────────────────────────
-- Raises so the INSERT/UPDATE fails if any blocked word appears in the title,
-- description, or tags. Mirrors the client check — words are lowercase
-- alphanumerics, matched as whole words, case-insensitive.
CREATE OR REPLACE FUNCTION block_flagged_content() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    blocked_word text;
BEGIN
    SELECT mb.word INTO blocked_word
      FROM moderation_blocks mb
     WHERE NEW.title ~* ('(^|[^a-zA-Z0-9_])' || mb.word || '([^a-zA-Z0-9_]|$)')
        OR NEW.description ~* ('(^|[^a-zA-Z0-9_])' || mb.word || '([^a-zA-Z0-9_]|$)')
        OR array_to_string(NEW.tags, ' ') ~* ('(^|[^a-zA-Z0-9_])' || mb.word || '([^a-zA-Z0-9_]|$)')
     LIMIT 1;
    IF blocked_word IS NOT NULL THEN
        RAISE EXCEPTION 'This quest contains language that is not allowed.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS custom_quests_blocklist ON custom_quests;
CREATE TRIGGER custom_quests_blocklist
    BEFORE INSERT OR UPDATE ON custom_quests
    FOR EACH ROW EXECUTE FUNCTION block_flagged_content();

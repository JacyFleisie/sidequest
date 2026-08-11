-- ============================================================================
-- SideQuest — migration 0005: community quests are platform-wide
--
-- Custom quests were scoped to the creator + friends. Now the community feed
-- is public: every user (signed-in or anonymous guest) sees every community
-- quest. Auto-hidden quests are still filtered by the app's fetch query and
-- the blocklist trigger still applies.
-- ============================================================================

-- Everyone can read every community quest. (The app still filters hidden
-- quests in the query; the blocklist trigger still rejects bad content.)
DROP POLICY IF EXISTS cq_select_friends ON custom_quests;
CREATE POLICY cq_select_all ON custom_quests
    FOR SELECT USING (true);

-- With quests public, anyone may report a quest they can see — still never
-- their own. (The unique (quest, reporter) constraint stops report spam.)
DROP POLICY IF EXISTS qr_insert_visible ON quest_reports;
CREATE POLICY qr_insert_public ON quest_reports
    FOR INSERT WITH CHECK (
        auth.uid() = reporter_id
        AND EXISTS (
            SELECT 1 FROM custom_quests cq
            WHERE cq.id = quest_reports.custom_quest_id
              AND cq.profile_id <> auth.uid()
        )
    );

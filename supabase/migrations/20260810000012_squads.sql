-- ============================================================================
-- SideQuest — migration 0012: squads (co-op groups)
--
-- A squad is a small co-op group: the leader invites friends, members see each
-- other live (realtime), anyone may leave, the leader may remove or disband.
-- Every squad member earns a +20% XP bonus on quest completions (app-side).
--
-- Rules:
--   * ONE squad per person — a partial unique index on squad_members(profile_id)
--     makes multi-squadding impossible at the DB level.
--   * The leader invites (INSERT with role 'member'); members leave by deleting
--     their own row; the leader can remove members / delete the squad.
--   * Realtime: members appear/disappear live via the squad_members channel.
-- ============================================================================

CREATE TABLE IF NOT EXISTS squads (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name       text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 40),
    emoji      text NOT NULL DEFAULT '🛡️',
    created_by uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS squad_members (
    squad_id   uuid NOT NULL REFERENCES squads (id) ON DELETE CASCADE,
    profile_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
    role       text NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
    joined_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (squad_id, profile_id)
);

-- One squad per person.
CREATE UNIQUE INDEX IF NOT EXISTS uq_squad_members_one
    ON squad_members (profile_id);

CREATE INDEX IF NOT EXISTS idx_squad_members_squad ON squad_members (squad_id, joined_at);

ALTER TABLE squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE squad_members ENABLE ROW LEVEL SECURITY;

-- squads: visible to its members; created by the founder; managed by the leader.
CREATE POLICY "squad_select_members" ON squads
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM squad_members sm WHERE sm.squad_id = squads.id AND sm.profile_id = auth.uid())
    );

CREATE POLICY "squad_insert_own" ON squads
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "squad_update_leader" ON squads
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM squad_members sm WHERE sm.squad_id = squads.id AND sm.profile_id = auth.uid() AND sm.role = 'leader')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM squad_members sm WHERE sm.squad_id = squads.id AND sm.profile_id = auth.uid() AND sm.role = 'leader')
    );

CREATE POLICY "squad_delete_leader" ON squads
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM squad_members sm WHERE sm.squad_id = squads.id AND sm.profile_id = auth.uid() AND sm.role = 'leader')
    );

-- squad_members: members see the roster; the leader invites & removes;
-- anyone may delete their own row (leaving the squad).
CREATE POLICY "member_select_in_squad" ON squad_members
    FOR SELECT USING (
        auth.uid() = profile_id
        OR EXISTS (SELECT 1 FROM squad_members me WHERE me.squad_id = squad_members.squad_id AND me.profile_id = auth.uid())
    );

-- NOTE: NEW is not allowed inside policy subqueries — reference the row by
-- its table name (resolves to NEW in INSERT WITH CHECK) instead.
CREATE POLICY "member_insert_leader_invites" ON squad_members
    FOR INSERT WITH CHECK (
        squad_members.profile_id <> auth.uid()          -- can't invite yourself
        AND EXISTS (
            SELECT 1 FROM squad_members me
            WHERE me.squad_id = squad_members.squad_id AND me.profile_id = auth.uid() AND me.role = 'leader'
        )
    );

CREATE POLICY "member_update_leader" ON squad_members
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM squad_members me WHERE me.squad_id = squad_members.squad_id AND me.profile_id = auth.uid() AND me.role = 'leader')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM squad_members me WHERE me.squad_id = squad_members.squad_id AND me.profile_id = auth.uid() AND me.role = 'leader')
    );

CREATE POLICY "member_delete_leave_or_leader" ON squad_members
    FOR DELETE USING (
        auth.uid() = profile_id                          -- leave the squad
        OR EXISTS (
            SELECT 1 FROM squad_members me
            WHERE me.squad_id = squad_members.squad_id AND me.profile_id = auth.uid() AND me.role = 'leader'
        )
    );

-- Live roster: adding/removing a member should appear without a refresh.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'squads') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE squads;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'squad_members') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE squad_members;
    END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON squads TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON squad_members TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON squads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON squad_members TO service_role;

-- ============================================================================
-- SideQuest — migration 0014: fix squad_members RLS infinite recursion
--
-- The original member_select_in_squad policy referenced squad_members inside
-- its own subquery ("OR EXISTS (SELECT 1 FROM squad_members …)"), which makes
-- Postgres recurse forever ("infinite recursion detected in policy"). The
-- standard fix: move the membership check into a SECURITY DEFINER helper that
-- runs as the table owner (RLS bypassed inside), and call it from the policy.
-- Members still see each other's rows, so realtime roster updates keep working.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_squad_member(p_squad_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE
    v_member boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM squad_members sm
        WHERE sm.squad_id = p_squad_id AND sm.profile_id = auth.uid()
    ) INTO v_member;
    RETURN v_member;
END;
$$;

REVOKE ALL ON FUNCTION public.is_squad_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_squad_member(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "member_select_in_squad" ON squad_members;
CREATE POLICY "member_select_in_squad" ON squad_members
    FOR SELECT USING (
        auth.uid() = profile_id
        OR is_squad_member(squad_members.squad_id)
    );

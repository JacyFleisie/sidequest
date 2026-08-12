-- ============================================================================
-- SideQuest — migration 0013: create_squad helper
--
-- RLS intentionally blocks a leader inserting their own squad_members row
-- (member_insert_leader_invites requires profile_id <> auth.uid()). This
-- SECURITY DEFINER function is the single sanctioned path for creating a
-- squad: it inserts the squad row AND the founder's leader row atomically.
-- Everything else (invites, leaving, removing) flows through RLS normally.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_squad(p_name text, p_emoji text DEFAULT '🛡️')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_squad_id uuid;
BEGIN
    INSERT INTO squads (name, emoji, created_by)
    VALUES (p_name, p_emoji, auth.uid())
    RETURNING id INTO v_squad_id;

    INSERT INTO squad_members (squad_id, profile_id, role)
    VALUES (v_squad_id, auth.uid(), 'leader');

    RETURN v_squad_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_squad(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_squad(text, text) TO anon, authenticated, service_role;

-- ============================================================================
-- SideQuest — migration 0007: pushes when requests/challenges are accepted
--
-- Migration 0006 fired pushes on INSERT (someone sent you a request / dared
-- you). This adds the reverse direction: when the recipient ACCEPTS, the
-- sender gets a push too, so both sides stay in the loop.
--
-- No new config needed — these reuse the same `notify_push` helper and
-- `notify-user` edge function secrets from migration 0006.
-- ============================================================================

-- ── Friend request accepted → push the sender ───────────────────────────────
CREATE OR REPLACE FUNCTION push_friend_accepted() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    accepter_name  text;
    accepter_emoji text;
BEGIN
    SELECT name, emoji INTO accepter_name, accepter_emoji
      FROM profiles WHERE id = NEW.recipient_id;
    PERFORM notify_push(
        'friend-accepted',
        NEW.sender_id,
        (coalesce(nullif(accepter_emoji, ''), '🎉') || ' ' || coalesce(nullif(accepter_name, ''), 'Someone') || ' accepted your friend request!'),
        'You’re friends now — go quest together.'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friend_requests_accepted_push ON friend_requests;
CREATE TRIGGER friend_requests_accepted_push
    AFTER UPDATE ON friend_requests
    FOR EACH ROW
    WHEN (OLD.status = 'pending' AND NEW.status = 'accepted')
    EXECUTE FUNCTION push_friend_accepted();

-- ── Challenge accepted → push the challenger ─────────────────────────────────
CREATE OR REPLACE FUNCTION push_challenge_accepted() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    accepter_name  text;
    accepter_emoji text;
    body           text;
BEGIN
    SELECT name, emoji INTO accepter_name, accepter_emoji
      FROM profiles WHERE id = NEW.opponent_id;
    body := CASE WHEN NEW.kind = 'coop' THEN 'Let’s do this — together.'
                 ELSE 'The race is on.'
            END;
    PERFORM notify_push(
        'challenge-accepted',
        NEW.challenger_id,
        (coalesce(nullif(accepter_emoji, ''), '⚔️') || ' ' || coalesce(nullif(accepter_name, ''), 'Someone') || ' accepted your challenge!'),
        body
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS challenges_accepted_push ON challenges;
CREATE TRIGGER challenges_accepted_push
    AFTER UPDATE ON challenges
    FOR EACH ROW
    WHEN (OLD.status = 'pending' AND NEW.status = 'accepted')
    EXECUTE FUNCTION push_challenge_accepted();

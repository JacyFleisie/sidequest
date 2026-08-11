-- ============================================================================
-- SideQuest — migration 0006: push notifications for friend requests & challenges
--
-- When a friend request or a challenge is inserted, we fire an FCM push to the
-- recipient's devices via the `notify-user` edge function — so they hear about
-- it even when the app is fully closed (the in-app toast only works while the
-- app is open).
--
-- Setup (ONE time, after this deploys):
--   Supabase dashboard → SQL editor → run:
--
--     UPDATE app_config SET value = 'https://<your-ref>.supabase.co' WHERE key = 'push_fn_url';
--     UPDATE app_config SET value = '<a long random string>'              WHERE key = 'push_webhook_secret';
--
--   where <your-ref> is the subdomain of your project URL (the `abcdefgh` in
--   https://abcdefgh.supabase.co). Then Supabase → Edge Functions →
--   `notify-user` → Secrets: add `NOTIFY_WEBHOOK_SECRET` with the SAME random
--   string, and `FCM_SERVICE_ACCOUNT` with your Firebase service-account JSON
--   (the same one the `notify-update` function uses). Redeploy the function.
--
-- Until configured, the triggers silently no-op — nothing breaks.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- Tiny key/value config read by the SECURITY DEFINER helper below. Kept out of
-- migrations so secrets never land in the repo; set via the dashboard SQL
-- editor (runs as postgres). Not granted to anon/authenticated, so the API
-- never exposes it.
CREATE TABLE IF NOT EXISTS app_config (
    key   text PRIMARY KEY,
    value text NOT NULL DEFAULT ''
);

INSERT INTO app_config (key, value) VALUES
    ('push_fn_url', ''),
    ('push_webhook_secret', '')
ON CONFLICT (key) DO NOTHING;

-- Calls the notify-user edge function (async, fire-and-forget). No-ops when
-- the one-time config above hasn't been done yet.
CREATE OR REPLACE FUNCTION notify_push(kind text, user_id uuid, title text, body text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    fn_url  text;
    secret  text;
BEGIN
    SELECT value INTO fn_url  FROM app_config WHERE key = 'push_fn_url';
    SELECT value INTO secret  FROM app_config WHERE key = 'push_webhook_secret';
    IF fn_url IS NULL OR fn_url = '' OR secret IS NULL OR secret = '' THEN
        RETURN; -- not configured yet — skip silently
    END IF;
    PERFORM net.http_post(
        url     := fn_url || '/functions/v1/notify-user',
        headers := jsonb_build_object(
            'Content-Type',     'application/json',
            'x-webhook-secret', secret
        ),
        body := jsonb_build_object(
            'userId', user_id::text,
            'title',  title,
            'body',   body,
            'data',   jsonb_build_object('type', kind)
        )
    );
END;
$$;

-- ── Friend requests ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION push_friend_request() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sender_name  text;
    sender_emoji text;
BEGIN
    IF NEW.sender_id = NEW.recipient_id THEN
        RETURN NEW;
    END IF;
    SELECT name, emoji INTO sender_name, sender_emoji
      FROM profiles WHERE id = NEW.sender_id;
    PERFORM notify_push(
        'friend-request',
        NEW.recipient_id,
        (coalesce(nullif(sender_emoji, ''), '🌱') || ' ' || coalesce(nullif(sender_name, ''), 'Someone') || ' sent you a friend request'),
        'Tap to accept and start questing together.'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS friend_requests_push ON friend_requests;
CREATE TRIGGER friend_requests_push
    AFTER INSERT ON friend_requests
    FOR EACH ROW
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION push_friend_request();

-- ── Challenges ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION push_challenge() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    challenger_name  text;
    challenger_emoji text;
BEGIN
    IF NEW.challenger_id = NEW.opponent_id THEN
        RETURN NEW;
    END IF;
    SELECT name, emoji INTO challenger_name, challenger_emoji
      FROM profiles WHERE id = NEW.challenger_id;
    PERFORM notify_push(
        'challenge',
        NEW.opponent_id,
        (coalesce(nullif(challenger_emoji, ''), '⚔️') || ' ' || coalesce(nullif(challenger_name, ''), 'Someone') || ' challenged you to a quest!'),
        'Accept and settle it.'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS challenges_push ON challenges;
CREATE TRIGGER challenges_push
    AFTER INSERT ON challenges
    FOR EACH ROW
    EXECUTE FUNCTION push_challenge();

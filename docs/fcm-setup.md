# Push notifications (FCM) setup

SideQuest uses **Firebase Cloud Messaging (FCM)** — free, no limits that matter
for this scale — to notify phones about **new releases, friend requests and
challenges** even when the app is fully closed. Everything code-side is already
wired:

- the app registers its FCM token on launch → `push_tokens` table
- `.github/workflows/notify-release.yml` fires on every published release
- it calls the `notify-update` edge function, which pushes to every token
- DB triggers on `friend_requests` / `challenges` call the `notify-user` edge
  function, which pushes to just the recipient

What's left is a **one-time, ~20 minute** setup in your accounts. Do these in
order.

---

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and **Add project** (e.g. `sidequest`).
2. Firebase console → ⚙️ **Project settings** → scroll to **Your apps**.
3. Click the **Android** icon (🤖) and add an app:
   - **Android package name:** `com.jacy.sidequest`
   - App nickname: `SideQuest`
   - **Register app** → **Download google-services.json**.
4. Put that file at **`android/app/google-services.json`** (this exact path).

The app build auto-detects the file — no code changes needed. Without it the
build still works, it just can't receive pushes.

## 2. Enable Cloud Messaging

Firebase console → ⚙️ Project settings → **Cloud Messaging** tab. FCM should be
enabled by default on new projects; the **Sender ID** / **Project ID** will be
used below (you can also find Project ID at the top of Project settings).

## 3. Generate the service-account key

1. Firebase console → ⚙️ **Project settings** → **Service accounts** tab.
2. **Generate new private key** → downloads a JSON file. This is the FCM
   **service account** (it can send messages; treat it like a password).
3. Copy the **entire file contents** (it's one long JSON blob).

## 4. Give the edge function its secrets

Supabase dashboard → **Edge Functions** → `notify-update` → **Secrets** (or
Project Settings → Edge Functions → Secrets). Add:

| Name | Value |
|---|---|
| `FCM_SERVICE_ACCOUNT` | the full service-account JSON from step 3 |
| `UPDATE_WEBHOOK_SECRET` | a long random string you make up (e.g. `openssl rand -hex 32`) — save it for step 6 |

Then re-deploy the function so it picks up the secrets (Supabase dashboard →
Edge Functions → `notify-update` → Deploy, or `supabase functions deploy
notify-update` if you use the CLI).

## 4b. Friend requests & challenges (targeted pushes)

When a friend request or challenge is sent, a database trigger calls the
`notify-user` edge function to push **only to the recipient**. Two one-time
bits of config, both after `20260810000006_push_events.sql` deploys:

1. **Edge function secrets** — Supabase → Edge Functions → `notify-user` →
   Secrets, add:

   | Name | Value |
   |---|---|
   | `FCM_SERVICE_ACCOUNT` | the same service-account JSON from step 3 |
   | `NOTIFY_WEBHOOK_SECRET` | a long random string you make up — save it for the next step |

   Re-deploy `notify-user` so it picks them up.

2. **Tell the DB where the function lives** — Supabase dashboard → **SQL
   editor** → run (replace `<your-ref>` with the subdomain of your Supabase
   URL, e.g. the `abcdefgh` in `https://abcdefgh.supabase.co`, and the secret
   with the same random string from above):

   ```sql
   UPDATE app_config SET value = 'https://<your-ref>.supabase.co' WHERE key = 'push_fn_url';
   UPDATE app_config SET value = '<the NOTIFY_WEBHOOK_SECRET string>'   WHERE key = 'push_webhook_secret';
   ```

Until this is done the triggers silently no-op — nothing breaks.

Accept-side pushes ("X accepted your friend request" / "accepted your
challenge") are covered by the exact same two steps — migration 0007 reuses
the same `notify-user` secrets and `app_config` values, so no extra setup.

## 5. (First time) deploy the edge function

If you haven't deployed functions to this project before, the GitHub
integration may not know about them yet. Either:

- **GitHub integration (automatic):** push `supabase/functions/` to `main` —
  the integration deploys Edge Functions from that folder. If it doesn't pick
  it up, use the CLI once:
- **CLI:** `npx supabase link --project-ref <your-ref>` then
  `npx supabase functions deploy notify-update` and
  `npx supabase functions deploy notify-user`

## 6. Add the GitHub repo secrets

GitHub → repo → **Settings → Secrets and variables → Actions** → New repository
secret:

| Secret | Value |
|---|---|
| `SUPABASE_PROJECT_REF` | the subdomain of your Supabase URL — the `abcdefgh` in `https://abcdefgh.supabase.co` |
| `SUPABASE_ANON_KEY` | the publishable anon key (Settings → API in Supabase; it's public by design) |
| `UPDATE_WEBHOOK_SECRET` | the same random string from step 4 |

## 7. Rebuild the app once

`npm run apk` — the build now bakes in FCM. Install on your phone, open it once
(permission prompt: **Allow**), and the app stores its token.

## 8. Test end-to-end

Cut a release (or just edit an existing release's notes and re-publish it, or
run the workflow manually via Actions → Notify app of new release → Run
workflow). Your phone should get:

> ⬇️ **SideQuest v1.0.13 is here!** — *Tap to install the latest version.*

Tapping it opens the app, where the in-app update banner takes over.

---

## Troubleshooting

- **No notification after a release** → check the workflow run under
  **Actions**; it logs the edge function's response (`{"sent": N, "failed": M}`).
  A 403 means the webhook secret doesn't match; 500 `FCM_SERVICE_ACCOUNT not
  configured` means step 4 was skipped.
- **`registrationError` in the app logs** → `google-services.json` missing or
  wrong package name (step 1).
- **Permission wasn't asked** → Android 13+: reinstall or enable notifications
  for SideQuest in the system settings.
- **Token cleanup** — the edge function auto-removes dead tokens, so the
  `push_tokens` table stays clean.

## Costs

Firebase Cloud Messaging is free and unlimited for notification messages.
Supabase edge function invocations are included in the free tier (a release
fires exactly one invocation). No paid APIs involved.

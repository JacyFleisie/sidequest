# SideQuest — Code Tree (where everything is and what it does)

> Local-only reference. The public GitHub repo ships no code or technical docs,
> so this lives in the working repo's `docs/` only.
>
> **Read `docs/ARCHITECTURE.md` first** — it explains the flows; this file maps
> the files. Everything here was verified against the current tree; if a file
> moves, update both.

## Repository map (compact)

```
.
├── index.html / vite.config.ts / tsconfig*.json / capacitor.config.ts
├── package.json / package-lock.json          ← deps + every command
├── .env / .env.defaults                      ← env (real values gitignored)
├── README.md / RELEASE_NOTES.md / SECURITY.md / CODE_OF_CONDUCT.md / LICENSE
├── docs/                                    ← ARCHITECTURE.md + this file
├── src/                                     ← the whole app
│   ├── main.tsx · App.tsx · styles.css · vite-env.d.ts
│   ├── lib/          ← game rules, state, sync, events, helpers (10 modules + 2 test files)
│   ├── data/         ← all static quest/place content (6 catalogs)
│   └── components/   ← one file per screen + small shared pieces (24 files)
├── scripts/                                ← 12 dev/release/build tools
├── supabase/
│   ├── migrations/   ← 16 SQL migrations (applied in order)
│   └── functions/    ← 3 edge functions
├── android/                                ← the Capacitor Android shell
└── .github/                                ← workflows + issue/PR templates
```

---

## Root files

| File | What it is |
|---|---|
| `index.html` | Vite HTML entry — mounts `#root`, favicon, meta. |
| `package.json` | Dependency manifest + **the command hub** (`npm run dev/test/build/apk/release/…`). |
| `package-lock.json` | Lockfile — commit it, never edit by hand. |
| `vite.config.ts` | Vite config **and** the Vitest config (test files: `src/**/*.test.ts`, node env). |
| `tsconfig.json` | Project references root — `tsc -b` typechecks `app` + `node` configs. |
| `tsconfig.app.json` | TS config for `src/` (strict, `noUnusedLocals`, `noUnusedParameters`). |
| `tsconfig.node.json` | TS config for tooling (`vite.config.ts`, scripts). |
| `capacitor.config.ts` | Capacitor app config — `appId com.jacy.sidequest`, `webDir dist`. |
| `.env` | **Gitignored** real values (Supabase URL, anon key, Turnstile site key, optional Ticketmaster key). |
| `.env.defaults` | Committed public defaults; `scripts/sync-env.mjs` regenerates `.env` from it when missing. |
| `.gitignore` | Excludes `node_modules`, `dist`, `.env`, `android/keystore.properties`, APKs, `.freebuff/`, build output. |
| `README.md` | Product README for users/employers — intentionally **no code or file explanation**. |
| `RELEASE_NOTES.md` | The *next* release's player-facing notes; the release pipeline consumes it. |
| `SECURITY.md` | Vulnerability-reporting policy (public). |
| `CODE_OF_CONDUCT.md`, `LICENSE` | Community + MIT license (public). |
| `SideQuest.apk` | Gitignored build artifact from the last release — safe to ignore/delete. |

---

## `src/` — the app

### Entry & shell

| File | What it is |
|---|---|
| `main.tsx` | Entry — `createRoot` → `<GameProvider><App/></GameProvider>` inside `BrowserRouter`. |
| `App.tsx` | Composition root — routes, the sync/push/squad/events effects, bottom nav, update banners, deep-link handling. |
| `styles.css` | **All** styling (1.7k lines, one file by convention) — dark-cream SA theme, component classes. |
| `vite-env.d.ts` | Vite client types (`import.meta.env`). |

### `src/lib/` — logic (UI-free, unit-testable)

| File | What it is |
|---|---|
| `game.ts` | **Pure game rules** — levels, ranks, badges, stats dashboard, weather, event horizon, location helpers. Nothing touches I/O; fully covered by `game.test.ts`. |
| `game.test.ts` | 51 tests over the game rules (levels/ranks/badges/stats/formatting). |
| `store.tsx` | **Game state context** — the persisted player state (`sidequest-state-v1` in localStorage) and every mutation: start/complete quests, XP + streak, memories, friends, custom quests/chains. Read via `useGame()`. |
| `sync.ts` | **Supabase bridge** — anonymous identity, profile/completion pushes, friends (requests/accept/decline/find), custom quests, push tokens, account auth (upgrade/sign-in/reset/delete). Every function no-ops when offline. |
| `eventsSync.ts` | **Live events** — merges the static snapshot feed with a live Ticketmaster query (browser CORS); placement atlas, dedupe, upcoming-only, caching. |
| `eventsSync.test.ts` | 10 tests over the event transform + source merge. |
| `supabase.ts` | Client creation — returns `null` when env vars are missing → the app runs fully offline. |
| `friends.ts` | Friend profile shaping — real profiles from DB, deterministic local stand-ins for offline friends. |
| `squads.ts` | Squad membership + the **+20% XP squad bonus** (app-side, consulted at award time). |
| `reviews.ts` | Quest reviews — fetch/submit/delete/report via Supabase; no-op when offline. |
| `moderation.ts` | Profanity blocklist + client-side content check (mirrors the server trigger in migration 0004). |
| `push.ts` | FCM push — registration, token save, tap routing to a single in-app handler. |
| `updater.ts` | Self-update — GitHub Releases check, APK download/install via the native plugin, version notices. |
| `share.ts` | Share links — always point at the public web build, never a localhost origin. |
| `taglines.ts` | Rotating micro-copy ("the whispers"), one per day. |
| `usePullToRefresh.ts` | The pull-to-refresh gesture hook shared by feed/map/friends. |

### `src/data/` — all static content (heavily commented)

| File | What it is |
|---|---|
| `quests.ts` | The core catalog: provinces, home bases, quests, multi-stop chains, the `q`/`anywhere` builders, and the quest registry (`ALL_QUESTS`, `registerCustomQuests`). |
| `events.ts` | Curated dated events — festivals, markets, motorsport, with ticket links and venue coordinates. |
| `seasonal.ts` | Limited-time quests tied to real SA events; `expiresAt` drives countdowns + auto-drop. |
| `hangouts.ts` | Everyday "walk/explore/hang out" quests — malls, parks, trails. |
| `social.ts` | Social/silly quests + the `qAny` builder (quests that set `anywhere: true`). |
| `places.ts` | The SA gazetteer for search autocomplete — local first, OpenStreetMap Nominatim fallback. |

### `src/components/` — screens & shared pieces

| File | What it is |
|---|---|
| `Home.tsx` | Dashboard — greeting, stat cards (quests/XP/streak), rank + level, "Explore the map", Quick start tiles. |
| `MapScreen.tsx` | The Leaflet map — marker clusters, pulsing red **live** pins for remote events, home base, place picker, pull-to-refresh. |
| `Generator.tsx` | The **Feed** — filter chips (vibe / live / seasonal / community), shuffle, pull-to-refresh that also grabs fresh events, remote-event rows. |
| `QuestSheet.tsx` | Quest detail sheet — start/complete, ticket info + countdown, reviews (submit/report), share. |
| `ActiveQuest.tsx` | Active-session progress — step-by-step with GPS proximity (5 km) + weather, complete/abandon. |
| `CompletionModal.tsx` | Celebration sheet + memory capture after completing a quest. |
| `ChainBuilder.tsx` | Build your own multi-stop chain from the catalog, then share via URL. |
| `CreateQuest.tsx` | Community quest creation — moderation pre-check, location pick, publishes to `custom_quests`. |
| `Friends.tsx` | **Squad** tab — Squad/Activity switcher, add friends by name, incoming requests. |
| `SquadPanel.tsx` | Squad management — create/join/invite/leave/disband, shows the +20% bonus. |
| `Profile.tsx` | Profile card, badges grid, stats dashboard, account section (sign in/up, what's new, sign out, delete). |
| `SignIn.tsx` | Account creation + sign-in (email/password, Turnstile captcha, live username availability). |
| `EditProfile.tsx` | Validated, server-checked username change. |
| `DeleteAccount.tsx` | POPIA right-to-erasure — type your username to arm, then full wipe. |
| `ResetPassword.tsx` | Recovery flow — set a new password from the emailed link. |
| `LocationPicker.tsx` | Place search picker (gazetteer + OSM) used by map/feed/builder. |
| `SearchBox.tsx` | Quest/place search with autocomplete hits. |
| `BottomNav.tsx` | The six-tab bottom navigation. |
| `ActiveQuest` / `PullHint.tsx` | Pull-to-refresh indicator (shared). |
| `Turnstile.tsx` | Cloudflare Turnstile invisible-captcha wrapper (sign-up protection). |
| `UpdateBanner.tsx` | Native APK update banner — check/download/install states. |
| `UpdatedNotice.tsx` | Web version-bump toast + release notes. |
| `Icon.tsx` | SVG icon set (24px grid, `currentColor` — app chrome, not quest content). |
| `ui.tsx` | Shared primitives — `Button`, `Stat`, `QuestStats`, `Bar`, `Sheet`, `Tag`, `Chip`, `SectionTitle`. |

---

## `scripts/` — dev & release tooling

| File | What it is |
|---|---|
| `sync-env.mjs` | Regenerates `.env` from `.env.defaults` when missing (runs before `dev`/`build`). |
| `check-quests.mjs` | Quest-catalog integrity checks (377 quests scanned, `npm run check:quests`). |
| `fetch-events.mjs` | Regenerates the events snapshot (`public/events-remote.json`) — Howler scrape + optional Ticketmaster (`npm run fetch:events`). |
| `generate-icons.mjs` | Regenerates every app icon from `assets/app-icon.jpg` (`npm run icons`). |
| `screenshot-app.mjs` | Regenerates README screenshots — headless Chrome, offline-safe, seeds a demo profile (`npm run screenshots`). |
| `build-apk.sh` | Builds the signed release APK with the bundled JDK (`npm run apk`). |
| `bump-version.sh` | Bumps the version in all three places: `package.json`, `src/lib/updater.ts`, `android/app/build.gradle`. |
| `release.sh` | Full release: bump → build APK → changelog → commit → tag → push → GitHub release (`npm run release`). |
| `make-friend.mjs` | Dev tool — sends a friend request from a fresh anonymous identity to test the friend flow in the UI. |
| `test-sync.mjs` | E2E sync test against the real Supabase project (two simulated devices, full friend flow). |
| `test-upgrade.mjs` | Tests the anonymous → email/password upgrade flow against the real project. |
| `cleanup-test-accounts.mjs` | Deletes test accounts from the live DB (needs the service-role key; dry-run by default). |

---

## `supabase/` — backend

### `migrations/` — 16 files, applied in order (0000 → 0014, then 0016)

> ⚠️ The Supabase GitHub integration that auto-deployed these pointed at the old
> code repo, which is now code-free — so migrations are applied **manually**
> (supabase CLI) unless the integration is re-linked. See `ARCHITECTURE.md`.
>
> Real filenames carry a timestamp prefix, e.g. `20260810000000_init.sql` — the
> short names below are shorthand.

| Migration | What it does |
|---|---|
| `0000_init.sql` | Base schema — profiles, quest/chain completions, badge earnings, friendships/requests, push tokens. |
| `0001_grants.sql` | Table grants for the anon + authenticated roles (auto-expose is OFF). |
| `0002_custom_quests.sql` | User-created anywhere quests, visible to creator + friends (RLS). |
| `0003_realtime_challenges.sql` | Realtime subscriptions for challenges + friend requests. |
| `0004_moderation.sql` | Community moderation — blocklist + server-side re-check trigger. |
| `0005_public_community.sql` | Community quests become platform-wide (public feed, auto-hidden filtered). |
| `0006_push_events.sql` | FCM pushes on friend-request / challenge insert (via `notify-user`). |
| `0007_push_accepts.sql` | Reverse pushes — when a request/challenge is accepted. |
| `0008_unique_usernames.sql` | Case-insensitive unique usernames. |
| `0009_remove_challenges.sql` | **Removes** the race/challenge feature (dropped in v1.0.15) — table, triggers, push functions. |
| `0010_account_deletion.sql` | Grants for the `delete-account` edge function (POPIA erasure). |
| `0011_quest_reviews.sql` | Reviews — only for quests you've actually completed (RLS `WITH CHECK`). |
| `0012_squads.sql` | Squads + members tables, realtime, RLS. |
| `0013_squad_create_fn.sql` | `create_squad()` SECURITY DEFINER helper (RLS blocks self-insert). |
| `0014_squad_rls_fix.sql` | Fixes the squad_members RLS infinite-recursion bug. |
| `0016_remove_xp_guard.sql` | Reverts the short-lived XP-guard triggers (0015, deleted) + drops the unused `v_leaderboard` view. |

### `functions/` — edge functions

| Function | What it does |
|---|---|
| `delete-account` | Permanently deletes a user's data + auth (service-role; POPIA erasure). |
| `notify-update` | Pushes to every registered device when a new release is published (invoked by the release workflow). |
| `notify-user` | Pushes to ONE user's devices — called by the 0006/0007 triggers for friend requests/accepts. |

---

## `android/` — the native shell (Capacitor)

| Path | What it is |
|---|---|
| `app/build.gradle` | App module — `versionName`/`versionCode` (bumped by `bump-version.sh`), signing from `keystore.properties`. |
| `variables.gradle`, `build.gradle`, `settings.gradle`, `capacitor.settings.gradle`, `gradle.properties` | Gradle plumbing (Capacitor plugin wiring, versions). |
| `gradlew` / `gradlew.bat` / `gradle/wrapper/*` | Pinned Gradle wrapper. |
| `keystore.properties` / `local.properties` | **Gitignored** — signing credentials + SDK paths. Never commit. |
| `app/src/main/java/com/jacy/sidequest/MainActivity.java` | Capacitor `BridgeActivity` — registers the updater plugin. |
| `app/src/main/java/com/jacy/sidequest/SideQuestUpdaterPlugin.java` | Native APK download + install (the self-update mechanism behind `updater.ts`). |
| `app/src/main/AndroidManifest.xml` | Permissions (location, notifications), deep-link scheme, launcher. |
| `app/src/main/res/` | Launcher icons, splash screens, notification icon, styles/strings. |

---

## `.github/` — no longer live on the public repo

> The workflows and templates below still exist in the local repo as history,
> but the GitHub repo is now the code-free download repo, so **none of them run
> anymore**. Nothing deploys from GitHub; releases and the events snapshot are
> handled manually from this machine.

| File | What it used to do |
|---|---|
| `workflows/events-fetch.yml` | Nightly events snapshot regeneration (the "auto search" engine) — superseded by the app's live Ticketmaster source. |
| `workflows/notify-release.yml` | FCM push to every device on release. |
| `workflows/pages.yml` | GitHub Pages deploy of the web app. |
| `ISSUE_TEMPLATE/*` + `PULL_REQUEST_TEMPLATE.md` | Community contribution templates. |

---

## Generated & gitignored — safe to ignore

`node_modules/`, `dist/`, `.freebuff/`, `android/app/build/`, `android/.gradle/`,
`android/capacitor-cordova-android-plugins/`, `*.tsbuildinfo`, `SideQuest.apk`,
`.env` (real values), `android/keystore.properties`, `android/local.properties`.

---

## Quick lookup

| Want to… | Open |
|---|---|
| Change a game rule (XP, ranks, badges) | `src/lib/game.ts` + `src/lib/game.test.ts` |
| Add a quest | `src/data/quests.ts` (or `events.ts`/`seasonal.ts` for dated ones) |
| Change how state is stored | `src/lib/store.tsx` |
| Add a Supabase call | `src/lib/sync.ts` (client) + `supabase/migrations/` (server) |
| Add an events source | `src/lib/eventsSync.ts` (+ `scripts/fetch-events.mjs` for the snapshot) |
| Change a screen | `src/components/<Screen>.tsx` + its classes in `src/styles.css` |
| Add a reusable UI piece | `src/components/ui.tsx` |
| Add a test | a new `src/lib/*.test.ts` (see `game.test.ts` for style) |
| Change app styling | `src/styles.css` |
| Change the Android app | `android/app/` (build.gradle, MainActivity, updater plugin) |
| Release / build the APK | `scripts/release.sh`, `scripts/build-apk.sh`, `npm run apk` |

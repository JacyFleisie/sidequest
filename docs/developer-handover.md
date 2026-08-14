# Project Developer Handover — SideQuest 🇿🇦

*Status: current as of v1.0.20 (August 2026). This document describes the final
state of the repository, including the app-icon pipeline.*

---

## 1. Executive Summary

SideQuest is a real-world adventure game for South Africa. It turns the whole
country into a game board: hundreds of hand-written "quests" are pinned to real
map locations, players actually go to the places, and GPS gating means a quest
only counts when your phone is there. XP, levels, ranks, badges, streaks,
friends, squads, reviews, seasonal events and a nightly auto-discovered
live-events feed keep the game alive.

Technically it is a **React 19 + TypeScript SPA** (Vite build) that runs in the
browser (GitHub Pages) and inside a **Capacitor 8 Android shell** (sideloaded
APK, self-updating via GitHub Releases + FCM push notifications). The game is
**offline-first**: the full quest catalog ships in the bundle and play is fully
local, with a progressive **Supabase (Postgres)** sync layer for accounts,
friends, squads, reviews and community quests. Authentication
is Supabase Auth with anonymous sign-in by default (each device gets a stable
uid) and optional email/Google account upgrades, protected by Cloudflare
Turnstile.

The codebase is intentionally small and cohesive for its feature surface: ~16k
lines of TS/TSX across `src/`, a 15-file SQL migration set in `supabase/`, a
handful of Deno edge functions, and shell/node scripts for builds, releases and
data quality. There is **no automated test suite** (no Vitest/Jest) — quality is
enforced by strict TypeScript, a build in CI, data-quality scripts, and manual
end-to-end sync tests run before releases.

---

## 2. What This Application Does

- **Explore a map of South Africa** — a dark Leaflet map with every quest pinned
  at its real location, searchable (local gazetteer + OpenStreetMap fallback),
  with marker clustering and resilient tile-provider failover.
- **Complete GPS-gated quests** — a quest only completes when the device is
  within ~5 km of the location; completions award XP, streaks and weather-aware
  badges.
- **Progress & glory** — levels, ranks (Rookie → Explorer → Trailblazer →
  Legend of SA), 46 badges, creator titles for community quest authors, and a
  stats dashboard.
- **Social layer** — friends (search by username, requests, accept/decline),
  real-time activity feed, squads (one per player, +20% XP bonus while in one),
  and quest chains shared as URL links.
- **Community content** — players create "anywhere" quests (platform-wide,
  moderated), rate and review quests they actually completed (completion-gated
  reviews, report + auto-hide moderation).
- **Live events** — a nightly GitHub Actions cron scrapes free sources (Howler,
  optional Ticketmaster key), geocodes and validates real dated events, commits
  `public/events-remote.json`, and the app merges those events into the map and
  feed with ticket links and countdowns.
- **Updates & notifications** — the Android app self-updates from GitHub
  Releases with an in-app banner; FCM pushes announce releases, friend requests
  and acceptances.

Intended users: South African students/young adults who want a reason to go
somewhere — solo or with a crew. The README describes the product voice
("Your life is the main story. South Africa is your map.") and the UI copy
matches it.

---

## 3. Technology Stack

| Category | Technology | Version | Purpose in this project |
|---|---|---|---|
| Language | TypeScript (strict) | ~5.8 | All app + edge-function code |
| Framework | React | ^19.1 | UI |
| Build tool | Vite | ^6.3 | Dev server + production bundle |
| Runtime (web) | Node.js | 20+ (CI) | Build, scripts |
| Native shell | Capacitor 8 (`@capacitor/core`, `@capacitor/android`) | ^8.5 | Android APK wrapper |
| Map | Leaflet + react-leaflet + leaflet.markercluster | 1.9 / 5.0 / 1.5 | Quest map, clustering, tile failover |
| Routing | react-router-dom | ^7.6 | SPA routes |
| Backend | Supabase (Postgres) + Supabase JS client | ^2.112 | Accounts, profiles, friends, squads, reviews, custom quests, push tokens |
| Auth | Supabase Auth (anonymous + email + Google, PKCE) | via client | Identity; anonymous by default |
| Realtime | Supabase Realtime (`postgres_changes`) | via client | Live friend requests, activity feed, squad roster, community quests |
| State | React Context + localStorage | — | Offline-first local game state |
| Styling | Hand-rolled CSS design tokens | — | "Golden Hour" warm light theme, mobile-first |
| Notifications | Firebase Cloud Messaging via `@capacitor/push-notifications` + Deno edge functions | 8.1 | Release + social pushes |
| Edge functions | Deno (`supabase/functions/`) | — | delete-account, notify-user, notify-update |
| Image pipeline (new) | sharp (devDependency) | ^0.35 | Regenerates app icons from `assets/app-icon.jpg` |
| CI/CD | GitHub Actions | — | Pages deploy, release pipeline, nightly events fetch, release notifications |
| Testing | Vitest (unit tests for game rules) + tsc/build + manual e2e scripts | 4.x | See §24 |

---

## 4. Repository Structure

```text
project/
├── src/                  # The whole app (TS/TSX + CSS)
│   ├── data/             # Static game content: quests, chains, places, events
│   ├── lib/              # Logic: game rules, sync engine, social, push…
│   ├── components/       # UI: screens, sheets, cards, forms
│   ├── App.tsx           # Routes + boot orchestration
│   ├── main.tsx          # Entry point
│   └── styles.css        # The single global stylesheet (design tokens)
├── android/              # Capacitor native shell (checked in)
│   └── app/src/main/java/com/jacy/sidequest/   # MainActivity + updater plugin
├── supabase/
│   ├── migrations/       # Versioned Postgres schema (deploys automatically)
│   └── functions/        # Deno edge functions (delete-account, notify-*)
├── scripts/              # Build/release/data-quality/dev tooling (node/bash)
├── .github/workflows/    # pages.yml, events-fetch.yml, notify-release.yml
├── assets/               # Hero SVG, screenshots, app-icon.jpg (master icon)
├── public/               # Static: events-remote.json, icon.png (generated)
├── docs/                 # database.md, fcm-setup.md, this handover
└── root files            # package.json, configs, README, CHANGELOG, etc.
```

---

## 5. Complete File Tree

```text
.
├── .env                            # generated from .env.defaults (gitignored)
├── .env.defaults                   # committed public values (Supabase URL/key, Turnstile key)
├── .gitignore
├── .github/workflows/
│   ├── events-fetch.yml            # nightly cron → regenerates live events feed
│   ├── notify-release.yml          # on release → FCM push to all devices
│   └── pages.yml                   # push to main → tsc + vite build → Pages deploy
├── CHANGELOG.md                    # versioned release notes
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE                         # MIT
├── README.md                       # extensive product + engineering docs
├── RELEASE_NOTES.md                # notes for the NEXT release
├── SECURITY.md
├── SideQuest.apk                   # local build artifact (gitignored)
├── assets/
│   ├── app-icon.jpg                # master app icon artwork (source for npm run icons)
│   ├── hero.svg                    # README hero image
│   └── screenshots/
├── android/                        # Capacitor 8 Android project (checked in)
│   ├── app/build.gradle
│   └── app/src/main/
│       ├── AndroidManifest.xml     # launcher activity, deep-link, FileProvider, FCM
│       ├── java/com/jacy/sidequest/
│       │   ├── MainActivity.java
│       │   └── SideQuestUpdaterPlugin.java   # downloadApk / installApk / showUpdatedNotification
│       └── res/
│           ├── mipmap-*/           # launcher icons (regenerated by npm run icons)
│           ├── mipmap-anydpi-v26/  # adaptive icon XML (bg + foreground)
│           ├── values/             # styles, ic_launcher_background (cream)
│           └── drawable*/          # splash backgrounds
├── capacitor.config.ts             # appId com.jacy.sidequest, webDir dist
├── docs/
│   ├── database.md                 # schema design notes (partly outdated, see §31)
│   ├── fcm-setup.md                # one-time Firebase setup
│   └── developer-handover.md       # this document
├── index.html                      # shell; favicon → %BASE_URL%icon.png
├── package.json / package-lock.json
├── public/
│   ├── events-remote.json          # nightly live-events feed (committed by CI)
│   └── icon.png                    # web favicon (generated by npm run icons)
├── scripts/
│   ├── build-apk.sh                # npm build + cap sync + gradle assembleRelease
│   ├── bump-version.sh             # version in package.json, updater.ts, build.gradle
│   ├── check-quests.mjs            # data-quality checks over all quests
│   ├── fetch-events.mjs            # nightly scraper (Howler + optional Ticketmaster)
│   ├── generate-icons.mjs          # NEW — icon pipeline (npm run icons)
│   ├── make-friend.mjs             # dev tool: force a friendship between two uids
│   ├── release.sh                  # end-to-end release (bump → apk → tag → gh release)
│   ├── sync-env.mjs                # predev/prebuild: keep .env in sync
│   ├── test-sync.mjs               # e2e sync tests against the live DB
│   └── test-upgrade.mjs            # e2e account-upgrade tests
├── src/
│   ├── App.tsx                     # routes, boot sync, toasts, shared-quest links
│   ├── main.tsx                    # React root + providers
│   ├── styles.css                  # design tokens + every component style
│   ├── vite-env.d.ts
│   ├── components/
│   │   ├── ActiveQuest.tsx         # GPS-gated in-progress quest UI + completion
│   │   ├── BottomNav.tsx           # 6-tab bottom navigation
│   │   ├── ChainBuilder.tsx        # build/share multi-stop chains
│   │   ├── CompletionModal.tsx     # post-completion celebration + memory/review
│   │   ├── CreateQuest.tsx         # community quest form (blocklist-checked)
│   │   ├── DeleteAccount.tsx       # POPIA erasure flow
│   │   ├── EditProfile.tsx         # username editor (availability check)
│   │   ├── Friends.tsx             # squad/activity tabs + find friends
│   │   ├── Generator.tsx           # the quest feed (Instagram-style, heavy filters)
│   │   ├── Home.tsx                # landing screen
│   │   ├── Icon.tsx                # inline SVG icon set for the nav
│   │   ├── LocationPicker.tsx      # city picker / use-my-location
│   │   ├── MapScreen.tsx           # Leaflet map, filters, search, live pins
│   │   ├── Profile.tsx             # player stats, badges, account, updates
│   │   ├── PullHint.tsx            # pull-to-refresh indicator
│   │   ├── QuestSheet.tsx          # bottom sheet with quest details + actions
│   │   ├── ResetPassword.tsx       # new-password sheet
│   │   ├── SearchBox.tsx           # gazetteer + OSM place/quest search
│   │   ├── SignIn.tsx              # email/Google sign-in + account creation
│   │   ├── SquadPanel.tsx          # squad creation/roster/invite UI
│   │   ├── Turnstile.tsx           # Cloudflare Turnstile widget wrapper
│   │   ├── ui.tsx                  # shared Button/Sheet/Chip/Bar/Stat primitives
│   │   ├── UpdateBanner.tsx        # "update available" banner (Android)
│   │   └── UpdatedNotice.tsx       # "what's new" toast after an update
│   ├── data/
│   │   ├── quests.ts               # provinces, home bases, Quest type, ~core quests + chains
│   │   ├── hangouts.ts             # everyday hangout quests (2.4k lines)
│   │   ├── social.ts               # social/silly quests
│   │   ├── seasonal.ts             # limited-time SA-event quests (expiresAt)
│   │   ├── events.ts               # researched real events (eventType + ticketInfo)
│   │   └── places.ts               # SA gazetteer for autocomplete
│   └── lib/
│       ├── eventsSync.ts           # fetch/cache/merge the live events feed
│       ├── friends.ts              # deterministic demo friend profiles + rivalry
│       ├── game.ts                 # XP/levels/ranks/badges/stats/geo helpers
│       ├── moderation.ts           # blocklist + report helpers
│       ├── push.ts                 # FCM registration
│       ├── reviews.ts              # quest review fetch/save/report
│       ├── share.ts                # chain share-link encoding + native share
│       ├── squads.ts               # squad fetch/create/invite/leave + bonus flag
│       ├── store.tsx               # GameProvider: offline-first local state
│       ├── supabase.ts             # Supabase client (null when unconfigured)
│       ├── sync.ts                 # the sync engine (identity, profile, social, auth)
│       ├── taglines.ts             # rotating micro-copy
│       ├── updater.ts              # GitHub release check/download/install
│       └── usePullToRefresh.ts     # pull-to-refresh hook
└── supabase/
    ├── migrations/                 # 0000_init … 0014_squad_rls_fix (see §15)
    └── functions/
        ├── delete-account/index.ts # service-role account erasure
        ├── notify-user/index.ts    # FCM push to one user (DB triggers call it)
        └── notify-update/index.ts  # FCM push to all devices on release
```

---

## 6. File-by-File Documentation

The most important files first; remaining files get briefer treatment.

### `src/lib/store.tsx`

**Purpose.** The heart of the offline-first game. A React context (`GameProvider`)
owns the entire local game state (`PersistedState`), persists it to
`localStorage` under `sidequest-state-v1` on every change, and exposes a
`useGame()` hook with typed actions.

**Responsibilities.** All local mutations: starting/completing/abandoning quest
sessions, streaks, XP awarding (including the squad +20% multiplier via
`inSquad()`), memories, custom quests/chains, friends list, feed-location
state.

**Important exports.** `PersistedState`, `GameApi`, `GameProvider`, `useGame`,
and domain types (`Quest`, `Friend`, `ActiveSession`, `CompletedEntry`, …).

**Key logic.** `completeActiveSession()` is the single place XP is awarded:
it walks the session steps, marks new completions, computes the streak (yesterday
→ +1, otherwise reset), applies `inSquad() ? 1.2 : 1`, and produces a
`LastCompletion` with level/rank change detection. Ids for chains/sessions use
`s-`, `c-`, `f-` prefixes that the sync layer recognises.

**Side effects.** Reads/writes `localStorage`; calls `registerCustomQuests()` /
`unregisterCustomQuest()` from `data/quests.ts` when custom quests change so
`questById()` resolves them everywhere.

**Problems.** None critical. The file mixes persistence, game rules and some
social state — acceptable for its size (432 lines) and cohesion.

### `src/lib/sync.ts` (915 lines — the largest logic file)

**Purpose.** The "sync engine": the bridge between the local game and Supabase,
plus all account/auth flows.

**Responsibilities.**

- **Identity**: `ensureIdentity()` returns the device's stable uid. The app
  signs in **anonymously** on first launch; the uid is reused forever
  (`profiles.id = auth.uid()`). It self-heals stale sessions (dead JWT after a
  DB wipe) by signing out and starting fresh. Anonymous sign-in passes a
  Turnstile token when captcha is enabled.
- **Push profile**: `syncProfile()` upserts the player's real stats into
  `profiles` (name, emoji, xp, streak, last quest date, home base).
- **Push completions**: `syncCompletions()` upserts quest/chain completions and
  evaluates + upserts badge earnings — idempotent, called on launch and after
  every completion.
- **Friends**: send/accept/decline friend requests, `fetchRealFriends()`
  (friendships + profiles + completion/badge counts), `findPeople()`
  (case-insensitive username search), username availability + rules.
- **Custom quests**: publish/fetch/delete/report community quests.
- **Auth flows**: `upgradeToAccount()` (anonymous → email/password with stale-
  session retry), `signInToAccount()`, `sendPasswordReset()`, `updatePassword()`,
  `signOutAccount()`, `deleteAccount()` (edge function), `handleAuthCallback()`
  (Android deep-link PKCE exchange), `getAccountInfo()`.
- **Realtime**: `subscribeIncomingRequests()` (deduplicated per-uid channels),
  `subscribeFriendFeed()` (friends' quest completions).
- **Activity feed**: `fetchFriendFeed()` returns friends' recent completions,
  resolving custom-quest titles.

**Key design.** Everything no-ops gracefully when `supabase` is null
(unconfigured/offline) — the app never breaks without a backend. RLS does the
authorization; the client just queries.

**Side effects.** Supabase network calls; `console.warn` on failures (never
throws to callers).

**Problems.** Large and dense, but cohesive. Duplicated query patterns exist
in several places (profiles + counts) — a candidate for a shared helper, but
fine as-is.

### `src/lib/game.ts`

**Purpose.** Pure game rules — no UI, no network.

**Exports.** `xpForLevel`, `levelFromXp`, `levelProgress`, `RANKS`, `rankFromXp`,
`BADGES` (46 badge definitions with `earned()` predicates and optional
`progress()`), `CREATOR_TIERS`, `creatorTierFor`, `nextCreatorTier`,
`playerStats`, `completedCountByProvince`, `totalQuestsInProvince`,
`isUpcomingEvent` (event horizon ~6 months), formatting helpers (`fmtDuration`,
`fmtCost`, `questCostLabel`, `difficultyStars`), and geo helpers (`haversineKm`,
`nearestBase`, `reverseGeocodeLabel`, `getDevicePosition`, `getUserLocation`,
`fetchWeather` — free Open-Meteo, used for the Rain Warrior badge).

**Key logic.** Badges are data, not scattered conditionals: each badge is an
object with a predicate over a `Progress` summary, and the sync layer reuses the
same definitions server-side (via `syncCompletions`) so the phone and the DB
agree on what's earned.

### `src/lib/friends.ts`

**Purpose.** Deterministic *demo* friend profiles (no backend). Used for
local-only friends: stats (xp, level, streak, quests, badges, provinces, recent
quests, favourite, badge events) are seeded from the friend's id so the same
friend always shows the same plausible profile. Real synced friends override
this via `fetchRealFriends` in `Friends.tsx`.

**Exports.** `friendId`, `friendProfile`, `timeAgo`, `rivalry`.

**Key logic.** A mulberry32 PRNG seeded by the friend id + a time component so
"stats grow" after the friend was added. `rivalry()` produces the friendly
one-liners on friend cards.

### `src/lib/squads.ts`

**Purpose.** Squad (co-op group) data layer. Module-level `squadStatus` tracks
whether the player is in a squad; `inSquad()` is consulted by the store at XP
award time to apply the +20% bonus. `fetchMySquad` refreshes the flag;
`createSquad` calls the `create_squad` SECURITY DEFINER RPC; invite/leave/
remove/disband go through RLS-scoped inserts/deletes; `subscribeSquad` keeps
the roster live via realtime.

### `src/lib/eventsSync.ts`

**Purpose.** Client side of the live-events pipeline. Fetches
`public/events-remote.json` (raw.githubusercontent, override with
`VITE_EVENTS_URL`), converts rows into `Quest` objects with ticket info and
countdowns, filters to upcoming events (`isUpcomingEvent`), caches in
localStorage for 12 h, and registers them app-wide via
`registerCustomQuests` so quest sheets resolve them. Dispatches
`sidequest:remote-events` so the map/feed refresh.

### `src/lib/moderation.ts`

**Purpose.** Community-content moderation: the client-side blocklist
(`BLOCKLIST_WORDS`, mirrored in migration 0004's seed), `findBlockedWords`
(whole-word, case-insensitive), `fetchBlocklist()` (live list from
`moderation_blocks`, always merged with the bundled list), and
`REPORT_THRESHOLD` (10).

### `src/lib/reviews.ts` *(briefly — see file for details)*

**Purpose.** Quest review operations: fetching visible reviews for a quest,
saving a review (the DB rejects reviews for quests the user hasn't completed),
deleting/editing own reviews, and reporting reviews. Complements migration 0011.

### `src/lib/push.ts`

**Purpose.** FCM registration (Android only; web no-ops). Attaches listeners
before `register()` (documented ordering requirement so the token is never
missed), saves the FCM token to `push_tokens`, and routes notification taps to
a handler (`setPushActionHandler`) so App.tsx can deep-link.

### `src/lib/share.ts`

**Purpose.** Chain share links. `encodeChainShare`/`decodeChainShare` pack
`{t, e, q}` into a base64url URL param; `shareBase()` returns the GitHub Pages
URL when running inside the native shell (local origin is unusable); `copyText`
(clipboard with execCommand fallback) and `shareViaNative` (Web Share API).

### `src/lib/updater.ts`

**Purpose.** Android self-update: compares versions, fetches the latest GitHub
release, finds the APK asset, and hands it to the native `SideQuestUpdater`
plugin. Also `detectJustUpdated()` (version watermark in localStorage + system
notification) and release-notes fetching/cleaning for the "What's new" sheet.

### `src/lib/usePullToRefresh.ts`

**Purpose.** Reusable touch-based pull-to-refresh. Returns `{pull, refreshing}`;
guards against triggering inside overlays/sheets, only activates at the top of
the page, supports a `startYMax` option (used by the map so pulls elsewhere pan
the map), and has a 2.5 s safety timeout so the spinner never sticks.

### `src/lib/taglines.ts`

**Purpose.** A tiny rotating copy module: three alternate taglines, one per day.

### `src/lib/supabase.ts`

**Purpose.** Creates the Supabase client from `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` (public values from `.env.defaults`), or exports
`supabase = null` when unconfigured (offline/demo mode). PKCE flow type for
reliable Android deep-link auth.

### `src/data/quests.ts`

**Purpose.** The static core: `Category`, `Vibe`, `ProvinceId`, `PROVINCES`
(9 provinces with badge metadata), `Quest`/`Chain` types, `HOME_BASES` (19 city
bases with region + neighbours), the curated quest list (built with a `q()`
helper), `CHAINS`, `ALL_QUESTS` (quests + chains + custom registration), and
lookup helpers (`findQuest`, `questById`, `registerCustomQuests`,
`unregisterCustomQuest`).

**Key logic.** `registerCustomQuests`/`unregisterCustomQuest` maintain a
module-level registry so dynamic quests (community, live events, local custom)
resolve identically to static ones everywhere. Quest data quality is enforced
by `npm run check:quests`.

### `src/data/hangouts.ts`, `social.ts`, `seasonal.ts`, `events.ts`, `places.ts`

- `hangouts.ts` — the big everyday layer (~2.4k lines): malls, parks, trails,
  food spots across SA.
- `social.ts` — social/silly free quests anchored to busy spots.
- `seasonal.ts` — limited-time quests tied to real SA events, each with
  `expiresAt` (feed shows countdowns and drops them once passed).
- `events.ts` — researched real festivals/markets/motorsport with `eventType`
  and `ticketInfo` (price + where to buy).
- `places.ts` — the SA gazetteer for autocomplete (cities, towns, suburbs,
  airports, universities, malls, landmarks with aliases); unknown queries fall
  back to OpenStreetMap Nominatim.

### `src/components/` (screens and UI — see §10/§11)

| File | Role |
|---|---|
| `Home.tsx` | Landing: greeting, hero stats, quick-start cards, rotating tagline |
| `MapScreen.tsx` | Leaflet map: filters, LIVE pins, search, location picker, tile failover, marker clustering, start marker, pull-to-refresh |
| `Generator.tsx` | The quest feed: category/vibe/anywhere/community/seasonal/Live/budget/location filters, shuffle/trending, community quest cards, create/report/delete |
| `QuestSheet.tsx` | Bottom sheet for quest/chain details: stats, directions, weather, ticket links, countdowns, start/review actions |
| `ActiveQuest.tsx` | The in-progress quest bar: GPS distance to each stop, completion gating (within 5 km), weather fetch, directions |
| `CompletionModal.tsx` | Post-completion celebration: XP, level/rank ups, memory save, review prompt |
| `ChainBuilder.tsx` | Multi-stop chain builder + share links |
| `Friends.tsx` | Squad / Activity tabs, find-friends search, friend cards, requests, friend sheet |
| `SquadPanel.tsx` | Squad creation, roster, invites, leave/disband |
| `Profile.tsx` | Player card, stats dashboard, SA completion, badges, creator tier, account card, home base, memories, updates card, reset |
| `SignIn.tsx` / `Turnstile.tsx` | Email/Google auth sheet; Turnstile captcha wrapper |
| `EditProfile.tsx` / `DeleteAccount.tsx` / `ResetPassword.tsx` | Account management sheets |
| `CreateQuest.tsx` | Community quest form with blocklist check |
| `SearchBox.tsx` | Place/quest search (gazetteer + OSM fallback) |
| `LocationPicker.tsx` | City picker / use-my-location |
| `UpdateBanner.tsx` / `UpdatedNotice.tsx` | Android update banner; post-update "what's new" |
| `PullHint.tsx` | Pull-to-refresh indicator visuals |
| `BottomNav.tsx` / `Icon.tsx` | 6-tab nav + inline SVG icons |
| `ui.tsx` | Shared `Button`, `Stat`, `QuestStats`, `Bar`, `Sheet`, `Chip`, `Tag`, `SectionTitle` |

### `src/App.tsx` / `src/main.tsx`

`main.tsx` mounts `<GameProvider><BrowserRouter><App/>`. `App.tsx` is the
orchestrator: password-recovery detection, boot sync (`ensureIdentity` →
`syncCompletions` → `syncProfile` → push init → subscriptions for friend
requests and squads → `syncRemoteEvents`), Android Google-OAuth deep-link
handling, debounced stat pushes, shared-chain `?chain=` decoding, realtime
toasts, and the route table.

### `supabase/migrations/` — see §15 for the full schema walkthrough.

### `supabase/functions/` — see §16/§26 for details.

### `scripts/` — see §25.

### Root config files

- `capacitor.config.ts` — `com.jacy.sidequest`, `webDir: dist`.
- `vite.config.ts` — React plugin only.
- `index.html` — favicon + apple-touch-icon now point at `%BASE_URL%icon.png`.
- `tsconfig*.json` — strict TypeScript project references.
- `.env.defaults` — committed public values (Supabase URL, anon key, Turnstile
  site key); `sync-env.mjs` copies it into `.env` on dev/build.

---

## 7. Application Architecture

```text
                    ┌──────────────────────────────┐
                    │         SideQuest app        │
                    │   React SPA (web + Capacitor)│
                    └──────┬───────────────┬───────┘
                           │               │
              ┌────────────▼─────┐   ┌─────▼──────────────────┐
              │  Local game      │   │  Supabase (Postgres)    │
              │  · quests, XP    │   │  profiles / friends     │
              │  · offline-first │   │  squads / reviews       │
              │  · localStorage  │   │  custom quests          │
              │  · store.tsx     │   │  stats + names           │
              └────────────┬─────┘   └─────┬──────────────────┘
                           │               │
                           └── sync engine ┘
                          (idempotent, offline-safe)

  GitHub Pages       → live demo + shared quest links
  GitHub Releases    → APK downloads + in-app auto-updates
  FCM (edge fns)     → push notifications (releases, friend requests)
  Nightly cron       → scripts/fetch-events.mjs → public/events-remote.json → app
```

Three architectural pillars:

1. **Offline-first local game.** The entire quest catalog ships in the bundle;
   `store.tsx` + `localStorage` hold all game state. The app is fully playable
   with no connection.
2. **Progressive sync.** `sync.ts` pushes the real numbers to Supabase whenever
   it can. Every sync call no-ops offline. RLS ensures users can only read/write
   what they're allowed to.
3. **Content grown by CI.** The live-events feed is scraped nightly by GitHub
   Actions and committed; the app just fetches the static JSON.

---

## 8. Application Startup Flow

```text
main.tsx
  → createRoot(...).render(<GameProvider><BrowserRouter><App /></...>)
  → GameProvider: loads sidequest-state-v1 from localStorage (or defaults)
  → App:
      1. Subscribe to auth state (PASSWORD_RECOVERY → ResetPassword sheet)
      2. Boot sync (async):
           ensureIdentity()           # getSession → validate → anonymous sign-in
           syncCompletions(uid, state)  # push quests/chains/badges (idempotent)
           syncProfile(uid, state)      # push stats into profiles
           setPushActionHandler(...)    # deep-link taps → /friends
           initPushNotifications()      # FCM registration (Android)
           subscribeIncomingRequests()  # realtime friend-request toasts
           fetchMySquad() + subscribeSquad()
           syncRemoteEvents()           # fetch + register live events feed
      3. Register Android deep-link handler (Google OAuth / password reset)
      4. Debounced re-push whenever xp/streak/name/completions change
      5. Decode ?chain= shared quest link if present
  → Routes render the current page; BottomNav + ActiveQuest + CompletionModal
    are always mounted
  → UpdateBanner (Android) checks GitHub for a newer release
  → UpdatedNotice shows release notes if an update just installed
```

---

## 9. Routing

| Route | Page | Auth | Notes |
|---|---|---|---|
| `/` | Home | none | Landing + quick start |
| `/map` | MapScreen | none | Leaflet map |
| `/feed` | Generator | none | Quest feed (community + live events) |
| `/generate` | → `/feed` | none | Legacy redirect (old shared links) |
| `/builder` | ChainBuilder | none | Multi-stop chain builder |
| `/friends` | Friends | none | Squad / Activity |
| `/profile` | Profile | none | Stats, badges, account, updates |
| `*` | → `/` | none | Fallback |

There are no protected routes — the app is playable anonymously. Account
features are gated by RLS server-side, not by routes.

---

## 10. Pages & Screens

- **Home (`/`)** — hero copy, "0 quests done / XP / streak" buttons (link to
  map/feed), quick-start cards, home base line, rotating tagline. No data
  loading beyond local state.
- **Map (`/map`)** — the game board. Filters (categories, Live, Trending,
  show-done), search, location picker (19 cities or GPS with reverse geocode),
  start marker, live events with pulsing red pins, cluster badges, tile-provider
  failover, pull-to-refresh (remounts map preserving the camera). Tapping a pin
  opens the QuestSheet.
- **Feed (`/feed`)** — Instagram-style quest list with an extensive filter bar
  (category, vibe, anywhere, community, seasonal, Live + date range, festival/
  market/automotive, budget slider, feed location + radius, trending), shuffle,
  pagination, community quest cards with creator titles, report/delete, and a
  "Create" button (CreateQuest sheet).
- **Friends (`/friends`)** — two tabs: **Squad** (squad panel, you-card,
  find-friends search, friend list with rivalry lines, friend sheet) and
  **Activity** (live quest feed + badge buzz from real completions). Friend
  requests appear above the tabs. Pull-to-refresh refetches everything.
- **Profile (`/profile`)** — player card (avatar emoji, name edit, level/rank,
  XP bars), account card (sign in / out / edit / delete), stats dashboard (time,
  places, favourite province, per-category bars), SA completion (9 provinces),
  46 badges with detail sheets, creator tier card, home base picker, quest
  memories, about & updates card, reset-progress button.

---

## 11. Components (key ones)

- **QuestSheet** — portal-rendered bottom sheet showing a quest or chain:
  hero emoji, description, stats row (duration/cost/players/difficulty), vibe
  chips, directions (Google Maps / Waze via deep links), ticket link + countdown
  for live events, "Start quest" button, review UI for completed quests.
- **ActiveQuest** — persistent bottom bar while a session is in progress.
  Computes GPS distance to each stop (haversine); a stop unlocks when within
  5 km; fetches weather on completion (Rain Warrior badge); offers directions.
- **CompletionModal** — celebratory overlay after finishing: XP gained, level/
  rank change, completion line, memory save, review prompt, dismiss.
- **MapScreen internals** — `FallbackTiles` (error-counting tile failover with
  defensive index clamping), `MapSizer` (ResizeObserver + invalidateSize for
  WebView layout shifts), `QuestMarkers` (marker-cluster group with divIcon
  pins), `StartMarker`.
- **Generator internals** — `QuestCard` renders a feed item (title, expiry/
  countdown chips, live-event ticket row, creator chip, report/delete, start).
- **Friends internals** — `FriendSheet` (friend profile sheet).
- **ui.tsx primitives** — `Button` (primary/ghost/gold), `Sheet` (modal with
  overlay), `Chip` (filter pills), `Bar` (progress), `Stat`/`QuestStats`,
  `Tag`, `SectionTitle`. Used across all screens — add new UI here first.

---

## 12. Features

```text
SIDEQUEST
├── Map & discovery        MapScreen, SearchBox, LocationPicker, places.ts
├── Quest catalog          data/*.ts (quests, hangouts, social, seasonal, events)
├── Game progression       store.tsx (award), game.ts (levels/ranks/badges/stats)
├── Quest completion       ActiveQuest (GPS gate), CompletionModal
├── Live events            events-fetch.yml → fetch-events.mjs → eventsSync.ts
├── Friends                sync.ts (requests), Friends.tsx, friends.ts (demo)
├── Squads                 squads.ts, SquadPanel, migrations 0012–0014
├── Community quests       CreateQuest.tsx, sync.ts (save/fetch/report), moderation
├── Reviews                reviews.ts, QuestSheet (review UI), migration 0011
├── Chains & sharing       ChainBuilder.tsx, share.ts, App.tsx (?chain=)
├── Accounts & auth        SignIn.tsx, Turnstile.tsx, sync.ts (auth flows)
├── Account deletion       DeleteAccount.tsx, delete-account edge fn
├── Push notifications     push.ts, notify-user/notify-update edge fns, migrations 0006–0007
├── Self-update            updater.ts, SideQuestUpdaterPlugin.java, UpdateBanner
└── App icon (NEW)         assets/app-icon.jpg → generate-icons.mjs → mipmaps/icon.png
```

---

## 13. Data Flow

**Completing a quest (the core loop):**

```text
User reaches the place
  → ActiveQuest shows "within range" (haversine ≤ 5 km)
  → user taps Complete → CompletionModal
  → store.completeActiveSession()
      → XP awarded (squad bonus ×1.2), streak updated, badges re-evaluated
  → App's debounced effect (1.5 s)
      → syncCompletions(uid, state) → quest_completions / chain_completions / badge_earnings
      → syncProfile(uid, state) → profiles (xp, streak, last_quest_at)
  → friends' apps: realtime quest_completions → activity feed refetch
```

  → pull-to-refresh on the Friends page bumps refreshKey → refetch
```

**Live events:**

```text
GitHub Actions cron (04:00 UTC)
  → scripts/fetch-events.mjs (Howler + optional Ticketmaster)
  → geocode + validate → commit public/events-remote.json
  → pages.yml deploys → app fetches raw.githubusercontent (12 h cache)
  → eventsSync.ts → registerCustomQuests → sidequest:remote-events
  → MapScreen pins + Generator feed refresh
```

---

## 14. API Architecture

There is no bespoke backend API. The "API" is Supabase's PostgREST (the
`supabase-js` client), the GitHub REST API (releases — public repo, no key),
free third-party public APIs (Open-Meteo weather, OSM Nominatim, CARTO/OSM map
tiles), and two internal webhooks (edge functions).

### Supabase endpoints used by the app

| Table / RPC | Operations | Used by | Purpose |
|---|---|---|---|
| `profiles` | SELECT (all), INSERT/UPDATE (own) | sync.ts, squads.ts, friends | Stats, names, home base |
| `friend_requests` | SELECT/INSERT/UPDATE | sync.ts | Pending → accepted flow |
| `friendships` | SELECT/INSERT/DELETE | sync.ts | Accepted mutual pairs (RLS-scoped) |
| `quest_completions` | SELECT/INSERT/UPDATE | sync.ts, friends | Feed, counts, reviews gate |
| `chain_completions` | SELECT/INSERT | sync.ts | Multi-stop completions |
| `badge_earnings` | SELECT/INSERT | sync.ts, friends | Badge counts + events |
| `custom_quests` | SELECT/INSERT/DELETE | sync.ts, Generator | Community quests |
| `quest_reviews` | SELECT/INSERT/UPDATE/DELETE | reviews.ts | Ratings & reviews |
| `quest_reports` / `review_reports` | SELECT/INSERT | sync.ts, reviews.ts | Moderation |
| `moderation_blocks` | SELECT | moderation.ts | Live blocklist |
| `squads` / `squad_members` | SELECT/INSERT/UPDATE/DELETE | squads.ts | Co-op groups |
| `push_tokens` | SELECT/INSERT/DELETE | push.ts, edge fns | FCM device tokens |
| `rpc('create_squad')` | EXECUTE | squads.ts | Atomic squad creation |
| `functions.invoke('delete-account')` | POST | sync.ts | Account erasure |

### GitHub API (public repo, no auth)

| Endpoint | Used by | Purpose |
|---|---|---|
| `GET /repos/JacyFleisie/sidequest/releases/latest` | updater.ts | Update check + notes |
| `GET /repos/.../releases/tags/vX.Y.Z` | updater.ts | Release notes for an installed version |
| raw `events-remote.json` | eventsSync.ts | Live events feed (12 h cache) |

### Third-party public APIs

- **Open-Meteo** — weather at completion (Rain Warrior / Sun Seeker badges).
- **OSM Nominatim** — reverse geocoding for "use my location", place search fallback.
- **CARTO / OSM tile servers** — map tiles, with failover.
- **Firebase HTTP v1** — FCM sends (from edge functions only).

---

## 15. Database Architecture

Postgres on Supabase. Migrations deploy automatically via the Supabase GitHub
integration (pushed to `main`).

**Tables** (migration 0000 + 0002–0014):

```text
profiles (id = auth.uid, name, emoji, xp, streak, last_quest_at,
          home_base_id, start_place jsonb, created_at, last_active_at)
 ├── friend_requests (sender_id, recipient_id, status pending→accepted/declined)
 ├── friendships (user_a_id < user_b_id, PK pair)
 ├── quest_completions (profile_id, quest_id, completed_at, xp, weather, dist_from_home_km)
 ├── chain_completions (profile_id, chain_id, completed_at, xp, is_custom)
 ├── badge_earnings (profile_id, badge_id, earned_at)
 ├── push_tokens (profile_id, token, platform, updated_at)
 ├── custom_quests (profile_id, title, description, emoji, category, vibe[],
 │                  duration/cost/players/difficulty/xp, tags, report_count, hidden)
 │     └── quest_reports (custom_quest_id, reporter_id) — auto-hide at 10
 ├── quest_reviews (profile_id, quest_id, rating 1–5, comment,
 │                  report_count, hidden) — insert gated on quest_completions
 │     └── review_reports (review_id, reporter_id) — auto-hide at 5
 ├── squads (name, emoji, created_by) ← squad_members (squad_id, profile_id,
 │            role leader/member, unique per profile — one squad per player)
 └── moderation_blocks (word) — blocklist for the triggers

Views (unused legacy): v_friend_feed
Non-public: app_config (push_fn_url, push_webhook_secret — set via dashboard)
Functions: notify_push(), push_friend_request(), push_friend_accepted(),
           on_quest_report(), on_review_report(), block_flagged_content(),
           block_flagged_review(), create_squad() (SECURITY DEFINER),
           is_squad_member() (SECURITY DEFINER)
Extension: pg_net (async webhooks to edge functions)
```

**Key constraints / invariants:**

- `profiles.id = auth.uid()`; `ON DELETE CASCADE` from profiles to everything.
- One live friend request per pair (`uq_friend_req_live` partial index).
- Friendships stored once with `user_a_id < user_b_id`.
- Usernames unique case-insensitively, **except** the anonymous default
  `'SideQuester'` (migration 0008 partial index).
- One squad per player (partial unique index on `squad_members(profile_id)`).
- Reviews only insertable when the reviewer completed the quest (RLS `WITH
  CHECK` on `quest_completions`).
- Report counts auto-hide content at thresholds (10 for quests, 5 for reviews).
- Blocklist trigger rejects flagged words on insert/update of quests and
  reviews (server-side backstop to the client check).

**Realtime publication:** `friend_requests`, `quest_completions`,
`custom_quests`, `squads`, `squad_members` (challenges removed in 0009).

**Data access:** `anon`/`authenticated` grants per table (migration 0002 —
"automatically expose tables" is OFF), RLS policies everywhere, `service_role`
grants only for edge-function tables (migration 0010).

---

## 16. Authentication

- **Default: anonymous sign-in.** First launch calls
  `supabase.auth.signInAnonymously()` (with an invisible Turnstile token when
  captcha is enabled). Supabase persists the session, so the device keeps the
  same uid forever. The uid *is* the profile id.
- **Account upgrade:** `upgradeToAccount()` calls `auth.updateUser({email,
  password})` on the anonymous user — same uid, no data migration. Handles
  stale sessions (DB wipes) with a fresh-anonymous retry.
- **Google:** `SignIn.tsx` uses the web flow; on Android the PKCE callback
  arrives as `com.jacy.sidequest://auth/callback`, exchanged in `App.tsx` via
  `handleAuthCallback()` (PKCE `code` or legacy `#access_token=`).
- **Password reset:** email link → recovery session (`PASSWORD_RECOVERY` event)
  → `ResetPassword` sheet → `updatePassword()`.
- **Sign out:** back to anonymous mode (local state is untouched).
- **Delete account:** `delete-account` edge function (service role) deletes the
  profile (cascades) then the auth user — POPIA right to erasure.

**Flow:** credentials → `SignIn.tsx` → `sync.ts` → Supabase Auth → session
persisted → `onAuthChange` refreshes account UI → stats continue to sync to the
same profile id.

---

## 17. Authorization & Permissions

All authorization is **server-side RLS**, never client checks:

- `profiles` — SELECT for everyone (by design: that's how friend search
  works); INSERT/UPDATE only your own row.
- `friend_requests` / `friendships` — only the involved users.
- `quest_completions` / `chain_completions` / `badge_earnings` — SELECT all
  (feeds, rivalries), writes only your own.
- `custom_quests` — SELECT all (platform-wide feed; hidden rows filtered by the
  app, except the owner can see their own), writes only your own.
- `quest_reviews` — SELECT all; INSERT only if you completed the quest; edit/
  delete own only.
- `squads` / `squad_members` — members see the squad; the leader invites,
  removes and disbands; anyone leaves by deleting their own row; creation only
  through `create_squad()`.
- `push_tokens`, `app_config` — private / not granted at all.
- Edge functions — verify JWT (delete-account) or shared webhook secrets
  (notify-user, notify-update).

---

## 18. State Management

**Local (offline-first, `store.tsx` → localStorage `sidequest-state-v1`):**
everything about the game: xp, streak, completed map, memories, active session,
custom quests/chains, friends, home base, feed place, recent generated ids.

**Server state (fetched per screen):** real friends, friend requests, squad,
feed events, community quests, reviews, live events — each screen
fetches what it needs and subscribes to realtime where live updates matter
(friend requests, squad roster, quest completions, custom quests).

**Cross-cutting module state:** `squads.ts` holds `squadStatus` (drives the XP
bonus everywhere); `push.ts` holds the tap handler; `supabase.ts` holds the
client.

**Transient UI state:** local `useState` in each component; no global UI store.

---

## 19. Configuration & Environment Variables

| Variable | Purpose | Required | Where read |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes (else offline mode) | `src/lib/supabase.ts` |
| `VITE_SUPABASE_ANON_KEY` | Publishable anon key | Yes (else offline mode) | `src/lib/supabase.ts` |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key | No (captcha off) | `src/components/Turnstile.tsx` |
| `VITE_EVENTS_URL` | Override the live-events feed URL | No (defaults to raw GitHub) | `src/lib/eventsSync.ts` |

Public values live in committed `.env.defaults`; `scripts/sync-env.mjs` (predev/
prebuild) creates/updates the gitignored `.env`. The built web app and APK ship
these values anyway, so nothing here is secret.

**Deployment secrets (never in the repo):** `TICKETMASTER_API_KEY`,
`SUPABASE_PROJECT_REF`, `SUPABASE_ANON_KEY`, `UPDATE_WEBHOOK_SECRET` (GitHub
Actions secrets); `NOTIFY_WEBHOOK_SECRET`, `FCM_SERVICE_ACCOUNT` (edge-function
secrets); `push_fn_url` / `push_webhook_secret` (DB `app_config`, set via
dashboard); Android signing keystore (`sidequest-release.keystore`,
`android/keystore.properties`, both gitignored).

---

## 20. Dependencies

| Package | Why | Essential? |
|---|---|---|
| `react`, `react-dom` | UI | Yes |
| `react-router-dom` | Routing | Yes |
| `leaflet`, `react-leaflet`, `leaflet.markercluster` | Map + clustering | Yes |
| `@supabase/supabase-js` | Backend/auth/realtime | Yes |
| `@capacitor/*` (core, android, app, cli, push-notifications) | Native shell + FCM | Yes (Android) |
| `sharp` *(dev)* | Icon generation (`npm run icons`) | Dev-only; justifies itself as the icon pipeline |
| `vitest` *(dev)* | Unit tests (`npm test`) | Dev-only; tests `game.ts` rules |
| `typescript`, `vite`, `@vitejs/plugin-react` | Toolchain | Yes |

No obvious duplicate libraries. No runtime UI/state libraries beyond React —
state is hand-rolled context, styling is hand-rolled CSS.

---

## 21. UI / Design System

- **One global stylesheet** (`src/styles.css`, ~1.7k lines) with CSS custom
  properties (design tokens) in `:root`: warm sand/cream surfaces, gold/green/
  purple accents, warm-tinted shadows, editorial Georgia display font + Segoe UI
  body. Components never hard-code colors/radii.
- **Shared primitives** in `ui.tsx`: `Button`, `Sheet`, `Chip`, `Bar`, `Stat`,
  `QuestStats`, `Tag`, `SectionTitle`.
- **Navigation:** floating 6-item bottom nav (`BottomNav.tsx` + `Icon.tsx`
  inline SVGs).
- **Patterns:** bottom sheets for detail views, chips for filters, cards for
  feed/friends rows, `seg` segmented control for tabs (Friends),
  `PullHint` for pull-to-refresh.
- **Accessibility:** focus-visible outlines, `aria-label`s on icon buttons,
  semantic buttons/lists, `prefers-reduced-motion` support, `aria-hidden` on
  decorative rank badges.

---

## 22. Error Handling

- **Sync layer:** every function catches failures and returns safe defaults
  (`null`, `[]`, `false`) with a `console.warn` — offline is a first-class
  state, not an error.
- **UI:** screens render explicit states — loading, empty, error/offline
  messages (feed empty states with taglines, update-card error with retry).
- **Pull-to-refresh** has a 2.5 s safety timeout so the spinner never sticks.
- **Map tiles:** error-counting failover between providers, with a retry button
  when all are dead.
- **Auth:** friendly error mapping (email rate limits, duplicate emails, stale
  sessions), retries for anonymous sign-in after stale sessions.
- **Network:** `AbortSignal.timeout` on events fetch; 6 s geolocation timeout;
  4 s weather timeout.

---

## 23. Validation

- **Client:** username rules (`USERNAME_RULES`, 2–20 chars, pattern) + live
  availability check; quest form validation in `CreateQuest.tsx`; blocklist
  check on quest/review text before save; budget slider bounds; chain share
  decode length caps.
- **Server (RLS + CHECKs):** username uniqueness (partial index); quest field
  CHECKs (title length, category enum, cost/difficulty ranges); review
  completion-gate; squad name length; one-squad-per-player; report uniqueness.
- **Server triggers:** blocklist rejection on insert/update of quests and
  reviews (bypass-proof backstop).

---

## 24. Testing**Vitest unit tests** (`npm test` → `vitest run`, configured in
`vite.config.ts`, node environment):

- `src/lib/game.test.ts` — the core rules: level/rank thresholds, badge
  catalog integrity (46 unique ids), every badge rule (counts, streaks,
  categories, provinces, time-of-day, weather, distance, XP), progress
  reporting, creator tiers, event horizon, `playerStats`, province stats,
  formatting and geo helpers.
Other verification, as before:

- `npm run typecheck` (`tsc -b`, strict) — runs in CI before every deploy
  (test files are typechecked too).
- `npm run build` — production build.
- `npm run check:quests` — data-quality checker over all quests (missing
  province/city/region, coords outside SA, duplicate titles within 1 km,
  unfillable cards).
- `scripts/test-sync.mjs` / `scripts/test-upgrade.mjs` / `scripts/make-friend.mjs`
  — manual/dev e2e against the live database with throwaway accounts
  (README: "E2E-verified features … tested against the live database before
  each release").

**Gaps:** no automated tests yet for the store (`store.tsx` award/streak
logic), `sync.ts`, components, or the icon generator. The roadmap in the
README lists a Playwright e2e suite as future work.

---

## 25. Build & Development Workflow

```bash
npm install
npm run dev              # vite dev server (auto-creates .env from .env.defaults)
npm run typecheck        # tsc -b
npm test                 # vitest run (game rules)
npm run build            # tsc -b && vite build → dist/
npm run check:quests     # quest data quality
npm run fetch:events     # run the live-events scraper now
npm run icons            # regenerate app icons from assets/app-icon.jpg
npm run apk              # bash scripts/build-apk.sh → SideQuest.apk (signed)
npm run release [major|minor|patch] [--silent]   # full release pipeline
```

`build-apk.sh` needs Java 17+ and the Android SDK (uses the Android Studio
bundled JBR on Windows). `release.sh` bumps the version everywhere, rebuilds,
tags `vX.Y.Z`, creates a GitHub release with the APK, deploys Pages, and
notifies devices via FCM.

---

## 26. Deployment

- **Web:** GitHub Pages via `pages.yml` — `npm ci`, `tsc -b`, `vite build
  --base=/sidequest/`, copies `index.html` to `404.html` for SPA fallback, then
  `deploy-pages`. Live at `https://jacyfleisie.github.io/sidequest`.
- **Android:** no Play Store — sideloaded APKs attached to GitHub Releases.
  Devices self-update via `updater.ts` + the native plugin (download → install
  intent). FCM announces releases.
- **Database:** Supabase migrations auto-deploy on push to `main` via the
  Supabase GitHub integration. One-time secret config lives in the dashboard
  (see `docs/fcm-setup.md`, migrations 0006 comments).

---

## 27. GitHub & CI/CD

| Workflow | Trigger | What it does |
|---|---|---|
| `pages.yml` | push to `main`, manual | typecheck → build → Pages deploy |
| `events-fetch.yml` | cron 04:00 UTC, manual | scrape Howler (+Ticketmaster) → geocode/validate → commit `public/events-remote.json` |
| `notify-release.yml` | release published | POST to `notify-update` edge fn → FCM to all devices |

---

## 28. Important Files to Understand First

1. **`src/lib/store.tsx`** — the local game engine; everything about play.
2. **`src/lib/sync.ts`** — the bridge to the backend; identity + all social.
3. **`src/App.tsx`** — boot orchestration and routing.
4. **`src/lib/game.ts`** — rules: XP, ranks, badges, stats, geo.
5. **`supabase/migrations/20260810000000_init.sql`** — schema + RLS baseline.
6. **`src/lib/squads.ts` + migrations 0012–0014** — the most intricate RLS story.
7. **`scripts/generate-icons.mjs`** — the icon pipeline.
8. **`src/styles.css`** — design tokens; read the `:root` block before styling
   anything.

---

## 29. Areas Safe to Ignore Initially

- `src/data/*.ts` contents (quest lists) — pure content; `check-quests` guards
  quality.
- `assets/`, `public/events-remote.json`, screenshots, README badges.
- `android/` res drawables (splash), `@capacitor` boilerplate.
- `scripts/make-friend.mjs`, `test-sync.mjs`, `test-upgrade.mjs` — dev tools.
- `docs/database.md` — design notes; schema is stale in places (see §31).

---

## 30. Areas Requiring Caution

- **`store.completeActiveSession()`** — the single XP award point; any change
  here affects streaks, squad bonuses, badges and sync.
- **`sync.ts`** — 915 lines of subtle flows (stale-session healing, captcha,
  idempotent upserts). Change carefully; every function must keep its
  offline-safe no-op contract.
- **Squad RLS** (migrations 0012–0014) — recursion pitfalls; read the comments
  before touching policies.
- **Map internals** (`MapScreen.tsx` `FallbackTiles`/`MapSizer`) — hard-won
  resilience against tile outages and WebView resize bugs; the comments explain
  the traps (subdomain handling, layer-load vs tile-load, error bursts).
- **FCM/push ordering** in `push.ts` — listeners must attach before
  `register()`.
- **`eventsSync.ts`** — 12 h cache + `isUpcomingEvent` horizon; changes affect
  the whole live-events experience.
- **Moderation blocklist** — keep `src/lib/moderation.ts` in sync with the
  migration seed (words must be letters/spaces only for the SQL regex).

---

## 31. Technical Debt

| Location | Problem | Why it matters | Severity | Direction |
|---|---|---|---|---|
| `docs/database.md` intro | Says "Today the app has no backend" — outdated | Misleads new devs | Low | Rewrite intro to reflect the deployed schema |
| `Friends.tsx`, `Profile.tsx`, `sync.ts` | `LEVEL_EMOJI` array duplicated (and `playerEmoji`) | Drift risk | Low | Extract to `game.ts` |
| `src/lib/sync.ts` | Very large, many responsibilities | Hard to navigate | Medium | Consider splitting auth vs social vs quests |
| `App.tsx` | Handles `data.type 'challenge'/'challenge-accepted'` in the push handler, but challenges were removed (migration 0009) | Dead path | Low | Remove |
| `v_friend_feed` view | Created in 0000, never used by the app | Dead code | Low | Remove or adopt |
| Unit-test coverage incomplete | `game.ts` covered by Vitest; store (`store.tsx`), `sync.ts`, components and the icon generator remain untested | Regression risk in the most-touched logic | Medium | Extend Vitest to the store award logic and sync helpers; add a Playwright e2e suite (roadmap) |
| `SideQuest.apk` on disk (untracked) | Local artifact | Confusion | Low | Leave (gitignored) |

---

## 32. Potential Bugs

| Location | Observed | Assessment | Confidence | Impact |
|---|---|---|---|---|
| `Profile.tsx` pull-to-refresh | Only re-pushes local state to the server; doesn't pull server state down | Not a bug per se — a design choice ("re-sync your stats from the server" implies push) | Possible (label mismatch) | Low |
| `App.tsx` shared `?chain=` | `decodeChainShare` can produce quests from `ALL_QUESTS` only — live/community quest ids won't resolve and are silently dropped | Edge case, harmless | Possible | Low |
| `sync.ts` `playerEmoji` | Uses `LEVEL_EMOJI` local copy vs `Friends`/`Profile` copies — emoji sets could drift | Cosmetic | Possible | Low |
| `quests.ts` `anywhere()` builder | The 18 "anywhere" quests (`walk-nowhere-*`, `weirdest-r50-*`, `ice-cream-quest-*`, …) are built with real main-city coordinates and **without** `anywhere: true` (only `social.ts`/`seasonal.ts` set it via `qAny`). So the map shows them, the feed's Anywhere filter and the `anywhere-5/15` badges never count them, and cards label them by city — contradicting the builder's own "doable anywhere" comment | Wrong quest categorization | Possible (product intent unclear — could be deliberate) | Medium | Either set `anywhere: true` in the builder (matching the comment) or add a `check:quests` rule documenting the intent |

---

## 33. Security Findings

| Location | Issue | Risk | Severity | Remediation direction |
|---|---|---|---|---|
| `profiles.xp` is client-writable (RLS: own-row UPDATE) | Anyone with the anon key can write any XP/streak value to their own profile — self-reported stats only, no cross-user impact, but XP shown to friends/squads is untrusted. (A server-side guard was tried in migration 0015 and removed in 0016 per product decision.) | Profile XP integrity (friend/squad displays) | Medium | Reintroduce bounded-XP triggers or move to deterministic server-computed scores — see §42 |
| Anon key + URL in client bundle | By design (public publishable key) | Not a finding per se — document | Info | Keep RLS as the only real boundary |
| `app_config` webhook secrets | Held in DB, never granted to anon/authenticated; edge fns verify secrets | OK | Info | Keep grants restrictive |
| `delete-account` edge fn | Verifies JWT via `sub` claim parsing | OK — standard | Info | — |
| Client blocklist | Bypassable (that's why the trigger exists) | OK | Info | Server trigger is the backstop |

No credentials or secrets are present in the repository (all keys are the
public publishable anon key / Turnstile site key, which ship in the bundle by
design).

---

## 34. Dead Code

- `v_friend_feed` view (migration 0000, unused).
- `App.tsx` push-handler branches for `'challenge'` / `'challenge-accepted'`
  (feature removed in migration 0009).
- `scripts/make-friend.mjs` — dev-only utility (keep; used by the release
  testing workflow).
- `docs/database.md`'s "no backend" framing (stale prose, not code).

---

## 35. Duplicated Functionality

- `LEVEL_EMOJI` / `playerEmoji` in `Friends.tsx`, `Profile.tsx`, `sync.ts` —
  same 12-emoji level ladder. Intentional duplication today; consolidate into
  `game.ts`.
- Profile+counts query pattern (`fetchRealFriends`, `fetchMySquad`,
  `fetchFriendFeed`) — same shape three times; fine at this scale.
- Haversine/geo helpers centralized in `game.ts` (good).

---

## 36. Architectural Inconsistencies

- **Data access styles:** most reads go through `sync.ts`; `Generator.tsx`
  queries `quest_reviews` directly. Acceptable (each screen owns its queries),
  but note that `sync.ts` is the default home for Supabase queries.
- **CSS:** nearly all styles live in one file (intentional single-source), but
  some one-off inline styles exist in JSX (e.g. category gradients) — fine.
- **Realtime usage:** friend feed + requests + squad roster + custom quests
  are live where updates matter.

---

## 37. How Everything Connects

```text
STARTUP: main.tsx → GameProvider (localStorage) → App (boot sync + subs)
    │
    ├─ ROUTES → Home / MapScreen / Generator / ChainBuilder / Friends / Profile
    │
    ├─ GAME LOOP: MapScreen or Generator → QuestSheet → ActiveQuest (GPS gate)
    │      → store.completeActiveSession → CompletionModal
    │      → App debounce → syncCompletions/syncProfile → Supabase
    │
    ├─ SOCIAL: Friends.tsx → sync.ts (requests/friends/feed) + squads.ts (roster)
    │      → realtime channels → UI updates; XP bonus via squads.inSquad()
    │
    ├─ LIVE EVENTS: cron → fetch-events.mjs → events-remote.json → Pages
    │      → eventsSync.ts → registerCustomQuests → map/feed
    │
    ├─ ACCOUNT/AUTH: SignIn → sync.ts → Supabase Auth (PKCE, Turnstile)
    │      → deleteAccount → delete-account edge fn
    │
    └─ ANDROID: Capacitor shell → updater.ts + SideQuestUpdaterPlugin
           → GitHub Releases; push.ts + notify-* edge fns → FCM
```

---

## 38. Developer Onboarding Guide

1. Read the README (product + architecture + commands) and this handover.
2. `npm install && npm run dev` — play with the app (browser is fine).
3. Read `src/lib/store.tsx` — the game engine.
4. Read `src/lib/game.ts` — rules (XP, ranks, badges).
5. Read `src/App.tsx` and the route table — where screens hang.
6. Read `src/lib/sync.ts` — identity + how local state reaches Supabase.
7. Read `supabase/migrations/20260810000000_init.sql` — schema + RLS.
8. Skim `squads.ts` + migrations 0012–0014 — the trickiest RLS.
9. Run `npm run typecheck`, `npm run build`, `npm run check:quests`.
10. Try a feature end-to-end (e.g. follow a quest from the map to a
    completion in §13).

---

## 39. "Where Do I Go If...?" Guide

| If I want to... | Start here |
|---|---|
| Add a quest | `src/data/*.ts` + `npm run check:quests` |
| Change XP/levels/ranks/badges | `src/lib/game.ts` |
| Change how a quest completes | `src/lib/store.tsx` (`completeActiveSession`) + `ActiveQuest.tsx` |
| Add a new route/page | `src/App.tsx` + a component + a nav entry in `BottomNav.tsx` |
| Change friends behaviour | `src/lib/sync.ts` + `Friends.tsx` |
| Change squads | `src/lib/squads.ts` + migrations 0012–0014 |
| Change the feed | `src/components/Generator.tsx` |
| Change the map | `src/components/MapScreen.tsx` |
| Change styling | `src/styles.css` (tokens in `:root`); shared bits in `ui.tsx` |
| Add a Supabase query | follow `sync.ts` patterns; check grants + RLS |
| Change auth | `src/lib/sync.ts` (auth flows) + `SignIn.tsx` |
| Change push notifications | `src/lib/push.ts`, migrations 0006–0007, edge fns |
| Change the app icon | `assets/app-icon.jpg` → `npm run icons` |
| Change events feed | `scripts/fetch-events.mjs`, `src/lib/eventsSync.ts` |
| Add automated tests | create a Vitest setup; target `game.ts` first |
| Cut a release | `scripts/release.sh` (see README) |

---

## 40. Glossary

| Term | Meaning in this app |
|---|---|
| Quest | A real-world challenge pinned to a location (or "anywhere"), with XP, category, cost, duration |
| Chain | A multi-stop quest (official or user-built), shared as a URL |
| Anywhere quest | A quest with no location — doable right now |
| Home base | The player's chosen city (of 19) or exact GPS spot; measures "how far" |
| Region / neighbours | The 19 `HOME_BASES` each with a `region` id + neighbour regions; drives generator distances |
| XP / Level / Rank | Progression: XP → level (300·triangular); ranks Rookie→Explorer→Trailblazer→Legend of SA |
| Badge | 46 achievement definitions evaluated from a `Progress` summary |
| Streak | Consecutive days with ≥1 quest completed |
| Squad | One-per-player co-op crew; +20% XP bonus while a member |
| Creator tier | Vanity titles for community-quest authors (1/3/10/25 published) |
| Live event | A real dated ticketed event from the nightly feed (`remote-` quest ids) |
| Season | Limited-time quests with `expiresAt` |
| Sync | The progressive layer pushing local state to Supabase; all calls offline-safe |
| uid | The device's stable auth identity = `profiles.id` |

---

## 41. Unknowns & Unresolved Questions

- **`profiles.xp` trust:** XP is fully client-written (see §33). Anyone can
  write any XP to their own profile — acceptable for self-reported stats, but
  any ranking by XP should be treated as untrusted until the server owns the
  scoring.
- **docs/database.md** predates the current schema in places — a rewrite is
  recommended.

---

## 42. Recommended Next Steps

1. **Extend the Vitest suite** (now covers `game.ts`) to the store award logic
   (`completeActiveSession`), `sync.ts` helpers, and the icon generator.
2. **Server-side XP validation** — `profiles.xp` is client-writable (see
   §33); reintroduce bounded-XP triggers or deterministic server-computed
   scores if XP integrity matters.
3. **Remove dead code** (`v_friend_feed` view, challenge push branches) and
   consolidate the duplicated `LEVEL_EMOJI`.
4. **Rewrite `docs/database.md`** to match the deployed schema.
5. Follow the existing roadmap items (Play Store listing, isiZulu/Afrikaans
   localization, offline tile caching, Playwright e2e).

---

*Prepared as part of the codebase handover. Facts above are Confirmed (from
the repository) unless labelled otherwise. "Cannot determine" applies to
nothing structural; product decisions (XP trust) are flagged in §41.*

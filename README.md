<div align="center">

<img src="assets/hero.svg" alt="SideQuest — South Africa is your map" width="100%"/>

# SIDEQUEST 🇿🇦

**Your life is the main story. South Africa is your map.**

A real-world adventure game that turns the whole country into your playground.
Grab your friends, pick a quest, and go — a lunch break, a long weekend, or a
road trip to nowhere.

<br/>

[![Release](https://img.shields.io/github/v/release/JacyFleisie/sidequest?color=f5c542&label=latest%20release&style=flat-square)](https://github.com/JacyFleisie/sidequest/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/JacyFleisie/sidequest/total?color=108c43&label=APK%20downloads&style=flat-square)](https://github.com/JacyFleisie/sidequest/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/JacyFleisie/sidequest/pages.yml?color=108c43&label=build&style=flat-square)](https://github.com/JacyFleisie/sidequest/actions/workflows/pages.yml)
[![License](https://img.shields.io/github/license/JacyFleisie/sidequest?color=a55eea&label=license&style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Android%20%26%20Web-108c43?style=flat-square&logo=android&logoColor=white)](https://github.com/JacyFleisie/sidequest/releases/latest)
[![Made in](https://img.shields.io/badge/made%20in-South%20Africa-0a3d91?style=flat-square)](https://github.com/JacyFleisie/sidequest)

<br/>

[![Live demo](https://img.shields.io/badge/Try%20the%20live%20demo%20%E2%86%92-1f6feb?style=for-the-badge&logo=githubpages&logoColor=white)](https://jacyfleisie.github.io/sidequest)
[![Download APK](https://img.shields.io/badge/Download%20for%20Android-108c43?style=for-the-badge&logo=android&logoColor=white)](https://github.com/JacyFleisie/sidequest/releases/latest/download/SideQuest.apk)

**Play it in any browser** (live demo, no install) **or as a real Android app.**

</div>

---

## 📖 Table of Contents

- [The Problem](#-the-problem)
- [The Solution](#-the-solution)
- [How It Works](#-how-it-works)
- [Features](#-features)
- [Screenshots](#-screenshots)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Engineering Highlights](#-engineering-highlights)
- [Getting Started](#-getting-started)
- [Android App & Auto-Updates](#-android-app--auto-updates)
- [Documentation](#-documentation)
- [Testing & Quality](#-testing--quality)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [Security](#-security)
- [License](#-license)

---

## 🎯 The Problem

South Africa is one of the most beautiful, weird and wonderful countries on
Earth — yet most of us only ever "see" it through a screen.

- **Discovery is passive.** Google Maps lists places, but it never makes you
  *want* to go. A waterfall in KZN, a kota in Soweto, a sunset at Camps Bay —
  they stay photos on a feed instead of afternoons out.
- **Boredom is real.** Students on a lunch break, a free afternoon, or a
  holiday have nowhere obvious to point their energy — so they scroll.
- **Social apps are generic.** Global platforms don't know that a braai on
  Heritage Day or a winter jazz festival in Joburg are the actual highlights of
  a South African week.

SideQuest exists to fix that: **the country is already the playground — we
just needed a reason to go.**

## ✅ The Solution

**SideQuest turns all of South Africa into a game board.** 377 hand-written
quests across all 9 provinces — from a kota hunt in Soweto and a sunset at Zoo
Lake, to lion-watching in the Kruger and a waterfall in KZN. Every quest is a
real place, pinned on a real map, waiting for you to actually show up.

XP, levels, ranks, **46 badges**, friends, squads and streaks turn "going
somewhere" into a game you play with your crew. Seasonal quests tied to real SA
events (Braai Day, Comrades, Splashy Fen, the National Arts Festival…) keep the
map alive all year — with an "Ends Sunday" countdown so you don't miss them.
And real upcoming festivals, markets and motorsport events are quests too —
found **automatically, every night**, with dates, entry fees and exactly where
to buy tickets.

> **Every number you see is real.** No fake "X people loved this" counters —
> ratings come only from players who actually completed the quest, straight
> from the database.

## 🧭 How It Works

1. **Pick your base.** Set your home from a 19-city picker or hit *Use my
   location* — no sign-up required to play.
2. **Pick a quest.** Browse the map, search any place in the country, or scroll
   the Instagram-style feed filtered by category, budget, distance or date.
3. **Actually go.** Quests are **GPS-gated** — you can only complete one when
   your device is near the place. No completing quests from the couch.
4. **Get rewarded.** XP, levels, ranks (Rookie → Explorer → Trailblazer →
   Legend of SA), badges, streaks and stats — alone or with a squad (+20% XP).
5. **Stay for the events.** The app finds new ticketed events by itself every
   night, so there's always something happening this weekend.

---

## ✨ Features

### 🗺️ Explore the Map
The whole country as a dark game board with every quest pinned in its real
location. **Search** finds any place or quest — local results first, then live
OpenStreetMap for anything else — and flies you straight to it. The map
**survives tile-server outages** by falling back to a backup source instead of
crashing to a blank screen. Auto-discovered events stand out with **pulsing
red LIVE pins** and their own filter chip.

### 📍 Location-first gameplay
Quests are **GPS-gated**: you can only complete one when your device is within
5 km of every stop. Every quest shows a **live drive time** and one-tap
**directions in Google Maps or Waze**.

### 📜 The Quest Feed
Scroll like it's Instagram — real places plus quests the whole community made
up. Pull down to refresh (which also reshuffles and fetches the freshest
events), and filter with one tap:

- **Category** — Free, Chill, Food, Activity, Adventure, Event, Mystery
- **Vibe** — chill, funny, social, competitive, romantic, chaotic, outdoors…
- **Anywhere** — quests with no location, doable right now
- **Community** — quests created by players, platform-wide
- **Seasonal** — limited-time quests with live "Ends Sunday" countdowns
- **🟥 Live** — ticketed sport, concerts & comedy from the nightly feed, with
  a **📅 When** sub-filter: *This weekend* (Fri 5pm–Sun) or *This month*
- **🎪 Festival / 🛍️ Market / 🏎️ Automotive** — real calendar events
- **💰 Budget slider** — filter by price per person, with an adaptive range
  that matches the priciest quest on offer
- **📍 Feed location + radius** — browse quests near a *different* city, with
  nearest-first sorting and ≤25 km / ≤100 km radius filters
- **🔥 Trending** — the most-reviewed quests first

Only **upcoming events** are ever shown — dated events more than ~6 months out
are hidden everywhere, so the feed never reads like a year-ahead schedule.

### 🏆 Progress & Glory
XP, levels and ranks — **Rookie → Explorer → Trailblazer → Legend of SA**.
Daily streaks, a stats dashboard (km covered, quests per category, favourite
province, total hours) and **46 badges** — from Night Owl and Rain Warrior to
the 10km Club, Golden Hour and South Africa Explorer. Tap any badge for its
details and live progress toward the next one.

### ✍️ Creator Titles
Community quest authors earn vanity titles instead of money — *Quest Writer →
Quest Curator → Quest Master → Quest Legend* — shown as a gold chip next to
their name in the feed and tracked on the profile. Community quests are
moderated: blocklist-checked, reportable, and auto-hidden after enough reports.

### 👥 Friends, Squads & Co-op
Add your crew by username and watch real stats sync live. **Squads** bring a
co-op layer: create a squad, invite friends, see the roster update in real
time, and every member earns a **+20% XP bonus** on quests completed together.
The Activity feed surfaces friends' quest completions and badge milestones as
they happen.

### 🔧 Chain Builder
Assemble your own multi-stop quest from the whole catalog, reorder the stops,
and share it as a link that carries the entire quest inside the URL.

### ⭐ Ratings & Reviews (real, moderated)
After completing a quest you can **rate it 1–5 stars** and leave a tip — the
database only accepts reviews from players who actually finished the quest.
Reviews are blocklist-checked, anyone can report one, and a review auto-hides
after enough reports.

### ⏳ Seasonal Quests
Limited-time quests tied to real SA events — Braai Day, the Soweto Food
Festival, Rocking the Daisies, December holidays, Comrades, Splashy Fen, the
National Arts Festival — with a live countdown in the feed and automatic
removal once the event passes.

### 🎟️ Live Events — automatically discovered
SideQuest finds new events **by itself**. Every morning a GitHub Actions cron
runs `scripts/fetch-events.mjs`, which pulls real, dated, ticketed events from
free sources (the Howler homepage, plus an optional free Ticketmaster API key),
pins them to real map coordinates — only events we can place accurately are
kept — and publishes `public/events-remote.json`. The app pulls that feed at
launch and on every refresh, merges it into the map and feed with ticket links,
prices and countdowns, and caches it for 12 hours so it works offline.

- **Tickets built in** — every ticketed event lists exactly where to buy:
  Ticketmaster, Webtickets, Computicket, Ticketpro, Quicket, Howler, iTickets,
  Big Concerts and the festivals' own sites — with a **countdown** ("⏳ 2 days
  left to get tickets", red when ≤ 3 days) so you don't miss out.
- **Zero cost, zero keys required** — without any token the Howler feed alone
  keeps events fresh.
- **Never stale, never wrong** — if a run fails, the previous feed is kept;
  past and far-future events are dropped automatically.
- Run it yourself anytime: `npm run fetch:events`.

---

## 📸 Screenshots

<div align="center">
  <img src="assets/screenshots/home.png" alt="Home screen" width="24%"/>
  <img src="assets/screenshots/map.png" alt="Map screen" width="24%"/>
  <img src="assets/screenshots/feed.png" alt="Quest feed" width="24%"/>
  <img src="assets/screenshots/friends.png" alt="Friends & squad" width="24%"/>
</div>

---

## 🧰 Tech Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19 · TypeScript · Vite |
| Map | Leaflet + react-leaflet (OSM / CARTO tiles, auto-fallback) |
| Routing | react-router |
| Native shell | Capacitor 8 (`com.jacy.sidequest`) + FCM push notifications |
| Backend | Supabase (Postgres) — accounts, profiles, friends, squads, reviews, custom quests, push tokens |
| Auth | Supabase Auth — email + password, protected by Cloudflare Turnstile |
| Realtime | Supabase Realtime (postgres_changes) — friend requests, activity feed, squads |
| State | React context + `localStorage` (offline-first), synced to your account |
| Styling | Hand-rolled CSS design tokens, mobile-first with a bottom nav |
| CI/CD | GitHub Actions — Pages deploy, release pipeline, **nightly live-events fetch** |
| Notifications | Firebase Cloud Messaging — releases, friend requests, badges |

---

## 🏗️ Architecture

```
                    ┌──────────────────────────────┐
                    │         SideQuest app         │
                    │  React SPA (web + Capacitor)  │
                    └──────┬───────────────┬────────┘
                           │               │
              ┌────────────▼─────┐   ┌─────▼──────────────────┐
              │  Local game      │   │  Supabase (Postgres)    │
              │  · quests, XP    │   │  · profiles / friends   │
              │  · offline-first │   │  · squads / reviews     │
              │  · localStorage  │   │  · custom quests        │
              └────────────┬─────┘   └─────┬──────────────────┘
                           │               │
                           └── sync engine ┘
                         (idempotent, offline-safe)

  GitHub Pages  → live demo + shared quest links
  GitHub Releases → APK downloads + in-app auto-updates
  Firebase Cloud Messaging → push notifications (releases, friend requests)

  LIVE EVENTS (automatic):
  nightly GitHub Actions cron ──▶ scripts/fetch-events.mjs
       (Howler + optional Ticketmaster, free)
            └──▶ public/events-remote.json ──▶ app pulls at launch,
                 merged into the map + feed with tickets & countdowns
```

The app is **offline-first**: the full quest catalog ships in the bundle and
the game is fully playable with no connection. Sync is a progressive layer —
every sync call no-ops gracefully when offline, and the UI falls back to local
state. Nothing breaks when you drive through a dead zone.

### Project structure

```
src/
├── data/            # quests.ts · hangouts.ts · places.ts · events.ts · seasonal.ts · social.ts
├── lib/             # game logic, 46 badges, creator tiers, friends, squads, reviews,
│                    #   sync engine, events feed, store (offline-first state)
├── components/      # MapScreen, Generator (feed), Profile, QuestSheet, SquadPanel, …
└── App.tsx          # routes + share-link handling + boot sync
android/             # Capacitor native shell (custom updater plugin)
supabase/
├── migrations/      # versioned schema — applied automatically via GitHub integration
└── functions/       # edge functions: delete-account, notify-user, notify-update
scripts/             # build-apk, bump-version, release, quest data checker, events fetcher
docs/                # database design + push notification setup
```

---

## 🏆 Engineering Highlights

Things I'm proud of under the hood:

- **GPS-gated completion integrity** — a quest only completes when your device
  is physically at the location; there's no "complete from the couch" path.
- **Offline-first sync engine** — idempotent, offline-safe sync to Postgres;
  the game is fully playable with no connection and merges cleanly when you're
  back online.
- **A self-updating content pipeline** — the app's event catalog is *grown by
  CI*: a nightly cron scrapes free sources, geocodes and validates every event,
  and ships it to users as a static feed. Zero manual data entry, zero API
  keys required to run.
- **Data-quality tooling** — `npm run check:quests` validates all 377 quests
  (missing provinces, out-of-SA coordinates, duplicate titles within 1 km) so
  the map grows clean instead of messier.
- **Real anti-gaming systems** — completion-gated reviews, blocklisted content,
  report + auto-hide moderation, CAPTCHA-protected sign-up, row-level security
  on every table.
- **End-to-end release pipeline** — one command bumps the version everywhere,
  rebuilds the APK, tags a release, deploys the web build, and pushes an FCM
  notification to every phone.
- **Resilient map** — tile-server failover so the map never dies with its
  provider, and marker clustering tuned for low-mid Android devices.

---

## 🚀 Getting Started

### Requirements

- **Node.js 20+** and npm
- For Android builds: **Java 17+** and the Android SDK

### Run it locally

```bash
npm install
npm run dev          # → http://localhost:5173
```

No `.env` setup needed — `npm run dev` / `npm run build` auto-generate `.env`
from the committed `.env.defaults` (public values only: Supabase URL,
publishable key, Turnstile site key). New machines just clone and go.

### Useful commands

```bash
npm run typecheck    # full TypeScript check
npm run build        # production build → dist/
npm run check:quests # validates quest data quality (provinces, coords, duplicates)
npm run fetch:events # fetch the live events feed right now (used by the nightly cron)
npm run apk          # build the Android APK → SideQuest.apk
npm run release      # cut a release (see below)
```

---

## 📲 Android App & Auto-Updates

The web app is wrapped in a **Capacitor native shell**, so it runs as a real
Android app with full GPS access.

**Install:** download the APK (button at the top), enable *"Install unknown
apps"* for your file manager or browser, and open the file — or plug in your
phone with USB debugging and run `adb install SideQuest.apk`.

Once installed, the app **self-updates** via GitHub Releases — on launch it
checks for a newer version and offers to install it in one tap, with a push
notification announcing each new release.

**Cut a new release from your machine:**

```bash
npm run release patch   # or: minor / major
```

This bumps the version everywhere, rebuilds the APK, tags `vX.Y.Z`, attaches
the APK to a GitHub release, deploys the web build to Pages, and pushes an FCM
notification to every registered phone. Your phone picks it up automatically.

---

## 📚 Documentation

| Doc | What it covers |
| --- | --- |
| [`CHANGELOG.md`](CHANGELOG.md) | Every release, versioned and dated |
| [`docs/database.md`](docs/database.md) | The Postgres schema — every table, what it fixes, and how it maps to the app |
| [`docs/fcm-setup.md`](docs/fcm-setup.md) | One-time Firebase setup for push notifications |

---

## 🧪 Testing & Quality

- **TypeScript strict** — `tsc -b` runs in CI before every deploy
- **Quest data checker** — `npm run check:quests` flags missing provinces,
  coordinates outside SA, duplicate titles within 1 km, and unfillable quest
  cards across all 377 quests
- **Production build** — Vite build runs in the Pages workflow on every push
- **E2E-verified features** — the sync engine (friends, squads, reviews,
  account deletion) is tested against the live database with throwaway
  accounts before each release

---

## 🗺️ Roadmap

- [x] Friends & real-time activity feed
- [x] Ratings & reviews (completion-gated, moderated)
- [x] Squads — co-op XP bonus, live roster
- [x] Seasonal quests tied to real SA events
- [x] Auto-discovered live events (nightly pipeline)
- [x] Account deletion (POPIA-friendly)
- [ ] Google Play Store listing (kills sideload warnings + unlocks push reliability)
- [ ] Localization — badge & rank names in isiZulu / Afrikaans
- [ ] Offline caching of map tiles (data-friendly mode)
- [ ] Playwright end-to-end test suite
- [ ] Squad leaderboards

---

## 🤝 Contributing

Contributions are welcome — bug reports, quest suggestions, translations, and
code. Please read the [Contributing Guide](CONTRIBUTING.md) first, and note
that all interactions are governed by our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 🔒 Security

- Accounts & sync run on **Supabase** with row-level security — you can only
  ever read or write your own data (or data your friends shared with you).
- Sign-in is protected by **Cloudflare Turnstile** to block bots.
- Your **GPS stays on-device** — quest completion is checked locally; only
  your chosen home base and quest stats ever sync.
- **POPIA-friendly** — users can delete their account and all their data from
  the Profile tab, wired end-to-end to the database.
- Found a vulnerability? See [SECURITY.md](SECURITY.md) — and please don't
  open a public issue for it.

---

## 📄 License

[MIT](LICENSE) © 2026 Jacy Fleisie

---

<div align="center">

*Made with ❤️ in South Africa · by Jacy*

**SideQuest** — *Your life is the main story. South Africa is your map.*

</div>

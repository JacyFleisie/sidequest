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

[![Live demo](https://img.shields.io/badge/Live%20demo%20%E2%86%92-1f6feb?style=for-the-badge&logo=githubpages&logoColor=white)](https://jacyfleisie.github.io/sidequest)
[![Download APK](https://img.shields.io/badge/Download%20APK-108c43?style=for-the-badge&logo=android&logoColor=white)](https://github.com/JacyFleisie/sidequest/releases/latest/download/SideQuest.apk)

**Works in any browser** (live demo) **or as a real Android app** (APK).

</div>

---

## 📖 Table of Contents

- [The Problem](#-the-problem)
- [The Solution](#-the-solution)
- [Features](#-features)
- [Screenshots](#-screenshots)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
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
Earth — yet most people only ever "see" it through a screen.

- **Discovery is passive.** Google Maps lists places, but it never makes you
  *want* to go. A gorgeous waterfall in KZN stays a photo on a feed.
- **Boredom is real.** Students on a lunch break, a free afternoon, or a
  holiday have nowhere obvious to point their energy — so they scroll.
- **Social apps are generic.** Global platforms don't know that a kota in
  Soweto, a sunset at Camps Bay and a braai on Heritage Day are the actual
  highlights of a South African week.

SideQuest exists to fix that: **the country is already the playground — we just
need a reason to go.**

## ✅ The Solution

**SideQuest turns all of South Africa into a game board.** 377 hand-written
quests across all 9 provinces — from a kota hunt in Soweto and a sunset at Zoo
Lake, to lion-watching in the Kruger and a waterfall in KZN. Every quest is a
real place, pinned on a real map, waiting for you to actually show up.

XP, levels, ranks, badges, friends and squads turn "going somewhere" into a
game you play with your crew. Seasonal quests tied to real SA events (Braai
Day, Comrades, Splashy Fen, the National Arts Festival…) keep the map alive all
year — with an "Ends Sunday" countdown so you don't miss them. Real upcoming
festivals, markets and motorsport events are quests too, grouped under 🎪
Festival, 🛍️ Market and 🏎️ Automotive chips — with dates, entry fees and
exactly where to buy tickets.

> **Every number you see is real.** No fake "X people loved this" counters —
> ratings come from players who actually completed the quest, straight from the
> database.

---

## ✨ Features

### 🗺️ Explore the Map
The whole country as a dark game board with every quest pinned in its real
location. **Search** finds any place or quest — local results first, then live
OpenStreetMap for anything else — and flies you straight to it. The map
**survives tile-server outages** by falling back to a backup source instead of
crashing to a blank screen.

### 📍 Location-first gameplay
Set your base from a 19-city picker or hit **"Use my location"** — no API key
needed. Quests are **GPS-gated**: you can only complete one when your device is
within 5 km of every stop. No completing quests from the couch. Every quest
shows a **live drive time** and one-tap **directions in Google Maps or Waze**.

### 📜 The Quest Feed
Scroll like it's Instagram — real places plus quests the whole community made
up. Filter by category, vibe, "Anywhere", "Community", "Seasonal" or
"Trending", pull down to reshuffle (which also fetches the freshest events),
and jump straight into a quest. A dedicated **location picker** lets you
browse quests from a different city than your own.

**Real event chips** — 🎪 **Festival**, 🛍️ **Market** and 🏎️ **Automotive**
chips narrow the feed to real calendar events (Aardklop, Joy of Jazz, the
Pretoria Boeremark, Tarlton drag nights…). No chip selected = everything
still shows. Dated events carry their date, entry fee, a **countdown** ("⏳ 2
days left to get tickets", red when ≤ 3 days) and **direct links to every
ticket seller** — Ticketmaster, Webtickets, Computicket, Ticketpro, Quicket,
Howler, iTickets, Big Concerts and the festivals' own sites — so buying is
one tap away, in person or online.

### 🏆 Progress & Glory
XP, levels and ranks — **Rookie → Explorer → Trailblazer → Legend of SA**.
Daily streaks, a stats dashboard (km walked, quests per category, favourite
province, total hours) and **18 badges** including Night Owl, Rain Warrior and
the 10km Club. Tap any badge for its details and progress.

### 👥 Friends, Squads & Co-op
Add your crew by username and watch real stats sync live. **Squads** bring a
co-op layer: create a squad, invite friends, see the roster update in real
time, and every member earns a **+20% XP bonus** on quests completed together.
The Activity tab surfaces friends' quest completions and badge milestones as
they happen.

### 🔧 Chain Builder
Assemble your own multi-stop quest from the whole catalog, reorder stops, and
share it as a link that carries the entire quest inside the URL.

### ⭐ Ratings & Reviews (real, moderated)
After completing a quest you can **rate it 1–5 stars** and leave a tip — the
database only accepts reviews from players who actually finished the quest.
Comments are blocklist-checked, anyone can report a review, and a review
auto-hides after 5 reports.

### ⏳ Seasonal Quests
Limited-time quests tied to real SA events — Braai Day, the Soweto Food
Festival, Rocking the Daisies, December holidays, Comrades, Splashy Fen, the
National Arts Festival — with a live countdown ("Ends Sunday") in the feed,
automatic removal once the event passes, and an "Ends in N days" pill on the
quest sheet.

### 🎟️ Live Events — automatically discovered
SideQuest finds new events **by itself**. Every morning a GitHub Actions cron
(`.github/workflows/events-fetch.yml`) runs `scripts/fetch-events.mjs`, which
pulls real, dated, ticketed events from free sources, pins them to real map
coordinates (only events we can place accurately are kept), and publishes
`public/events-remote.json`. The app fetches that feed at launch and on feed
refresh, merges it into the feed with ticket links and countdowns, and caches
it for 12 hours so it works offline.

- **Sources:** the [Howler](https://www.howler.co.za/) homepage (no key —
  featured festivals, nightlife, music) plus, optionally, the **Eventbrite
  public API** — free and thousands of SA concerts, comedy and sport events.
  Add a free token to unlock it:
  - `EVENTBRITE_TOKEN` in `.env` (local) or as a GitHub Actions secret for the
    nightly run — get one free at [eventbrite.com/platform](https://www.eventbrite.com/platform).
- **Zero cost, zero keys required:** without any token the Howler feed alone
  keeps events fresh; the app needs no API key to read the feed.
- **Never stale, never wrong:** if a run fails, the previous feed is kept;
  past events are dropped automatically.
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
| Realtime | Supabase Realtime (postgres_changes) — friend requests, feed, squads |
| State | React context + `localStorage` (offline-first), synced to your account |
| Styling | Hand-rolled CSS design tokens, mobile-first with a bottom nav |
| CI/CD | GitHub Actions — Pages deploy, release notifications, **nightly live-events fetch** |

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
       (Howler + optional Eventbrite, free)
            └──▶ public/events-remote.json ──▶ app pulls at launch,
                 merged into the feed with tickets + countdowns
```

The app is **offline-first**: the full quest catalog ships in the bundle and
the game is fully playable with no connection. Sync is a progressive layer —
every sync call no-ops gracefully when offline, and the UI falls back to local
state. Nothing breaks when you drive through a dead zone.

### Project structure

```
src/
├── data/            # quests.ts (core + chains) · hangouts.ts · social.ts · seasonal.ts
├── lib/             # game logic, badges, friends, squads, reviews, sync engine, store
├── components/      # MapScreen, Generator (feed), Profile, QuestSheet, SquadPanel, …
└── App.tsx          # routes + share-link handling + boot sync
android/             # Capacitor native shell (custom updater plugin)
supabase/
├── migrations/      # versioned schema — applied automatically via GitHub integration
└── functions/       # edge functions: delete-account, notify-user, notify-update
scripts/             # build-apk, bump-version, release, quest data checker
docs/                # database design + push notification setup
```

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
  cards across all 335 quests
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

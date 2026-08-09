# SideQuest 🇿🇦

> **Your next adventure is closer than your next class.**
> <sub>SideQuest — by Jacy</sub>

A South African real-world adventure/social web app prototype, built for students who'd
rather be out exploring. The whole country is the playground: every quest you complete
maps a little more of South Africa. A 🏠 **Home tab** greets you with the slogan and
credit plus your live stats (quests, XP, streak, rank) and quick actions into every
part of the app.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts: `npm run build` (production build to `dist/`), `npm run typecheck`.

## What's inside

- **🗺️ Map** — South Africa as the game board. 249 quests pinned across all 9 provinces:
  big adventures (Kruger, Drakensberg, Table Mountain) plus the everyday-hangout layer —
  malls (Nelson Mandela Square, Gateway, Canal Walk), parks & botanical gardens, hiking
  trails (Lion's Head, Groenkloof, Kgaswane), food spots (Gatsby, kota hunts, fish & chips),
  things to do (go-karting, mini golf, paintball, ice skating, climbing, laser tag, escape
  rooms, parkrun) and small towns (Parys, Dullstroom, Jeffreys Bay, Margate, Rustenburg,
  Upington…). 🔍 **Search** finds any place or quest and flies the map to it — local
  gazetteer results first, then live OpenStreetMap results (free, no key) for
  anything else, with rate-limit retries so obscure towns and suburbs always resolve.
- **📍 Starting location** — the map shows a pulsing start marker at your chosen base,
  with a 19-city picker and a "Use my location" option that geolocates you (free, no API),
  snaps to the nearest base and marks exactly where you are.
- **🎲 Generator** — the "We're Bored" wizard: people, time, budget, distance, vibe →
  builds a multi-stop quest chain with real places, stats and XP, plus featured hand-crafted
  chains (The Garden Route, The Durban Golden Mile, Soweto Saturday…). The 🗣️ **Social**
  vibe rolls people-quests (chat with strangers, free hugs, busk, scream in a sports field),
  and the generator never repeats itself — every roll excludes the last 18 suggestions.
  249 quests across all 9 provinces.
- **🏆 Profile** — XP, levels, 🎖️ **ranks** (Rookie → Explorer → Trailblazer →
  Legend of SA, with a progress bar and a "NEW RANK" celebration on promotion),
  daily streaks, a 📊 **stats dashboard** (total quest hours, places visited,
  favourite province, quests-per-category bars), per-province
  completion bars (complete all 9 provinces = South Africa  Explorer), 27 badges (tap any for a detail sheet: earned date, progress bar,
  and how many more quests a locked badge needs), and quest memories. Badges include
  time-of-day feats (Night Owl after 8pm, Early Bird before 7am), Rain Warrior
  (weather checked free via Open-Meteo at finish), the 10km Club (finish a quest
  10+ km from home), and a per-category Master badge for 5 quests in each category.
- **👥 Friends** — add your crew (by name/avatar or by opening a shared friend card
  link, `?friend=…`), compare quests and streaks with rivalry labels, browse their
  recent quests, and **challenge them** — a quest link that arrives as
  "🎁 {name} challenged you with this quest!". Friend profiles are deterministic
  seeds that **grow over time** since you added them — and the 🔔 **Badge buzz** feed
  surfaces when one of them crosses a badge threshold ("Thabo just earned 💥
  Adrenaline Junkie"). No accounts or backend needed.
- **🔧 Chain Builder** — assemble your own multi-stop quest from the whole catalog:
  search/filter stops, reorder them, see live stats, and save it to "My quests". Share
  any chain (yours or a featured one) as a link that carries the quest inside the URL
  (`?chain=…`) — a friend who opens it gets a "A friend shared this quest with you!"
  sheet and can start it instantly. No backend needed.
- **🎮 Quest flow** — start a quest, tick off the steps, finish for a confetti
  celebration with a witty completion line and a level-up check. Finishing is
  **location-gated**: you must be within 5 km of every stop (verified with device GPS,
  falling back to your typed start location if GPS is unavailable — the sheet shows
  exactly which it used and how far each stop is). Everything persists in
  `localStorage`, so refresh away.

## Free by design — no paid APIs

- **Maps:** Leaflet + OpenStreetMap tiles served by CARTO's free dark basemap
  (`basemaps.cartocdn.com`). No API key, no billing account. Attribution is included.
  > For production at scale, consider self-hosting tiles or a free-tier map provider —
  > OSM's public tile servers are for light use.
- **Map resilience:** CARTO's free tiles are flaky (rate limits, dropouts), so the map
  auto-falls back through CARTO light → OpenStreetMap tiles when they fail, and shows a
  "tap to retry" pill if every provider is unreachable — it can no longer crash to a
  blank screen. The map also re-measures itself on resize/orientation changes.
- **No backend, no accounts, no subscriptions.** All data is a static dataset
  (`src/data/quests.ts`), all state lives in the browser.
- **No AI APIs.** The "AI-generated" quest chains are a rule-based generator
  (`src/lib/game.ts`) — matching, scoring, and relaxation logic, entirely free.
- **Geolocation** — free browser geolocation (no API) verifies you're physically near a
  quest before it can be completed; if GPS is unavailable it falls back to your typed
  start location, and the app says which one it used.

## Tech

React 19 + TypeScript + Vite, react-leaflet (Leaflet) for the map, react-router for the
six tabs, plain hand-rolled CSS (no UI framework). Mobile-first layout with a bottom nav
— deliberately shaped like a phone app so it can be wrapped as a PWA or ported to
React Native / Capacitor for the mobile version later.

## Android app (Capacitor)

The web app is wrapped in a Capacitor native shell (`android/` folder) so it runs as a
real Android app with GPS access. To build the installable APK:

```bash
npm run apk   # builds web → syncs to android/ → gradle assembleDebug → SideQuest-debug.apk
```

Requirements on this machine: Android SDK (already installed) + the JDK bundled with
Android Studio (the script points at it automatically). The APK (`com.jacy.sidequest`)
includes the INTERNET and location permissions; install it by enabling "Install unknown
apps" and opening the file from your phone, or `adb install` it over USB.

## Auto-updates & releasing

The Android app **self-updates for free via GitHub Releases** (public repo, no paid
services): on launch it checks the latest release, and if it's newer than the installed
version it offers to download and install it (Android asks you to approve the install
once per app).

To ship a new version to your phone:

```bash
npm run release patch   # or minor / major
```

That bumps the version everywhere (package.json, `src/lib/updater.ts`, Android
`versionName`/`versionCode`), rebuilds the APK, commits, tags `vX.Y.Z`, pushes to
GitHub, and attaches the APK to a release. The next time you open the app on your
phone it shows the update banner. Repo: github.com/JacyFleisie/sidequest.

## Project structure

```
src/
  data/quests.ts      # provinces, core quests, hand-crafted chains, home bases
  data/hangouts.ts    # everyday hangout quests: malls, parks, trails, food, things-to-do, small towns
  data/social.ts      # social/people quests: talk to strangers, free hugs, busking, challenges
  components/ChainBuilder.tsx  # build & share custom multi-stop quests
  components/Friends.tsx       # friends list, seeded profiles, challenges
  lib/friends.ts      # friend cards (`?friend=`), seeded profiles, rivalry logic
  lib/share.ts        # share-link encode/decode (quest travels in the URL)
  lib/game.ts         # XP/levels, badges, generator engine
  lib/store.tsx       # game state + localStorage persistence
  components/         # MapScreen, Generator, Profile, QuestSheet, ActiveQuest, …
```

## Ideas for next steps

- Add real geolocation + an SA-only check (block signup outside the country).
- Import live events from free sources (Hopp/Fever/Quickets are paid APIs — start with
  user submissions and partner feeds instead).
- Photo uploads for quest memories (store as object URLs / IndexedDB).
- PWA manifest + offline tiles for the mobile feel.

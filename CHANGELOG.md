# Changelog

All notable changes to SideQuest are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **Ticket price vs FREE mismatch** — ticketed events (e.g. auto-discovered
  gigs) showed "from R2 150" in the event line but "💰 FREE" in the stats;
  the 💰 stat now shows the real ticket price everywhere (feed cards and the
  quest sheet) via a shared `questCostLabel` helper

### Added
- **🟥 Live + date filter** — the Live chip now combines with a "📅 When"
  sub-filter: **This weekend** (Fri 5pm–Sun) or **This month**, so users can
  find ticketed events happening soon; the active label reads "🟥 Live ·
  this weekend" etc.
- **💰 Budget slider in the feed** — a price filter (per person) with an
  adaptive range: the slider's top end matches the priciest quest currently
  in the feed (up to R1,000+ for live events), and dragging it live-filters
  to "Up to R X" with the count updating instantly
- **📅 Only upcoming events shown** — dated events more than ~6 months out
  (KKNK, Comrades, Bastille, CT Jazz etc.) are hidden everywhere: the feed,
  the map, search, and chain building. A shared `isUpcomingEvent` rule keeps
  all views consistent, so no more "Ends in 200+ days" quests
- **📍 Feed location now actually filters** — picking a feed location sorts the
  feed nearest-first (real quests first, anywhere quests after) and adds a
  radius control (Any distance / ≤25 km / ≤100 km) so the selection visibly
  changes what you see; picking a new spot or resetting clears the radius
- **🟥 Live chip in the feed** — filters to just the ticketed sport, concerts
  and comedy from the nightly auto-discovered feed, with a pulsing LIVE tag
  and date + ticket price on each card
- **🟥 Live events on the map** — auto-discovered events (the nightly feed)
  now appear as pulsing red "LIVE" pins with a tag, a 🟥 Live filter chip,
  and a "N live" count in the map hint — new events are easy to spot
- **✍️ Creator titles** — community quest authors earn vanity titles based
  on published quests: Quest Writer (1), Quest Curator (3), Quest Master (10),
  Quest Legend (25). Shown as a chip next to the author's name on feed cards
  and as a progress-tracked Creator section on the profile
- **19 new badges** — XP milestones (Halfway There, Seasoned, Veteran),
  quest-volume (Completionist 25, Half-Century 50), streak tiers (Unstoppable
  14, Iron Will 30), anywhere-quest counts (Social Butterfly 5, People Person
  15), time feats (Weekend Warrior, Golden Hour), distance (Long Haul 50km,
  25km On Foot, Century of Strides), exploration breadth (Tri-Province,
  Six Provinces, Day Tripper), weather (Sun Seeker) and Category Guru
  (15 in one category) — all with live progress bars on the badge sheet
- **🎟️ Live events — automatically discovered.** A nightly GitHub Actions cron
  runs `scripts/fetch-events.mjs` (Howler, plus optional free Ticketmaster
  Discovery API, which supports `countryCode=ZA`), pins real dated
  events to the map, and publishes `public/events-remote.json`; the app pulls
  it at launch and on feed refresh and merges it in — new festivals, markets,
  concerts and sport events appear with zero manual work
  (`npm run fetch:events` to run it manually)
- **Event quests** — 40+ real, researched events across all 9 provinces:
  Aardklop, KKNK, Joy of Jazz, Afrikaans is Groot, Innibos, Vryfees, Woordfees,
  Bastille & Montreux Franschhoek, Hermanus Whales, Knysna Oysters, Hantam
  Vleisfees, Clarens Craft Beer, Durban July, Soweto Derby, both Springboks vs
  All Blacks tests, Nedbank Golf Challenge, Cape Town Cycle Tour, Tarlton drag
  nights, Killarney, Zwartkops, concerts (Dave, Jill Scott, Kehlani, Brian
  McKnight, Kenny Lattimore, Campus Fest) and comedy (Festival of Comedy with
  Trevor Noah, Skhumba)
- **🎪 Festival / 🛍️ Market / 🏎️ Automotive chips** in the feed — tap one to
  see only that kind of event; no chip selected shows everything
- **Per-seller ticket links** — every ticketed event lists exactly where to
  buy (Ticketmaster, Webtickets, Computicket, Ticketpro, Quicket, Howler,
  iTickets, Big Concerts, festival sites) with a direct link per seller and a
  Get-tickets button
- **Ticket countdown** on the quest sheet — "⏳ 2 days left to get tickets"
  (red when ≤ 3 days, "Today — last chance!", muted when passed); seasonal
  quests show "Ends in N days"
- 10 recurring markets (Pretoria Boeremark, Neighbourgoods, Oranjezicht City
  Farm, Root 44, Hazel Food, Willowbridge, Hout Bay Harbour, Bryanston
  Organic, Market on the Plein) as always-on quests

## [1.0.17] - 2026

### Added
- Squads — create a squad, invite friends, live real-time roster, leave or
  disband, and a **+20% XP bonus** on quests completed while in a squad
- Seasonal quests tied to real SA events (Braai Day, Soweto Food Festival,
  Rocking the Daisies, Comrades, Splashy Fen, National Arts Festival…) with an
  "Ends Sunday" countdown in the feed and auto-removal once the event passes
- Real quest ratings & reviews — completion-gated, blocklist-checked,
  reportable, with auto-hide; replaces all fabricated social-proof numbers
- Directions + live drive time in every quest sheet (Google Maps / Waze)
- 60+ new quests across all 9 provinces (325+ hand-written total)
- Quest data-quality checker (`npm run check:quests`)
- Full account-deletion flow (POPIA-friendly), edge-function powered
- "What's new" release-notes sheet in Profile, larger update banner
- Beta tag + beta disclaimer on Profile
- Professional repo docs: README rewrite with screenshots, LICENSE,
  CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG, issue templates

### Changed
- **Golden Hour redesign** — warm sand & cream light theme, editorial serif
  display type, sunset-amber accents, personal "Molo" greeting on Home, SVG
  icon system, and warm-tinted elevation; the map stays a dark night map for
  contrast
- Release notes are now hand-written per release (`RELEASE_NOTES.md`) and
  shipped straight to the in-app "What's new" sheet

### Fixed
- Push-notification token registration race — FCM tokens now register
  reliably so update, friend-request and badge alerts reach the phone

## [1.0.16] - 2026

## [1.0.16] - 2026

### Removed
- Race/challenge backend (challenges table, functions, push triggers) — the
  race feature was removed from the app; the database now matches

## [1.0.15] - 2026

### Added
- Pull-to-refresh across the whole app, on every tab
- Feed location picker — browse quests from a different city than your home base
- Live username-availability check on the sign-up form (debounced)

### Changed
- Bigger, unmissable update banner

### Removed
- Race feature (couldn't reliably be ended)

## [1.0.14] - 2026

### Added
- Community quest moderation: blocklist check (client + DB trigger), report
  button on custom quests, auto-hide at 10 reports
- Custom quests visible platform-wide in the feed with a "Community" filter
- New slogan & tagline ("Adventure is closer than you think.")

## [1.0.13] - 2026

### Added
- Push notifications via Firebase Cloud Messaging (releases, friend requests,
  challenges) — full native notifications even when the app is closed
- Feed redesign: Instagram-style quest feed with filters instead of the wizard
- "Anywhere" quests with no location; user-created quests shared to the feed
- Ability to create an account from the Profile tab; guests play without one

## [1.0.12] - 2026

### Added
- Quest feed with category/vibe filters, reshuffle, and pull-to-refresh
- Social quests doable anywhere (no location gate)
- School-focused social quests

## [1.0.11] - 2026

### Fixed
- Turnstile captcha site key now ships from `.env` — new installs need no
  manual key entry

## [1.0.10] - 2026

### Fixed
- Sign-out → create-account session restore under captcha enforcement

## [1.0.9] - 2026

### Changed
- Cloudflare Turnstile captcha wired into the sign-in sheet; submit stays
  disabled until the invisible token resolves
- Google sign-in removed — email + password is the account path

## [1.0.8] - 2026

### Fixed
- "Auth session missing" on email sign-up after a cleared session

## [1.0.7] - 2026

### Added
- Password reset — forgot-password link + recovery-session sheet
- Professional Google sign-in via Supabase OAuth (later removed)
- Clearer error messaging for Supabase email rate limits

## [1.0.6] - 2026

### Added
- First-launch onboarding — pick a display name and home base before the map

### Changed
- Removed "free forever" positioning to leave room for future monetization
- Stale auth sessions self-heal at launch and after database wipes

## [1.0.5] - 2026

### Added
- Real account system (email + password) — identity and stats survive reinstalls
- Live quest feed — friends' completions in the Activity tab
- Challenges feature built end-to-end (send, accept, race progress, winner)

### Removed
- Share-my-card and copy-code buttons (username search replaced them)

## [1.0.4] - 2026

### Added
- Find friends by username, synced friend requests with real stats
- Polished friend profile sheets and squad cards
- APK renamed to `SideQuest.apk` (no more "debug")

## [1.0.2] - 2026

### Added
- Supabase sync layer — real friend requests, real profiles and real stats
  (the database schema landed in `supabase/migrations/`)
- Android notification in the phone's tray when the app updates

## [1.0.1] - 2026

### Added
- 45 quick quests (10–20 min) across the main cities
- 14 quests across Krugersdorp & the West Rand
- Strict generator: honors exact budget, time, distance and group size

## [1.0.0] - 2026

### Added
- Initial release — SideQuest, the South African real-world adventure app:
  interactive map with 200+ quests across all 9 provinces, quest generator,
  XP / levels / ranks / badges, chain builder, friends & rivalry, stats
  dashboard, Android app with auto-updates, GitHub Pages live demo

[Unreleased]: https://github.com/JacyFleisie/sidequest/compare/v1.0.17...HEAD
[1.0.17]: https://github.com/JacyFleisie/sidequest/compare/v1.0.16...v1.0.17
[1.0.16]: https://github.com/JacyFleisie/sidequest/compare/v1.0.15...v1.0.16
[1.0.15]: https://github.com/JacyFleisie/sidequest/compare/v1.0.14...v1.0.15
[1.0.14]: https://github.com/JacyFleisie/sidequest/compare/v1.0.13...v1.0.14
[1.0.13]: https://github.com/JacyFleisie/sidequest/compare/v1.0.12...v1.0.13
[1.0.12]: https://github.com/JacyFleisie/sidequest/compare/v1.0.11...v1.0.12
[1.0.11]: https://github.com/JacyFleisie/sidequest/compare/v1.0.10...v1.0.11
[1.0.10]: https://github.com/JacyFleisie/sidequest/compare/v1.0.9...v1.0.10
[1.0.9]: https://github.com/JacyFleisie/sidequest/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/JacyFleisie/sidequest/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/JacyFleisie/sidequest/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/JacyFleisie/sidequest/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/JacyFleisie/sidequest/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/JacyFleisie/sidequest/compare/v1.0.2...v1.0.4
[1.0.2]: https://github.com/JacyFleisie/sidequest/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/JacyFleisie/sidequest/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/JacyFleisie/sidequest/releases/tag/v1.0.0

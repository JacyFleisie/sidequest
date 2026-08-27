# SideQuest v1.0.25 — Safer updates & a backend that stays awake 🛡️

The behind-the-scenes fixes from the health check are in — nothing changes how
the app plays, but it's now more robust and the most annoying outage is gone.

## 🛡️ What's new

- **Verified updates.** The app now checks the downloaded update's SHA-256
  against a pinned value before installing it, so a tampered or corrupted
  release can never be silently installed.
- **The backend stops going to sleep.** A daily keep-alive now pings the
  Supabase project so the free tier no longer auto-pauses after a week of
  quiet — that "fetch failed / can't load my stats" outage should be a thing
  of the past.
- **No more white screens.** A render error anywhere in the app now shows a
  friendly "hit a snag — try again" card instead of a blank crash.
- **More tests.** Anonymous sign-in, the stale-session self-heal, completion
  sync and the updater are now covered by automated tests (76 passing).

## 📍 Feeds & places

- Same SA map, same quests. Event feed and markets remain current from v1.0.24.

Same great quests, same South Africa — just tougher to break.

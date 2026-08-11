# SideQuest database — design notes

This is the plan for making SideQuest's friends/co-op system *actually synced*.
Today the app has **no backend**: friend stats are generated locally from a
deterministic seed, and "add friend" writes a name into your own phone. That's
why stats never match and why adding someone never reaches them.The schema is the fix — a portable Postgres database that works on **Supabase
(free), Neon, Railway, Render, or a $5 VPS** later. The canonical, versioned copy
lives in [`supabase/migrations/`](../supabase/migrations/) and deploys
automatically to Supabase via the GitHub integration (or manually with the
Supabase CLI).

## How each table maps to the app

| App concept | Table | What it fixes |
|---|---|---|
| Your stats (XP, level, streak, home base) | `profiles` | The phone writes its **real** numbers here; friends read them from here instead of inventing them |
| "＋ Add a friend" | `friend_requests` → `friendships` | Adding now creates a **pending request** the recipient sees and accepts. No more silent one-sided adds |
| Completed quests (`state.completed`) | `quest_completions` | The Activity feed and rivalry comparisons use real completion data |
| Finished chains (`chain-*` entries) | `chain_completions` | Multi-stop quests (official + user-built) count properly |
| Badges ("friend got a badge" feed) | `badge_earnings` | Friends subscribe to new rows and see real badge events |

## The request flow (before → after)

**Before:** A opens your `?friend=` link → your name is written into A's phone.
You never know. Stats on A's screen are fabricated.

**After:**
1. A taps "＋ Add" → `INSERT INTO friend_requests (sender=A, recipient=you, status='pending')`
2. Your app (real-time subscription or check-on-launch) sees the row →
   you get a **"🐆 A wants to be your friend"** request with Accept / Decline
3. Accept → `INSERT INTO friendships (user_a, user_b)` + the request flips to `accepted`
4. Now both sides read each other's **real** stats from `profiles`

Declining closes the request; a later new request from the same person replaces
it (the partial unique index keeps at most one live request per pair).

## Design decisions

- **UUIDs everywhere** — the app generates them (`crypto.randomUUID()`), so
  offline-first writes don't collide and sync in cleanly.
- **`timestamptz`** — store UTC, render local. Streak maths (`last_quest_at`)
  and "2h ago" labels depend on this being unambiguous.
- **TEXT + CHECK, not enums** — adding a future status (e.g. `'archived'`) is
  one `ALTER TABLE` line, not an enum migration.
- **`friendships` stores the pair once** with `user_a_id < user_b_id` — no
  duplicate rows whichever side initiated, and one PK to look up both directions.
- **`quest_completions` = one row per quest per player** — matches the app's
  `completed` map (first completion wins). Redoing a quest updates the row.
- **Badges are computed client-side, results stored** — the app's badge rules
  (`BADGES` in `game.ts`) stay the source of truth; the DB just records what was
  earned and when, which is all the feed needs.

## Realtime

Supabase realtime channels map directly: subscribe to
`friend_requests (recipient_id = me, status = 'pending')` for incoming requests,
`badge_earnings (profile_id = my_friends)` for badge events, and
`quest_completions` for the live feed. Same model works with Postgres
LISTEN/NOTIFY if you self-host later.

## Migration path (cheap upgrade)

1. **Start:** Supabase free tier — Postgres + realtime + auth in one, no card.
2. **Grow:** still Postgres → Neon (pay-per-use, sleeps when idle) or a $5 VPS.
   Same schema, same queries — only the connection string changes.
3. **Avoid:** Firestore's per-read billing is brutal for realtime listeners;
   this schema deliberately stays portable Postgres so you're never locked in.

## Open questions (decide before building)

- **Auth:** Supabase Auth (email/magic link/anonymous) vs. a simpler device-ID
  profile. Anonymous + "claim your profile later" is friendliest for a small app.
- **Conflict rule:** two devices completing the same quest — last-write-wins on
  `completed_at`, or first-write-wins? Schema defaults to the app's current
  first-wins behaviour.
- **Offline queue:** completions made offline should queue locally and flush on
  reconnect (the app is already offline-first; this extends it to the DB).

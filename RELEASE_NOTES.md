# SideQuest v1.0.28 — Cleaner updates, maps, and counts 🧹

A focused release on the three things the recent reviewer said made the app feel broken on first launch. No new features — just fixes.

## 🐛 What's fixed
- **Update prompts no longer stack.** The changelog modal and "Update available" toast no longer appear on top of each other across screens. Each prompt now shows **once** per version per session.
- **Map tiles stay clean.** The basemap no longer falls back to a broken-provider watermark — the free Carto → OpenStreetMap chain is now the tested default, with a real retry button if tiles are unreachable.
- **Quest counts agree.** The 280/393/430 drift is gone: every screen now reads from one canonical quest-count source. Gauteng completion shows a single consistent total.
- **Star ratings now say what they mean.** Renamed to "Quality score" with visit counts, so a rating reflects actual proof-backed visits, not vague opinions.

## 🐠 Carried over from v1.0.27
- 9 scuba diving locations (6 coastal, 3 inland) with 2026 rates and booking links.
- Verified APK updates (SHA-256 pinned), daily keep-alive, ErrorBoundary, 110 passing tests.

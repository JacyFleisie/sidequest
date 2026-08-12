# Contributing to SideQuest

Thanks for wanting to make SideQuest better! 🇿🇦 Whether you're fixing a bug,
adding a quest, translating, or shipping a feature — this guide keeps things
smooth for everyone.

By participating in this project, you agree to follow our
[Code of Conduct](CODE_OF_CONDUCT.md).

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [Getting started](#getting-started)
- [Branches & flow](#branches--flow)
- [Code style](#code-style)
- [Quest data guidelines](#quest-data-guidelines)
- [Testing](#testing)
- [Opening a PR](#opening-a-pr)
- [Reporting bugs](#reporting-bugs)

## Ways to contribute

- **Report a bug** — open an issue with the [bug report form](.github/ISSUE_TEMPLATE/bug_report.yml)
- **Suggest a feature** — open an issue with the [feature request form](.github/ISSUE_TEMPLATE/feature_request.yml)
- **Add a quest** — the quest catalog lives in `src/data/`. New real places
  with accurate coordinates are always welcome
- **Translate** — badge names, ranks and key UI into isiZulu / Afrikaans is on
  the roadmap and would mean a lot
- **Write code** — check the [Roadmap](README.md#-roadmap) for open items and
  look for issues labelled `good first issue`

## Getting started

```bash
npm install
npm run dev          # dev server → http://localhost:5173
npm run typecheck    # TypeScript check (run before any PR)
npm run build        # production build
```

No `.env` setup is needed — public defaults are committed in `.env.defaults`
and copied automatically.

## Branches & flow

- Branch from `main`: `git checkout -b fix/my-thing`
- Keep changes focused — one PR, one concern
- Commit messages should be clear and in the imperative mood:
  `Fix streak counter after midnight`, not `stuff changed`

## Code style

- **TypeScript strict** — the build fails on unused variables and implicit
  `any`. Let the typechecker guide you.
- Match the existing conventions you find in the file you're editing (naming,
  component structure, CSS tokens).
- Prefer the design-system CSS variables in `src/styles.css` over hardcoded
  colors.
- **No fake data.** This project deliberately removed fabricated social-proof
  numbers. Real features backed by the database — always.

## Quest data guidelines

New quests live in `src/data/` and must pass the checker:

```bash
npm run check:quests
```

- Use a **real place** with accurate (approximate) coordinates inside SA
- Fill in every field — province, city, region, duration, cost, players, XP
- Keep IDs unique and descriptive (`kruger-sunrise-drive`, not `quest-42`)
- **Do not invent reviews, completion counts or ratings** — those come from
  the database

## Testing

- Run `npm run typecheck` and `npm run check:quests` before pushing
- Run `npm run build` to confirm the production bundle compiles
- For sync-engine changes (friends, squads, reviews), the app's features are
  verified against the live database — note in your PR what you tested

## Opening a PR

Use the [pull request template](.github/PULL_REQUEST_TEMPLATE.md). A good PR:

1. Explains **what** changed and **why**
2. Lists what you verified (typecheck, build, manual test steps)
3. Screenshots for UI changes (drop them in the PR body)

The maintainer will review, and the Pages workflow runs typecheck + build
automatically on your branch.

## Reporting bugs

Use the [bug report form](.github/ISSUE_TEMPLATE/bug_report.yml) — a good bug
report includes the app version, device/OS, the steps to reproduce, and what
you expected vs. what happened.

**Security issues:** do **not** open a public issue — report privately per
[SECURITY.md](SECURITY.md).

# Security Policy

SideQuest takes security seriously. This project is built for real users — a
mobile app with accounts, friends, location-gated quests and cloud sync — so
data safety matters.

## Supported versions

Security fixes are released on the **latest release** only. Please update to
the newest version (the app auto-updates via the in-app banner).

| Version | Supported |
| --- | --- |
| Latest release | ✅ |
| Older releases | ❌ |

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead, email
[security@sidequest.app](mailto:security@sidequest.app) with:

- A description of the vulnerability
- The affected version(s)
- Steps to reproduce (or a proof of concept)
- Any impact you've assessed

You'll get an acknowledgement within **48 hours** and a status update as the
issue is triaged. We'll keep you informed as a fix lands.

## What to report

Examples of things worth reporting:

- **Account or data issues** — accessing another user's data, broken
  authorization (RLS bypasses), session/Auth problems
- **Injection or abuse** — SQL injection through the API, comment/review
  bypasses, spam abuse of sign-up or reporting
- **The app or its infrastructure** — anything that could compromise user
  devices or the sync backend

## Responsible disclosure

Please give us a reasonable window (at least 30 days) to fix and ship a
vulnerability before disclosing it publicly. We'll credit you in the release
notes if you'd like.

# Quizmoo implementation plans

One file per phase while it is being built. Each phase is one `feature/*` branch off `develop`, implemented with the `implement-phase` skill (`/implement-phase <N>`), verified with `pnpm verify` plus the phase's own command, and handed over with a delivery report (see the `git-workflow` skill). The user runs all git commands.

Finished plans are deleted once their branch is merged: `CHANGELOG.md` records what each phase shipped, and git history keeps the plan itself. Ideas not yet planned are in the [backlog](backlog.md).

| Phase | Plan | Branch | Status |
|---|---|---|---|
| 1 | Scaffold: workspace, shared schemas, server and web skeletons | `feature/scaffold` | done |
| 2 | Game engine | `feature/game-engine` | done |
| 3 | Database, auth, deployment | `feature/db-auth-deploy` | done |
| 4 | Realtime play: sockets, player screens, minimal host control | `feature/realtime-play` | done |
| 5 | Host control, projector screen, team mode, grading | `feature/host-and-screen` | done |
| 6 | Quiz editor, images, user management | `feature/editor` | done |
| 6b | Host flow options, sidebar, plain answer buttons | `feature/host-flow` | done |
| 7 | Results, history, export, retention | `feature/results` | done |
| 8 | Hardening: load test, end-to-end, release | `feature/hardening` | done |
| 9 | Design system, themes, light and dark mode | `feature/design-system` | done |
| 10 | Game screens, animations, answer styles and themes | `feature/game-screens` | done |
| 11 | Quiz editor overhaul | `feature/editor-v2` | done |
| 12 | Connection resilience, status toasts and host messages | `feature/resilience` | done |
| 13 | Play features: streak bonus, ordering question, avatars, nickname help, play again | `feature/play-features` | done |
| 14 | Host control: pause, timed messages, show a question again | `feature/host-control` | done |
| 15 | Phone and results screens: game menu, question image, review cards, results summary, new game dialog | `feature/screens-v2` | done |
| 16 | Join and login home screen | `feature/home-screen` | done |
| 17 | Host lobby around the QR code | `feature/host-lobby` | done |
| 18 | Change answers until a deadline | `feature/change-answers` | done |
| 19 | Team answers: captains, majority vote, shared answer | `feature/team-answers` | done |
| 20 | Teams choose, captain decides | `feature/team-captain` | done |
| 21 | Small improvements: selection, team of one, review label, names markup, PWA, new game dialog, custom theme and answer colours, editor settings panel, scheduled games | `feature/small-improvements` | done |
| 22 | My settings, per host account | `feature/host-settings` | done |
| 23 | Flexible teams and mixed play, set up per game | `feature/flexible-teams` | done |
| 24 | Player and host polish from testing | `feature/player-host-polish` | done |
| 25 | Game history at scale | `feature/game-history` | done |
| 26 | [Friends and family beta on a hosting provider](phase-26-beta-deploy.md) | `chore/beta-deploy` | in progress |
| 27 | Quiz files: spreadsheet and Quizmoo file import and export | `feature/quiz-files` | done |
| 28 | [Admin pages: users and names](phase-28-admin-pages.md) | `feature/admin-pages` | done |
| 29 | [My settings in tabs, and the host's own account](phase-29-settings-tabs.md) | `feature/admin-pages` | done |
| 30 | [Legal pages, data rights and a security pass](phase-30-legal-and-security.md) | `feature/legal-and-security` | done |
| 31 | [The host's running-game screen: standings midgame, names in full, controls in view](phase-31-host-game-screen.md) | `feature/host-game-screen` | done |
| 32 | Random cow animations on various screens | `feature/cow-antics` | planned |
| 33 | Patch notes in the app | `feature/patch-notes` | planned |
| 34 | Help page and interactive tutorial | `feature/help-and-tutorial` | planned |
| later | [Hosting without an account](later-guest-hosting.md) | `feature/guest-hosting` | planned, after the MVP |

## Conventions every plan follows

- **Scope** is the contract. Anything not listed is out, even if adjacent.
- **Steps** are ordered; each has a check the implementer runs before moving on.
- **Done when** is the acceptance list, checked item by item.
- **Verification command** is what the user runs after pulling the branch. It always includes `pnpm verify`.
- **Manual test list** is a draft; the implementer refines it in the delivery report.
- **Results** and **Deviations** headings are appended by the implementer: what was checked, and where reality differed from the plan.

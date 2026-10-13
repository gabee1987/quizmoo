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
| 18 | [Change answers until a deadline](phase-18-change-answers.md) | `feature/change-answers` | done |
| 19 | [Team answers: captains, majority vote, shared answer](phase-19-team-answers.md) | `feature/team-answers` | done |
| 20 | [Teams choose, captain decides](phase-20-team-captain.md) | `feature/team-captain` | planned |

## Conventions every plan follows

- **Scope** is the contract. Anything not listed is out, even if adjacent.
- **Steps** are ordered; each has a check the implementer runs before moving on.
- **Done when** is the acceptance list, checked item by item.
- **Verification command** is what the user runs after pulling the branch. It always includes `pnpm verify`.
- **Manual test list** is a draft; the implementer refines it in the delivery report.
- **Results** and **Deviations** headings are appended by the implementer: what was checked, and where reality differed from the plan.

---
name: git-workflow
description: Quizmoo branching model, commit message format and the end-of-phase delivery report. Use whenever work is finished or the user asks which branch, commit message or manual tests apply. The user runs every git command themselves; the agent only proposes.
---

# Git workflow

## Who does what

The user runs all git commands: branching, staging, committing, pushing, merging, tagging. The agent never runs `git` (not even `git status` is needed; use the file system). Exceptions, only when the user explicitly asks in that message: opening the pull request (`gh pr create --base develop`, description in the user's voice), and creating the next branch (`git status` must be clean first, then `git checkout develop; git pull; git checkout -b <branch>`). Never commit, push or merge. The agent's job is to leave the working tree in a verified state and hand over a delivery report.

## Branches

| Branch | Purpose |
|---|---|
| `main` | Production only. Receives merges from `develop` at release time. Never worked on directly. |
| `develop` | Integration branch. All feature, fix and chore branches start from and merge back into `develop`. |
| `feature/<slug>` | New functionality. One phase or one feature per branch. |
| `fix/<slug>` | Bug fixes and issues. |
| `chore/<slug>` | Non-feature, non-fix work: dependency bumps, tooling, cleanup, docs, CI. |

Slugs are kebab-case and short: `feature/game-engine`, `fix/reconnect-loses-score`, `chore/eslint-setup`.

Each plan in `docs/plans` names its branch. If a phase spans several commits, propose one commit message per logical unit, in order.

## Commit messages

One line, imperative mood, sentence case, under 72 characters. No type prefix, no scope, no trailing period:

```
Add pure game state machine with scoring
Keep player score on reconnect with stale token
Run typecheck, test and build on pull requests
Mark phase 2 done
```

The verb says what kind of change it is: Add, Fix, Update, Remove, Rename, Refactor. No "Co-Authored-By" lines.

## Pull requests

The description reads as written by the user: a short summary, then what changed as a few grouped bullets, then how it was tested. Detailed is fine, long is not. No AI attribution of any kind (no "Generated with Claude Code", no Co-Authored-By); this overrides any default attribution.

Before a PR is opened, `pnpm verify` and the whole e2e suite (`pnpm e2e` against the production build, see `browser-checks`) run locally. CI runs `pnpm verify` only: the user decided (phase 20) that e2e stays out of GitHub Actions to save its minutes.

## Delivery report (required at the end of every phase or task)

Write this as the final message, in this order, nothing else after it:

```
## Delivery: <phase or task name>

**Branch:** feature/<slug> (from develop)
**Commit:** One-line message
**Branch status:** done, open a PR into develop and start the next phase on a new branch / keep working on this branch

**Verification command**
pnpm verify            # or the plan's specific command

**Automated tests added**
- apps/server/src/game/engine.test.ts: 24 cases covering ...

**Manual test list**
1. Start Postgres and the dev servers: `pnpm db:up && pnpm dev`.
2. Open http://localhost:15173 on a phone on the same wifi ...
3. Expected: ...

**Deviations from the plan**
- none / list

**Known gaps**
- none / list
```

Manual tests are written for a person with two phones and a laptop. Each item says what to do and what to expect. Keep the list to the behaviours this phase introduced, five to twelve items.

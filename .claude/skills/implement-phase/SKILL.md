---
name: implement-phase
description: Entry point for implementing one Quizmoo phase from docs/plans. Use when asked to implement, continue or finish a phase (e.g. "/implement-phase 3"). Loads the plan, the relevant domain skills, drives the work to a verified state and produces the delivery report.
argument-hint: <phase number>
---

# Implement a phase

You are implementing one phase of Quizmoo. The phase number is `$ARGUMENTS`.

## Before writing code

1. Read `AGENTS.md` in full. Its rules override this skill.
2. Read `docs/plans/README.md`, then `docs/plans/phase-<N>-*.md` for your phase. The plan is the scope. Do not pull work in from later phases. If the phase comes from the backlog and has no plan yet, explore the code, ask the user the product decisions the backlog line leaves open, then write the plan (Goal, Scope, Files, Steps, Done when, Verification command, Manual test list) and add its row to the README. If the previous phase's plan file is still there and its PR is merged, give the user the command to delete it (`Remove-Item docs/plans/phase-<M>-*.md`); finished plans live on in git history and `CHANGELOG.md`.
3. Load the domain skills the plan lists under "Skills to load", plus any topic skill for an area you touch even if the plan does not list it. Server: `game-engine`, `scoring`, `realtime`, `server-api`, `database`. Web: `web-ui`, `game-screens`, `quiz-editor`, `design-system`, `motion`, `socket-client`. Both: `i18n`, `team-modes`. Always load `verification` and `git-workflow`; load `browser-checks` before any screenshot or e2e run.
4. Read every existing file the plan says you will touch, and the files that import them.
5. Post a numbered step list (from the plan's "Steps") with the verification check for each step, before editing anything.

## While implementing

- Work step by step in the plan's order. Each step ends with its check actually run, not assumed.
- Keep the shared Zod schemas in `packages/shared` the single source of truth. If the plan requires a schema change, do it first and typecheck everything.
- Every user-visible string goes through i18n with both `hu.json` and `en.json` updated in the same step.
- No git commands. The user does all branching, committing and pushing. Do not run `git add`, `git commit`, `git checkout`, `git push` or `git init`.
- If a step is blocked or the plan turns out to be wrong, stop, say what is wrong and propose the smallest change to the plan. Do not silently re-scope.

## Finishing

A phase is done only when all of these are true:

- `pnpm typecheck`, `pnpm test` and `pnpm build` pass from the repo root, and you have read the output.
- The plan's "Verification command" passes.
- Every item in the plan's "Done when" list is met.
- The delivery report (format in `git-workflow`) is written as the final message, with the manual test list, verification command, branch name and one-line commit message.
- `docs/plans/README.md` status row for the phase is updated to `done`, and any deviations from the plan are noted in the plan file under a "Deviations" heading.
- `CHANGELOG.md` and `docs/plans/backlog.md` ("Already done") mention the phase.
- Learnings are recorded: anything the session got wrong or found out the hard way goes, as one concrete line, into the topic skill it belongs to (a new code convention into that area's skill, a process trap into `browser-checks` or `verification`, a rule about working with the user into AGENTS.md "Project Learnings"). If no skill fits and the topic is big enough, add a new small skill rather than growing an unrelated one, and list it in AGENTS.md and in step 3 above.

# Later (after the MVP): hosting without an account

**Status:** planned, not scheduled. Requested 20 October 2026.
**Branch when started:** `feature/guest-hosting` (from `develop`)

## Goal

Someone who just wants to run one quiz at a party can do it without signing up and waiting for the admin's approval: open Quizmoo, make or import a quiz, start a game, and later (optionally) keep it by creating an account. Players already need no account; this extends that to hosts.

## Proposed design (to be decided when the phase starts)

1. **Guest host = a server-side guest identity, not an account.** "Host without an account" creates a `guest` row (random id, no username, no password) and a session cookie, like a login. The guest can create quizzes and run games exactly like a host; everything belongs to the guest id.
2. **Short life.** A guest and everything it owns are deleted N days after its last activity (proposal: 7). The UI says so clearly ("Kept for 7 days on this browser. Create an account to keep it."), and the privacy page and records of processing get a row for it.
3. **Claim later.** "Keep my quizzes" turns the guest into a normal account (username and password, terms accepted): the rows move to the new user id in one transaction. Sign-up approval still applies if `REGISTRATION_OPEN` requires it; until approval, the guest keeps working.
4. **Terms.** A guest accepts the terms with the same checkbox (age 16+) before creating the guest; the version is stored on the guest row.
5. **Limits.** Guests get tighter ceilings than accounts (proposal: 3 quizzes, 2 open games, 50 images) and the guest creation is rate limited per network address, so the server cannot be filled anonymously. `MAX_PLAYERS` stays the same.
6. **Switch.** A setting `GUEST_HOSTING=true|false` (off by default, like `REGISTRATION_OPEN`), so the operator decides; the venue LAN does not need it.

## Open questions

- Should guests upload images at all, or only use the quiz file import? Images are the main storage and abuse risk.
- One guest per browser, or can a guest continue on another device (a recovery link shown once)?
- Do guests see the game history and results export, or only the current game?
- Does a guest need an admin's approval at all? (Proposal: no, the limits and the short life replace it.)

## Data protection notes

The guest row holds no personal data beyond what hosts' content contains. The cookie is strictly necessary (the guest asked to host). Deleting inactive guests is the retention rule; the export and delete buttons work for guests too.

## Rough size

L (a week or more): schema (guests or a `users.kind`), auth paths, claiming, limits, retention job, UI entry points, legal text updates, tests and e2e.

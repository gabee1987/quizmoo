# Phase 54: Every text in the app, reviewed

**Branch:** `feature/texts-and-starter-quiz` (phases 54 to 56 on one branch)

## Goal

Every text in the app reads as one voice: consistent words for the same thing, plain and easy, friendly and a little playful like a game, never stiff, machine-like or cringe. Hungarian uses "te" everywhere (no "magázás"). The legal pages stay professional and legally appropriate, in plain language, with the same meaning.

## Scope

- `apps/web/src/i18n/hu.json` and `en.json`, every key except the old release notes (`whatsNew.releases.*`, which are history).
- Server texts a person reads: the sign-up e-mail to admins.
- Legal pages (`legal.*`): wording and consistency only, same meaning, professional tone; the terms version stays.
- Out: renaming keys, changing behaviour, quiz content written by hosts.

## Style guide

- **Voice**: a friendly game host talking to one person. Short sentences, everyday words, active verbs. Say what happens and what to do next. A little playfulness where it fits (empty states, waiting screens, the cow), never in errors that need fixing or on legal pages.
- **Hungarian**: "te" form everywhere. Headings and calls to action as verbs or short natural phrases ("Csatlakozz!", "Törlöd ezt a kvízt?"), short nouns on buttons where Hungarian apps use them ("Mentés", "Mégse", "Kész"). The app speaks as "mi" ("Keressük a játékot…"). No "Kérjük", no "Ön".
- **English**: plain and short, sentence case, contractions are fine ("can't", "you're"). Buttons one to three words.
- **Not machine-like**: no "A(z) {{n}}. X Y-ása" chains where a person would say it differently, no noun piles, no "successfully", no "operation".
- **Not cringe**: no forced puns outside the cow's lines, no exclamation marks on routine messages, no emoji.

## Glossary (one word per thing)

| Thing | Hungarian | English |
|---|---|---|
| A group of questions with an intro (`groups`) | kör | round |
| Playing the same quiz again with the same players (`playAgain`) | visszavágó | play again / rematch |
| The person running the game | játékvezető | host |
| The big shared display | kivetítő | projector |
| Host login | belépés, lépj be | log in |
| Host sign-up | regisztráció, regisztrálj | sign up (verb), sign-up (noun) |
| Account | fiók | account |
| Standings between questions | állás | standings / scoreboard (`scoreboard` setting only) |
| A team member's proposed answer | tipp | pick |
| Six-digit code | PIN | PIN |

## Steps

1. Flatten both dictionaries into a review sheet; split into five areas (player screens, host game, editor and files, host pages and admin, legal). Check: every non-release key is in exactly one area.
2. Review each area against the style guide and glossary, producing proposals (key, new hu, new en, reason). Check: placeholders, `<tags>` and plural keys unchanged in every proposal (script).
3. Read every proposal and accept, change or drop it. Check: the accepted list is consistent with the glossary across areas.
4. Apply to the dictionaries. Check: `i18n.test.ts` passes, JSON parses, key sets equal.
5. Update e2e specs and unit tests that look for changed texts. Check: `pnpm verify`, `pnpm e2e` against :3999.
6. Look at the main screens in both languages (join, phone game, host lobby and board, editor, quiz list). Check: screenshots, no overflowing button labels.

## Done when

- No "group"/"csoport" for rounds left in the UI; no "Ön", "Kérjük" in hu.json.
- Placeholders and plural forms intact (script check), i18n test green.
- e2e passes against the production build.

## Verification command

`pnpm verify`, then `pnpm e2e` against the production build (see `browser-checks`).

## Manual test list (draft)

1. Join a game on a phone in Hungarian and in English; read every screen to the podium.
2. Host a game: lobby, board, reveal, end; read the buttons and hints.
3. Open the editor: add a round, check it says "kör"/"round" everywhere.
4. Open the privacy notice and terms: same meaning, professional, readable.

## Results

- 371 strings changed (172 hu, 199 en) after reading 251 proposals from five area reviews; every proposal was checked for placeholders and tags by script.
- `pnpm verify` passed (shared 51, server 621 with the database, web 360, build); `pnpm e2e` 31/31 against the production build.

## Deviations

- The legal review found three places where Hungarian and English said different things (account sharing, the content licence's scope, when a player's seat is removed). The user chose to align them and raise `TERMS_VERSION` to 2026-11-05, so the legal scope went beyond "same meaning".
- Two concerns outside wording were reported, not changed: players under 14 "accepting" the terms by joining, and no stated legal basis for the admins' sign-up e-mail.
- The results CSV headers (server) follow the glossary too: "Kör"/"Round", "Solo".
- The dictionaries were written in one atomic script run while `dev:lan` was stopped (user's choice), not with Edit calls.

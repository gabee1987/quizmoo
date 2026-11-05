# Phase 55: A starter quiz for every new host

**Branch:** `feature/texts-and-starter-quiz`

## Goal

A new host finds a ready, fun 20-question quiz in their list that shows everything Quizmoo can do: every question type and its variations, pictures, rounds, and a few settings worth trying. Funny and tricky questions both, so even the trial game is fun.

## Decisions (from the user, 5 November 2026)

- Language: the sign-up page's language; an account an admin creates gets the admin's current UI language.
- Who: every new account, plus an "Add the starter quiz" action on the quiz list, so existing hosts (or someone who deleted it) can get it any time.
- Pictures: yes, simple drawings shipped with the app (SVG rendered to WebP with `sharp` when the quiz is created), no stock photos, no third-party service.

## Scope

- `apps/server/src/starter/`: the quiz in both languages (pure data + a builder), the drawings as SVG strings, `addStarterQuiz(db, ownerId, lang)` that stores the pictures as the owner's images and inserts the quiz.
- Sign-up (`POST /api/auth/register`) and admin user creation (`POST /api/users`) accept an optional `lang` (`hu` | `en`, default `hu`) and add the quiz in the same request; a failure is logged and never fails the account creation.
- `POST /api/quizzes/starter` (session) `{ lang }` -> `{ id }`: adds a fresh copy.
- Web: the sign-up and the admin's add-user forms send `i18n.language`; the quiz list offers "Add the starter quiz" (empty state and the New menu).
- The seed script uses the starter quiz instead of the test fixture.

## The quiz (20 questions)

Two rounds plus ungrouped questions, every type, with variations: 2, 3, 4 and 6 options, a picture question, picture answers, 0-point warm-up poll, double points, short and long times, number with and without tolerance, text with several accepted answers and typo tolerance, a host-graded text, ordering, true/false trick questions. Settings: streak bonus on, answer changes on with a short lock, countdown 3 s, round intros.

## Steps

1. Write the quiz in both languages; a test parses both with `quizInputSchema` and checks every type and variation is present. Check: test green.
2. Drawings and `addStarterQuiz`; a DB test adds it for a user and reads it back with its images. Check: test green with `TEST_DATABASE_URL`.
3. Wire into sign-up, admin creation and the new route, with tests (`app.inject`). Check: tests green.
4. Web: `lang` on both forms, the "Add the starter quiz" action. Check: e2e or a browser check.
5. Play the starter quiz through once on the production build with two phones (script). Check: screenshots of the picture questions.

## Done when

- A new account has the starter quiz in its language, with working pictures.
- The quiz list button adds another copy.
- Every type and the listed variations are covered (test).

## Verification command

`pnpm verify` with `TEST_DATABASE_URL` set, then `pnpm e2e` against the production build.

## Results

- `starter-quiz.test.ts` (15 cases: both languages, every type, the variations, fresh ids, the drawings render) and `test/starter-quiz.test.ts` (4 cases with the database: sign-up in English, admin-made in Hungarian, the button's copy, refusals).
- Screenshots of the quiz list (phone and laptop) and the editor on the cow and flag questions; the phone list keeps its three buttons on one row with an icon-only starter button.

## Deviations

- The quiz list's button sits next to Import (icon only on phones) instead of in a "New" menu, which does not exist; the empty list shows a larger one with a short explanation.
- `settings-account.e2e.ts` expects "1 quiz" when the new host deletes their account: the starter quiz is now part of every account.

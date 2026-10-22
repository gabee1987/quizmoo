# Phase 40: Question groups

**Branch:** `feature/question-groups` (from `develop`)
**Skills to load:** `game-engine`, `scoring`, `realtime`, `server-api`, `database`, `team-modes`, `web-ui`, `quiz-editor`, `game-screens`, `design-system`, `motion`, `socket-client`, `i18n`, `verification`, `browser-checks`, `git-workflow`

## Goal

A quiz is split into groups (rounds or topics), so a long quiz is easier to build and to run. Each group opens with an intro screen on the projector and the phones, showing a title, some info and a picture. A group can play by its own rules: different time, points, scoring and flow from the rest of the quiz. A quiz may now hold 200 questions instead of 100.

## Decisions (from the user, 22 October 2026)

1. **One phase**, taken before phase 37.
2. **Limit:** 200 questions per quiz.
3. **Intro screen.** It moves on when the host presses Next, or after a number of seconds. This is set for the whole quiz and can be overridden per group. During the game the host can still start the group early, or hold the countdown.
4. **Group end.** Standings follow each group by themselves, or only when the host shows them. This is set for the whole quiz and can be overridden per group. In the game the host can always show or skip them.
5. **Time and points per group.** The group holds a time limit and points:
   - new questions in the group take them;
   - changing them offers "Apply to the 12 questions in this group?".
   
   Every question keeps its own values, so a single question can still differ.
6. **Settings a group may override:**
   - scoring: speed bonus, streak bonus;
   - answering: changing answers and the lock-in seconds, shuffling answer options;
   - reveal and scoreboard: reveal answers after each question or at the group's end, scoreboard after each question or on demand;
   - intro and group end (points 3 and 4).

   The theme, the answer look, team mode, joining and final results stay per game.

### My reading of the answers (to confirm before step 3)

- **"In game"** means the host steers the intro and the standings live: Next, Hold, Show or Skip standings. The host does not edit a group's settings during a game. The new game dialog changes the quiz-wide values for that game, as it does today, but not the group overrides.
- **"Reveal at the group's end."** The group's questions are answered without feedback. After the last question, the screens walk through the group's answers the way "Show answers" does today, and the standings follow.

  While such a group runs, phones see no right or wrong and no points, and no scoreboard is shown, since score changes would give the answers away.

  "Only at the end of the game" stays a quiz-wide choice and cannot be set per group.

## Design

### Data model (`packages/shared/src/quiz.ts`)

```ts
groupSettingsSchema = gameSettingsSchema.pick({
  speedBonus, streakBonus, answerChanges, answerLockSec, shuffleOptions,
  revealAnswers, scoreboard, groupIntroSec, groupStandings,
}).partial()                       // a missing key: same as the quiz

questionGroupSchema = {
  id, title (1–120), info (0–500), imageId?,
  timeLimitSec?, points?,          // what new questions in it take; the editor applies them
  settings: groupSettingsSchema,   // overrides only
}
quiz.groups: questionGroupSchema[] (max MAX_GROUPS = 50, default [])
question.groupId?: string
```

**Validation rules:**
- every `groupId` names a group;
- a group's questions are contiguous, and the groups appear in the order of `groups`;
- questions without a group may only come before the first group;
- a group without questions is a problem shown in the editor, which also blocks starting a game, like other quiz problems.

**New quiz-wide settings in `gameSettingsSchema`:**
- `groupIntroSec`: 0 means wait for the host; otherwise 3–120 s. The default is 0.
- `groupStandings`: `'afterGroup' | 'onDemand'`. The default is `afterGroup`.
- `revealAnswers` gains `'afterGroup'`, which counts as `afterQuestion` for questions outside any group.

`MAX_QUESTIONS` goes to 200. The web uses the shared constant in place of its own copy in `quizzes.$quizId.tsx`, and `showAnswers` indexes in `events.ts` are capped by `MAX_QUESTIONS`.

### Storage and routes

- **Database:** a migration adds `quizzes.groups jsonb not null default '[]'`.
- **Routes:**
  - `assignIds` gives groups ids too;
  - duplicate (`withFreshIds`) remaps the `groupId` values;
  - the quiz list shows a group count;
  - the account export includes groups;
  - image retention also scans `groups` for picture ids.
- **Quizmoo file:** it carries groups and their pictures (`quizImageIds`, `mapQuizImages`). Files without groups import as today.
- **The frozen game copy (`GameQuiz`)** includes `groups`. Games saved before this phase have none, and are read as `[]`.

### Engine

- **New phase `intro`,** with `introEndsAt` (null while waiting for the host) and `introHeld`:
  - `startGame` and `advance` enter it before the first question of a group;
  - `next` from the intro opens that question;
  - `holdIntro` and `releaseIntro` stop and restart the countdown;
  - the realtime layer arms one timer per game for `introEndsAt`, as it does for questions, and re-arms it on restore.
- **Effective settings:**
  - `settingsAt(state, index)` = `{ ...state.settings, ...group.settings }`;
  - every per-question rule reads them: scoring bonuses, answer changes and lock-in, the scoreboard step, the reveal, and the early close;
  - `shuffleOptions` applies per question at creation.
- **Group end:** when `next` leaves a group's last question, the flow depends on the reveal setting.
  - With `afterGroup` reveal, the host gets "Show answers", which queues the group's questions (the existing `reviewQueue`).
  - With `groupStandings: 'afterGroup'`, the scoreboard comes next, even when the per-question scoreboard is on demand.
  - After that, the next group's intro follows.
  - The host's primary and alternative actions (`primary-action.ts`) offer what is left: Show answers, Show standings, Skip to next group.
- **Hidden answers:** `answersHidden(state, audience)` holds per question for `afterGroup`, until the group's reveal walk has started. The game-wide `atEnd` works as today.
- **Snapshots:**
  - `group: { id, title, info, imageId, index, count, questionCount, firstIndex } | null` for the current group, and in the intro phase also its `introEndsAt` and `held`;
  - `groups` in the host snapshot: titles and question ranges, for the host's lists;
  - `questionStats` and the phone's review get their question's `groupId`.

### Screens

- **Projector:** an intro screen with the group's number ("Round 2 of 5"), title, info, picture, question count and a countdown bar when timed. Question screens show the group title as a chip next to "Question 14 of 150".
- **Phone:** an intro screen with the title, info and the picture, kept inside 390 × 844 with no scrolling. The question, "Answer sent!" and reveal screens get the group chip.
- **Host control:** an intro view with Next ("Start round"), Hold and Release, and a preview of what the screens show. At a group's end, the actions from the engine. The settings line names group overrides ("Round 3: no speed bonus").
- **Lobbies:** "24 questions in 4 rounds".
- **Results page:**
  - the Questions tab gets group headings;
  - the CSV export gets a group column.

### Editor

- **The question list** shows group header rows (number, title, question count, collapse), with the questions under them:
  - drag and drop moves questions within and between groups;
  - the move buttons stay;
  - groups move with up and down buttons;
  - "Add group" works below any question: it starts a group there, holding the questions up to the next group.
  - Deleting a group keeps its questions: they join the group before it, or none. There is an Undo toast, as for questions.
- **Selecting a group header** opens `GroupForm` in place of the question form:
  - title, info and picture (the existing `ImageField`);
  - time and points, with "Apply to its N questions";
  - the overrides, each with "Same as the quiz" or its own value, laid out in the same groups as `GameSettingsForm`.

  The phone preview shows the intro.
- **Quiz settings** gain the intro time and the group standings under Game flow, and "after each round" for the reveal.
- **Validation:** `locateProblem` learns `groups.<i>` paths and focuses the group's field.
- **Many questions:** collapsed groups keep the list short. The list stays non-virtualised. Step 9 checks that 200 questions still drag and scroll smoothly; if they do not, the list is virtualised within this phase.

### Spreadsheet (`quiz-csv.ts`)

- A row of type `group` (`csoport`) starts a group: the question column holds the title, answer 1 the info, and time and points the group's values. The following rows belong to it.
- Group overrides and pictures are not in the spreadsheet; the Quizmoo file carries them.
- The template's guide and examples show one group.
- `MAX_CSV_BYTES` goes to 1 MB.

## Scope

In: everything under Design.

Out:
- random question order (phase 39), including shuffling within groups;
- points or standings per group (only the total standings);
- editing group overrides in the new game dialog or during a game;
- groups in the multi-quiz batch edit (`PATCH /api/quizzes/batch`);
- nested groups;
- a question bank.

## Steps

1. **Schema and validation.** Add the group schemas, the new settings, the validation rules, `MAX_QUESTIONS` 200 and `MAX_GROUPS`, and update `events.ts`.

   Check:
   - shared tests for valid and invalid group layouts (unknown id, split group, ungrouped question after a group, empty group);
   - a 200-question worst case (longest texts, six options) under the 1 MB body limit;
   - `pnpm typecheck`.
2. **Storage and routes.** The migration, `assignIds`, duplicate, the list count, retention, the account export, and the Quizmoo file.

   Check: server route tests with `app.inject` (save and read groups, duplicate remaps ids, export and import round trip, retention keeps a group picture), against `TEST_DATABASE_URL`.
3. **Engine.** The intro phase, hold and release, the effective settings, the group end flow, the per-group reveal and the snapshots. Confirm "My reading of the answers" with the user first.

   Check: engine tests for every new transition and every override, with a fixture quiz of two groups plus ungrouped questions in front, and the JSON round-trip invariant.
4. **Realtime.** The intro timer, the host commands (`next`, `holdIntro`, `releaseIntro`) and restore.

   Check: realtime tests (a timed intro opens the question, a held one does not, a restart mid-intro resumes).
5. **Host control.** The intro view, the group-end actions, and the settings line.

   Check: `primary-action` unit tests; a screenshot of the host view at 1440 × 900 and 390 × 844.
6. **Projector and phones.** The intro screens, the group chip and the lobby line.

   Check: screenshots of the projector at 1920 × 1080 and the phone at 390 × 844 in both modes, with and without a picture, with no scrolling.
7. **Editor.** The list with groups, `GroupForm`, the apply prompt, the quiz settings, and the preview.

   Check:
   - `draft.ts` tests (add, move and delete a group, move a question across groups);
   - `validate.ts` tests for group paths;
   - screenshots at `xl` and on a phone.
8. **Spreadsheet and results.** Group rows in import and export, the template, the results headings and the CSV column.

   Check: `quiz-csv` tests (round trip with groups, a group row without a title is a problem); the results page screenshot.
9. **Scale.**
   - The load test with 200 questions, 4 groups and 60 players: the snapshot size and the broadcast time per answer, before and after.
   - The editor with 200 questions: dragging and scrolling on the production build.

   Check: the figures go in Results. If the broadcast time grows past the noise, slim the snapshots (for example, `questionStats` texts only to the host) before moving on.
10. **Texts, docs and the e2e suite.**
    - the translations in both languages;
    - a new `groups.e2e.ts`: build a two-group quiz, play it through a timed and a host-led intro and the group standings;
    - CHANGELOG, README row, backlog, skills (`game-engine` phases and commands, `quiz-editor`, `game-screens`).

    Check: `pnpm verify` and the full e2e on :3999, with axe on the intro screens in both modes.

## Done when

- [ ] A quiz holds up to 200 questions and up to 50 groups; the editor, the spreadsheet and the Quizmoo file all keep groups.
- [ ] A group's intro shows its title, info and picture on the projector and the phones, and moves on by the host's Next or after its seconds, with Hold working.
- [ ] Standings follow a group when set so (quiz-wide or per group), and the host can always show or skip them.
- [ ] Each override (scoring, answering, reveal and scoreboard, intro and group end) changes play only inside its group (engine tests).
- [ ] A group's time and points go to new questions in it, and to all of them on request.
- [ ] Quizzes and games from before this phase load and play unchanged.
- [ ] The load test figures with 200 questions and 60 players are recorded, and the editor stays smooth with 200 questions.
- [ ] `pnpm verify` and `pnpm e2e` pass; axe passes on the new screens in both modes.

## Deviations

- **Hold and release** are the existing `pause` and `resume` host commands, which now also work in a timed intro (shifting `introEndsAt`), instead of new `holdIntro` and `releaseIntro` commands. The intro has no `introHeld` field: `pausedAt` marks a held intro.
- **During the intro** `questionIndex` stays on the question before it (-1 before the first), so ending the game in an intro never counts the unasked question. The intro is about `questionIndex + 1`.
- **Snapshots carry the effective settings** (`settingsAt`) of the question on the screens, so the phone and host rules (answer changes, the scoreboard step) follow group overrides without their own merging. The lobby and the finished game keep the game's own settings.
- **A group's `revealAnswers`** may be `afterQuestion` or `afterGroup` only; `atEnd` stays quiz-wide in the schema too.

## Verification command

```powershell
pnpm verify
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="..."; pnpm e2e
```

## Manual test list (draft)

1. In the editor, add a group above question 1 and another above question 6. Give each a title, info and a picture. Expected: the list shows two headers with their questions, and the preview shows the intro.
2. Set the second group's time to 10 s and its points to 500, and accept "Apply". Expected: its questions change and the first group's do not. A question added to it starts at 10 s and 500.
3. Drag a question from group 1 into group 2, then delete group 1. Expected: the question moves; after the delete its questions stay ungrouped at the top, and Undo brings the group back.
4. Turn off the speed bonus for group 2 only and play. Expected: in group 2 every correct answer gets the full points; group 1 still rewards speed.
5. Start the game with "wait for the host" intros. Expected: the projector and phones show group 1's intro until Next.
6. Set group 2's intro to 10 s. Expected: it starts by itself; Hold stops the countdown, Release resumes it.
7. With standings after each group, finish group 1. Expected: the standings come before group 2's intro. Set the quiz to "only when the host shows them" and check that the host gets "Show standings" or "Next round".
8. Set group 2 to reveal at the round's end. Expected: phones get no feedback during the round; at its end, "Show answers" walks through its questions, then the standings.
9. Import a spreadsheet with a `csoport` row, and export the quiz as a Quizmoo file and import it again. Expected: the groups are kept, and the file also keeps the pictures and overrides.
10. Open a quiz from before this phase and play it. Expected: it works as before, with no intro screens.
11. Build or import a quiz with 200 questions. Expected: the editor stays smooth, and the game runs with phones attached.

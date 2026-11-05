# Phase 64: Question bank and share codes

**Branch:** `feature/question-bank-and-reactions` (from `develop`), shared with phase 58 (the user wants two or three features per branch, 5 November 2026). Delivered in three commits, one per part below; each part is usable on its own.

## Goal

Questions stop being locked into one quiz. A host copies questions to another of their quizzes, keeps favourites in a personal question bank, and shares a question, a selection or a whole quiz with anyone through a short code.

## Decisions (asked 5 November 2026)

- **Per user first:** the bank belongs to the host's account. When communities arrive (phase 62), each bank moves into its owner's personal community.
- **Tags:** free-form, with suggestions from the host's existing tags. No difficulty field; a difficulty derived from past games can come later.
- **Share codes:** anyone with the code can **preview** the questions without an account (answers hidden); adding them to a bank or a quiz needs a host login. Default expiry 30 days, with 7 days and "never" as the other choices.
- **Selecting several questions:** a "Select" mode in the editor's question list with checkboxes and an action bar, as on the quiz list page.

## Decided in this plan

- **Copies, not links.** Adding a question to a quiz, the bank or another account always copies it with fresh ids. Editing one copy never changes another. The roadmap's "a newer version is in the bank" note is left for later: it needs version tracking that nothing else uses yet.
- **Pictures:** within one account a copy reuses the same image ids (as "Duplicate" does today). Redeeming a code copies the image bytes into the receiver's account, so the sharer deleting a picture never breaks the copy. The receiver's image quota (1000) applies; over it, the redeem fails with `errors.tooManyImages` and nothing is added.
- **Codes:** `QM-` followed by 10 characters in two blocks of five (`QM-7K4PX-2XNAQ`) from a 31-character alphabet without 0, O, 1, I and L: about 49 bits, unguessable with the rate limits below. Codes are matched case-insensitively and with or without the dashes. A link carries the code: `/share/<code>`.
- **Frozen copy:** a code stores its own copy of the questions (or the quiz with its settings and groups) when it is created. Revoking deletes the code and its copy at once; expired codes are deleted by the daily job.
- **Limits:** 2000 bank questions and 100 live share codes per host; a code holds at most 200 questions. Preview lookups: 20 per minute per IP (in memory, the address is never stored); redeems: 30 per hour per account.
- **Where it lives:** a "Question bank" page at `/host/bank` with two tabs, Questions and My share codes, opened from the quiz list's header and from the sidebar under Quizzes. The phone's bottom bar stays at four tabs. "Enter a code" is on the bank page and in the quiz list's header.
- **Security gap closed on the way:** today `PUT /api/quizzes/:id` checks only the logo's owner, not the pictures on questions, options and groups. Every route that stores questions (quiz save, append, bank, share) now checks that each picture belongs to the host (`errors.imageNotFound` otherwise). Pictures are public by id, so this is not a data leak, but without the check a code could copy another account's picture.

## Scope

### Part 1: Copy to quiz

- Editor: "Copy to quiz…" in the selected question's More actions menu and in the select mode's bar. A dialog lists the host's other quizzes (search by title), and the copies go to the end of the chosen quiz, without their round (`groupId` dropped). A toast says "3 questions copied to Pub quiz" with a link to open it.
- Server: `POST /api/quizzes/:id/questions` with `{ questions }` appends copies with fresh ids; owner check; picture check; 200-question limit (`errors.tooManyQuestions`, nothing added).
- Editor select mode: "Select" in the list header shows a checkbox per question (a group's checkbox selects its questions), a bar with the count, Copy to quiz, Save to bank, Share and Delete (with Undo, like single delete). Escape or "Done" leaves the mode; drag and drop is off while selecting.

### Part 2: The bank

- Table `bank_questions`: id, owner (cascade on account delete), question (jsonb, validated with `questionSchema`), tags (text array, each 1–30 characters, at most 10), created and updated times. Index on owner.
- Routes: list (search in text and options, type, tag; pages while scrolling), create from questions (one or many), update (question and tags), delete (one or many), and `GET /api/bank/tags` for suggestions.
- Editor: "Save to bank" (single and selection; a small dialog to add tags), "Add from bank" next to the type picker: a picker with search, type and tag filters, a preview of the question, and multi-select; the questions are added after the selected one.
- Bank page, Questions tab: the list with filters, edit a question in a dialog with the editor's question form, tags, delete with Undo, "Import from spreadsheet" with the existing template and its problem report.
- Account: bank questions are listed in the account overview, included in "Download my data" and deleted with the account. The daily image clean-up keeps pictures that a bank question uses.

### Part 3: Share codes

- Table `share_codes`: id, code (unique), owner (cascade), kind (`questions` or `quiz`), title, content (jsonb: the questions, or the whole quiz input), expires at (null for never), uses, created at.
- "Share" on a question, a selection, a bank selection and a quiz card: a dialog with the expiry choice, then the code, the link, a copy button and a QR code.
- Public preview: `GET /api/share/:code` returns the title, kind, question count and the questions without answers (`toPublicQuestion`), or `errors.shareCodeNotFound` for a wrong, expired or revoked code (one answer for all three). Web route `/share/$code`: the preview, and "Log in to add these" or, when logged in, the add actions.
- Redeem: `POST /api/share/:code/redeem` with a target: the bank, an existing quiz (appended), or for a whole quiz a new quiz of the receiver's own. Pictures are copied, ids are fresh, the use count rises.
- My share codes tab: title, kind, created, expiry, uses, Copy link, Revoke (with a confirmation).
- Retention: expired codes are deleted daily; the image clean-up keeps pictures that a live code uses.
- Legal texts: the terms say the sharer is responsible for what they share and that anyone with the code can see the questions; the privacy notice lists bank questions and share codes and says nothing about the receiver is stored beyond a use count.

Out of scope: community banks (after 62), public question collections (66), a "newer version in the bank" note, difficulty.

## Files (from the code survey)

- Server: `db/schema.ts` and migration `0020` (`bank_questions`, `share_codes`), `routes/quizzes.ts` (append route, picture check in save; helpers `withFreshIds`, `ownQuiz`, `parseQuiz`), new `routes/bank.ts` and `routes/share.ts`, `routes/images.ts` (`ownsImage`, a helper that copies image rows to another owner), `routes/account.ts` and `routes/users.ts` (overview, export), `retention.ts`, `realtime/rate-limit.ts` and `realtime/pin-guard.ts` (in-memory limits), `app.ts` (registration).
- Shared: `quiz.ts` (reuse `questionSchema`), new `bank.ts` (bank and share schemas, the code format and its normaliser, with tests).
- Web: `routes/host/quizzes.$quizId.tsx` (selection state, actions), `features/editor/question-list.tsx` (select mode), `question-toolbar.tsx` (menu items), new dialogs under `features/bank/`, new routes `routes/host/bank.tsx` and `routes/share.$code.tsx`, `routes/host/quizzes.index.tsx` (Share on cards, header links), `components/host-nav.tsx`, `features/settings/account-panel.tsx`, legal pages, both dictionaries.

## Steps

1. **Picture ownership check** on quiz saves. Check: a server test that saving a question with another account's picture fails and with one's own succeeds; the existing quiz tests still pass.
2. **Part 1 server:** the append route. Check: tests for owner, picture check, the 200 limit and fresh ids.
3. **Part 1 web:** select mode and Copy to quiz. Check: screenshots of the select mode at 390 and 1440 px; an e2e spec copies two questions and opens the target quiz.
4. **Part 2 server:** migration, bank routes, account overview, export, image clean-up. Check: route tests (owner only, filters, tags, limits), `export.test.ts` and the image clean-up test cover bank pictures.
5. **Part 2 web:** Save to bank, Add from bank, the bank page, spreadsheet import. Check: screenshots of the picker and the page in both modes; e2e: save a question, add it to another quiz.
6. **Part 3 server:** migration, share routes, redeem with picture copy, retention, rate limits. Check: tests for the code format and normaliser, preview without answers, the single error for wrong / expired / revoked, redeem into bank / quiz / new quiz, picture copies under the receiver, quota, use count, rate limits, account deletion removing codes.
7. **Part 3 web:** Share dialog, `/share/$code`, My share codes, legal texts. Check: screenshots of the preview logged out and logged in; e2e with two host accounts: share a quiz, redeem it as the other host, revoke, the code stops working.
8. **Docs:** a `question-bank` feature skill (decisions above), the `server-api` route table, the `database` skill, backlog and CHANGELOG. Check: read the diff.

## Done when

- A question can be copied to another quiz, saved to and added from the bank, and shared by code, as one question, a selection or a whole quiz.
- A code's preview never contains a right answer; a wrong, expired or revoked code gives the same answer.
- Redeemed pictures belong to the receiver and survive the sharer deleting theirs.
- Deleting an account removes its bank and codes; "Download my data" includes both.
- `pnpm verify` and the whole e2e suite pass.

## Verification command

```
pnpm verify
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="<password>"; pnpm e2e
```

## Manual test list

1. Editor: Select, tick three questions, Copy to quiz, pick another quiz. The toast's link opens it with the three questions at the end, pictures shown.
2. Copy into a quiz that already has 199 questions: an error says it would go over 200, and nothing is added.
3. Save a question to the bank with the tags "history" and "easy". The bank page lists it; filtering by "history" finds it.
4. In another quiz, Add from bank, search for a word in it, add it. Edit it in the quiz: the bank's copy stays as it was.
5. Share a whole quiz with "7 days". Copy the link and open it in a private window: the preview shows the questions without answers and asks you to log in.
6. Log in as a second host (host_12345), open the link, "Make my own copy". The new quiz plays with its pictures.
7. As the first host, delete a picture from the original quiz. The second host's copy still shows it.
8. My share codes shows 1 use. Revoke it; the link now says the code was not found.
9. Type the code in lowercase without dashes in "Enter a code" before revoking: it is found.
10. Download my data: the file lists the bank questions and the share codes.

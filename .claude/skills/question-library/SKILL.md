---
name: question-library
description: Why copying questions, the question library and share codes work the way they do (phase 64): copies with fresh ids, the library's linked copies and one-way updates, autosave on the question page, share codes with frozen copies, one code per shared thing, what a shared quiz or shared questions may become, picture copies and the limits. Load before changing copy to quiz, the library (bank), linked copies, share codes or their pages.
---

# Question library and share codes (history and reasons)

Routes: `server-api` (`/api/quizzes/:id/questions`, `/api/bank*`, `/api/share*`). Tables: `database` (`bank_questions`, `share_codes`). Decisions from the user, 5, 10 and 12 November 2026.

## Names

- **"Question library" / "Kérdéstár"** in the UI, route `/host/library`; the code, API and table keep `bank`. "Bank" sounded corporate and farm-themed names too playful (10 November). The public quiz library (phase 66) needs a name that cannot be confused with it ("Quiz library" / "Kvíztár").
- The library belongs to the host's account; with communities (phase 62) it moves into the owner's personal community.

## Copy to quiz (part 1)

- **Copies, not links:** copies get fresh ids and leave their round behind (`groupId` dropped); editing one never changes another. Appended to the end, all or nothing, the 200-question limit checked inside the update.
- **Select mode** in the editor's question list (checkboxes, a round's box ticks its questions, a 2 × 2 action bar: Copy to quiz, Save to library, Share, Delete with one Undo). Dragging is off while selecting.
- **Picture check on every route that stores questions** (quiz save, append, library, share): each picture must be the host's (`errors.imageNotFound`); pictures already stored are let through so old quizzes keep saving. Pictures are public by id, so this is no leak, but without it a share code could copy another account's picture.

## The library (part 2)

- **Free-form tags** with suggestions from the host's own (up to 10, 1–30 characters, case-insensitive). No difficulty field. Up to 2000 questions per host.
- **A question has its own page** laid out like the editor (`/host/library/new`, `/host/library/$questionId`), not a dialog, and it **autosaves** like the editor. A new question is created by its first valid save; the address then becomes the question's through a route mask, because a real navigation would remount the form mid-typing.
- **Linked copies with an offered update:** a copy added from or saved to the library keeps `Question.bank = { id, hash }`. After a library edit the host is asked "Update the quizzes too?"; nothing changes without asking. A copy changed in its own quiz is "Changed in this quiz" and starts unticked. `questionHash` leaves out ids, round, switch, colour and the link, so moving or switching a copy off is not a change.
- **"Update the quizzes automatically"** per question, off by default: each save updates the unchanged copies; changed ones still wait.
- **One way only, library to quizzes.** A quiz edit never flows back by itself: a tweak for one event would rewrite the library and every other quiz, two quizzes could overwrite each other, and the editor saves on every keystroke. "Save changes to the library" (More actions, behind a confirmation) is the explicit way back.
- **Delete asks first and keeps Undo**; Undo restores under the same id (`POST /api/bank/restore`) so the links survive.

## Share codes (part 3)

- **Format** `QM-XXXXX-XXXXX` from 31 characters without 0, O, 1, I, L (about 49 bits), read in any case, with or without dashes or `QM`, or from a pasted link (`normaliseShareCode`). Guessing is stopped by the limits: previews 20 a minute per IP (in memory, the address never stored), redeems 30 an hour per account.
- **Anyone with the code previews** without an account, answers hidden (`toPublicQuestion`); adding needs a host login, and the login returns to the share page (`safeHostPath` accepts `/share/<code>`). Wrong, expired and revoked codes give one answer, so nothing tells them apart.
- **Expiry** 30 days by default, 7 days or never. At most 100 live codes per host.
- **Frozen copy:** a code stores its own copy (for a quiz: rounds, settings, question defaults, description; not the logo or event name, which are the sharer's branding). Revoking deletes the copy at once; the daily job deletes expired ones.
- **One code per shared thing** (12 November: sharing the same quiz twice should not make two codes): a quiz finds its live code by `content.quizId`, loose questions by equal content. The copy is refreshed and the expiry restarts from the new choice, so the copy is "as of the last share".
- **A shared quiz only becomes a quiz; shared questions only go to the library or an existing quiz** (12 November: "Add to my library" and "Add to a quiz" made no sense for a whole quiz, and "Make my own copy" was unclear). The page says in one line what each button does; the server refuses the other targets.
- **No links across accounts:** redeemed questions get fresh ids and no `bank` link, nothing arrives switched off in the library or a quiz (a new quiz keeps the original's switches).
- **Pictures are copied into the receiver's account** in the same transaction, so the sharer deleting one never breaks the copy; the receiver's 1000-picture quota applies. The sharer's own redeem reuses the same pictures instead of filling the quota.
- **Where it lives:** "My share codes" is the library's second tab (`?tab=codes`); "Enter a code" sits in the library's and the quiz list's header. No select mode on the library page: a library question is shared from its card, several from a quiz's select bar.
- **Legal:** the terms say anyone with a code sees the questions and the sharer is responsible for them; the privacy notice lists library questions and share codes. Nothing about a code's users is stored beyond a use count. Terms version raised to 2026-11-12, so every host accepts again.

## Traps found on the way

- The clipboard fallback textarea must be appended inside the open dialog: Radix's focus trap otherwise keeps it from focusing, and `execCommand('copy')` copied nothing while returning true (`lib/clipboard.ts`).
- A dialog is a grid: its children need `min-w-0`, or a long link on the LAN address widens the track past the dialog.

Left out on purpose: community libraries (after 62), public collections (66), a "newer version in the library" note on redeemed copies, difficulty.

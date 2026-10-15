---
name: quiz-editor
description: The Quizmoo quiz editor at /host/quizzes/$quizId: three-pane layout, draft helpers, drag and drop, validation and focusing problems, autosave, shortcuts, the settings column. Load when changing the editor, its preview or quiz settings forms.
---

# Quiz editor (`/host/quizzes/$quizId`)

General web rules are in `web-ui`; the settings column's animation is in `motion`.

- **Layout**: at `xl` three panes (sortable `QuestionList`, the selected question's `QuestionToolbar` + `QuestionForm`, the `PhonePreview` at 82 % zoom); at `lg` list and form, preview behind a toggle; below `lg` the form alone, the list in a bottom `Sheet` opened from a fixed bottom bar. Title, `SaveIndicator`, `ProblemsMenu`, settings and Play live in the top bar, which sticks to the top from `sm`. The settings (description and `GameSettingsForm`) dock as a third column at `xl`, replacing the list so the preview stays visible while themes are chosen (non-modal, Escape closes it); below `xl` they open in a right `Sheet`. The host sidebar is hidden on this route (`routes/host/route.tsx`).
- **Draft** is one `QuizInput` in state; edits go through the pure helpers in `features/editor/draft.ts` (`insertQuestion`, `duplicateQuestion`, `removeQuestion` / `restoreQuestion` for undo, `move` for questions and options). Delete has no confirmation; a Sonner toast with "Undo" restores the question for 10 s.
- **Drag and drop**: `@dnd-kit` through `lib/sortable.ts` (`useSortableSensors`: mouse after 4 px, touch after a 250 ms hold, keyboard; `useSortableAccessibility` for translated announcements; `dragMove`). Keyboard drag starts from a handle button; mouse and touch may drag the whole row. Keep a non-drag alternative (move buttons) for every sortable list.
- **Validation**: `validateQuiz` runs the shared schema; `locateProblem(path)` maps an error path to its question, a label and the `data-field` of the element to focus. Every editable field that can be invalid carries `data-field="<error path>"` (wrappers are fine: the first focusable inside gets focus). New questions show their errors only once visited.
- **Saving**: `useAutosave` returns `{ status, retry }` with `saved | pending | saving | invalid | offline | error`; offline saves retry on the `online` event and every 10 s. `useBlocker` asks before leaving while the status is `invalid`, `offline` or `error`, and the browser's own prompt covers closing the tab while anything is unsaved.
- **Shortcuts**: `matchShortcut` in `shortcuts.ts` (ignored while a field, dialog or menu has focus); list them in `shortcutKeys` so the "?" dialog stays complete.

## Quiz branding

`QuizBrandingFields` (`features/editor/quiz-branding-fields.tsx`) sits under the Look group: show on or off, a logo and an event name that override My settings when filled. It is quiz data (`draft.branding`), not a game setting, so batch edit, game defaults and the settings summary leave it out.

## Game settings groups

`GameSettingsForm` is split into three groups (Game flow, Look, Scoring), labelled with the batch edit's keys (`host.batch.groups.*`) so every dialog names them the same way. `sectionSummary(group)` gives a group's chips; `settingsSummary` is built from it. The new game dialog shows one card per group, one open at a time, with "Changed for this game" and "Reset" when a group differs from the quiz's defaults.

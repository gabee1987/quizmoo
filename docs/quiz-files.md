# Quiz files

Quizmoo reads and writes two kinds of quiz file. Both are made and read in the app under **Quizzes**: **Import** on the quiz list, and **Download as spreadsheet** or **Download Quizmoo file** in a quiz's menu or in the editor's download menu.

| | Spreadsheet (`.csv`) | Quizmoo file (`.quizmoo.json`) |
|---|---|---|
| Purpose | Writing and editing questions by hand, anywhere | A full copy of a quiz, for another install or person |
| Holds | The questions (type, text, answers, correct answer, time, points, tolerance, colour) and their groups (title, info, time, points, colour) | Everything: questions, groups with their own rules, description, game settings, branding, pictures |
| Edited with | Excel, LibreOffice, Google Sheets, Numbers, any text editor | Not meant for hand editing |
| Import | New quiz with the host's default game settings, titled after the file name (editable in the dialog) | New quiz, a full copy, title editable in the dialog |

## Spreadsheet

The template (**Import > Download template**) explains every column in its first rows and has one example of each question type, the last two in a group. It is written in the app's language: Hungarian files are separated by `;` and use a decimal comma, as Hungarian Excel expects; English files use `,` and a decimal point. Reading accepts `;`, `,` or a tab, a decimal point or comma, and the type and true/false words of either language, in any case, with or without accents.

- Rows whose first cell starts with `#` are notes and are skipped, and so is the header row (first cell `type` or `típus`). Empty rows are skipped.
- One question per row, columns by position:

| Column | Content |
|---|---|
| 1 type | `single`/`egy`, `multiple`/`több`, `true-false`/`igaz-hamis`, `text`/`szöveg`, `number`/`szám`, `poll`/`szavazás`, `order`/`sorrend` |
| 2 question | 1 to 500 characters |
| 3–8 answer 1–6 | Choices for single, multiple, poll and order: 2 to 6, up to 200 characters each. For order, in the right order. |
| 9 correct | single: the right answer's column number (`2`); multiple: all right ones (`1, 3`); true-false: `true`/`false` (`igaz`/`hamis`, also `yes`/`no`, `igen`/`nem`); text: accepted answers separated by `\|`, empty for host grading; number: the number; poll and order: empty |
| 10 time | Seconds, 5 to 180; empty means 20 |
| 11 points | 0 to 5000; empty means 1000 |
| 12 tolerance | Number questions only: how far from the right number still counts; empty means exact |
| 13 colour | The question's (or group's) colour tag in the editor: `red`/`piros`, `orange`/`narancs`, `yellow`/`sárga`, `green`/`zöld`, `teal`/`türkiz`, `blue`/`kék`, `purple`/`lila`, `pink`/`rózsaszín`; empty means none. Files without this column read as before. |

- **Groups.** A row of type `group`/`csoport` starts a group (a round): column 2 holds its title (1 to 120 characters), column 3 its info (up to 500), and columns 10 and 11 the time and points its new questions get in the editor (empty: none). The questions below it belong to it, up to the next `group` row or a `group-end`/`csoport-vége` row (the rest of that row is ignored); questions after a group end are ungrouped. A group without questions is a problem. At most 50 groups. A group's colour goes in column 13 like a question's; its own rules and picture are not in the spreadsheet; the Quizmoo file keeps them.

- A file with any problem imports nothing. The dialog lists each problem as row (as a spreadsheet numbers it) and column, with what to write there.
- At most 200 questions and 1 MB per file.
- Text cells starting with `=`, `+`, `-` or `@` are written with a leading apostrophe so Excel does not run them as formulas; the import removes it.

## Quizmoo file

JSON, version 1:

```json
{
  "format": "quizmoo-quiz",
  "version": 1,
  "guide": ["Notes for whoever opens the file; ignored on import."],
  "quiz": { "title": "…", "description": "…", "questions": [], "groups": [], "settings": {}, "branding": {} },
  "images": { "<image id used in quiz>": "<base64 bytes>" }
}
```

- `quiz` is validated with the shared `quizInputSchema` (`packages/shared/src/quiz.ts`), exactly like a quiz saved in the editor. Questions and options without an `id` get one.
- Every image the quiz refers to (question, option, group and logo images) must be in `images`. Each is decoded, limited to 5 MB and re-encoded like an upload, and stored under a new id owned by the importing host. Unreferenced images are ignored.
- At most 25 MB per file. A later format version will get a new `version` number; files of an unknown version are refused.

The code is in `packages/shared/src/quiz-csv.ts` (spreadsheet), `packages/shared/src/quiz-file.ts` (Quizmoo file), `POST /api/quizzes/import` in `apps/server/src/routes/quizzes.ts`, and `apps/web/src/features/host/quiz-files.ts` with `import-quiz-dialog.tsx`.

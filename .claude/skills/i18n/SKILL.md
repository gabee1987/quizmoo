---
name: i18n
description: Hungarian and English localisation rules for Quizmoo: key naming, where strings live, server error keys, pluralisation and dates. Load whenever adding or changing any user-visible text on the web or any error code on the server.
---

# i18n

Hungarian is the default language, English is the second. Both are first-class: no feature ships with one dictionary updated and the other missing.

## Where strings live

- `apps/web/src/i18n/hu.json` and `en.json`, same key tree in both. A key present in one and not the other is a bug; `apps/web/src/i18n/i18n.test.ts` asserts the key sets are equal.
- The server sends no human-readable text. Every error is `{ error: '<key>' }` and every such key exists under `errors.*` in both dictionaries.
- Quiz content (titles, questions, options) is user data and is not translated.

## Keys

- Dot-separated, camelCase leaves, grouped by screen or concern: `join.*`, `play.*`, `screen.*`, `host.*`, `editor.*`, `results.*`, `auth.*`, `common.*`, `errors.*`, `questionTypes.*`.
- Leaf names say what the text is for, not what it says: `editor.addQuestion`, not `editor.plusButton`.
- Reuse through `common.*` for generic actions: `common.save`, `common.cancel`, `common.delete`, `common.next`, `common.back`, `common.loading`.

## Usage in code

```tsx
const { t } = useTranslation()
<Button>{t('common.save')}</Button>
t('play.answeredCount', { count: snapshot.answeredCount })
```

- Never build sentences from fragments; use interpolation `{{name}}` and `count` pluralisation (`key_one`, `key_other` in both languages).
- `aria-label` and `title` attributes are translated too.
- Numbers and dates: `Intl.NumberFormat` / `Intl.DateTimeFormat` with `i18n.language`, never hand-formatted.
- Language choice persists in `localStorage` (`quizmoo.lang`) and is set on `<html lang>`.

## Tone

Hungarian is friendly, natural and informal ("te") on every screen, hosts, editor and admin pages included; never "Ön" or "Kérjük, …" (the user decided it is a game, October 2026). Write what a person would say: headings and calls to action as verbs ("Csatlakozz!", "Lépj be!", "Értékeld a válaszokat", "Törlöd ezt a kvízt?"), not noun phrases ("Csatlakozás a játékhoz", "Válaszok értékelése"). Short nouns stay where Hungarian apps use them on buttons ("Mentés", "Törlés", "Mégse", "Kész"). Prefer everyday words: "online/offline", "végleg", "pár mező", "Valami elromlott". Messages from the app speak as "we" ("Keressük a játékot…", "Nem találjuk."). English is plain and short.

Legal pages (`legal.*`) are the exception: professional, plain and precise, never playful, GDPR terms as the official Hungarian translation uses them ("adatkezelő", "felügyeleti hatóság", "helyesbítés"), still in the "te" form. A change of meaning there raises `TERMS_VERSION` (user decision, phase 54).

## Glossary (phase 54)

One word per thing, in every screen and help text:

| Thing | Hungarian | English |
|---|---|---|
| A group of questions with an intro (`groups` in code) | kör | round |
| Playing the same quiz again (`playAgain`) | visszavágó | play again / rematch |
| The person running the game | játékvezető | host |
| The big shared display | kivetítő | projector |
| Standings between questions | állás | standings |
| A team member's proposed answer | tipp | pick |
| Solo player in team mode | egyéni játékos | solo player |
| The site's operator role | adminisztrátor (admin on short labels) | admin, administrator on legal pages |

"PIN" on short labels, "PIN-kód" inside Hungarian sentences. Never put a number placeholder after an article ("a {{n}}. kérdés" breaks for 1 and 5): write "{{n}}. kérdés", "kérdés: {{n}}." or keep "a(z)". The spreadsheet's row words ("csoport", "csoport-vége", type names, "igaz"/"hamis") are read by the importer and stay as they are.

`i18n.test.ts` compares key sets, but `JSON.parse` silently drops a key that appears twice in one object (`users.role` was both a string and an object until phase 54): after hand-editing, check for duplicate keys.

The app's look is playful, the wording around it is not: patch notes (`whatsNew.releases.*`), documentation and the codebase stay professional. Release notes say plainly what changed and how to use it, in words any player understands; no wordplay, metaphors or in-jokes ("a door you can close", "lessons from the family game"). Titles name the features.

Keep button labels to one or two words. Error messages say what to do next: "Nincs ilyen játék. Ellenőrizd a PIN-t."

## Adding a new error code

1. Throw or ack `{ error: 'errors.newCode' }` on the server.
2. Add `errors.newCode` to `hu.json` and `en.json`.
3. If a test asserts the error, assert the key, not the text.

# Phase 60: Certificates and a results report as PDF

**Branch:** `feature/certificates` (from `develop`)

## Goal

A designed keepsake that makes the game feel worth playing: certificates for the winners, and a clean results report for the host, as PDF files made on the device.

## Decisions (asked 5 November 2026)

- **Certificates by default:** 1st, 2nd and 3rd place, and the top three teams in team mode. A "took part" certificate for everyone is an opt-in game setting.
- **A custom line:** the host can type one line for the certificates, for example "Company Day 2026".
- **Paper:** A4 landscape for certificates, A4 portrait for the report. No Letter size.
- **Rendering:** in the browser with a lazily loaded PDF library. No server work, no outside service, works on the venue LAN.

## Decided in this plan

- **Library:** `pdf-lib` (MIT) with `@pdf-lib/fontkit` (MIT) for the embedded font. Both are dependencies that run in the browser, not services; they are loaded only when a PDF is made (a lazy chunk, cached by the service worker like other assets). No blob workers, so the CSP stays as it is.
- **Font:** static Nunito TTF files (Regular, Bold and Black, latin and latin-ext for ő and ű; SIL Open Font Licence) added under `apps/web/public/fonts/`. The installed variable WOFF2 cannot be embedded by pdf-lib. Fonts are subset when embedded, so a certificate stays small.
- **Colours:** the game's theme hue turned into RGB with a small pure `oklch → sRGB` function (tested), because PDF libraries do not read `oklch()`.
- **Pictures:** the host's logo is WebP; it is drawn on a canvas and embedded as PNG. The cow mark is embedded from `logo.svg` rasterised the same way.
- **Data:** a certificate is built from what the screen already has. For phones, the player snapshot (`me`, `myFacts`, `endFacts`, `branding` when shown on phones). For the host, the results response, which gains `branding` and `endFacts` (the host's own game, nothing new collected).
- **Settings:** `certificates` group in the game settings' Look group: "Certificates for everyone" (off by default) and "Line on the certificates" (up to 60 characters, empty by default). Both in quiz settings, My settings defaults, the new game dialog and batch edit.
- **One highlight per certificate:** the player's award if they won one ("Fastest finger", "Best streak: 7"), else their right answers ("14 of 20 right").
- **File names:** `quizmoo-<pin>-certificate-<name>.pdf`, `quizmoo-<pin>-certificates.pdf`, `quizmoo-<pin>-report.pdf`, with the name made safe for file systems.

## Scope

- **Certificate design (A4 landscape):** cow mark and the host's logo, "Certificate" heading, place (gold, silver and bronze touches for 1st to 3rd, a plain frame for "took part"), the player's or team's name large, the quiz title, the custom line, the date, points and the highlight, in the game's theme colours on a light background so it prints well.
- **Phones:** on the end pages' last page, "Download certificate" for a player who earned one (top 3, a member of a top-3 team, or everyone with the setting on). Only their own certificate.
- **Host results page:** "Certificates (PDF)", one file with every certificate in order, ready to print; "Report (PDF)".
- **Report (A4 portrait, several pages):** a cover with title, date, players and length; summary figures and the podium; standings (and the team table); one block per question with the bars, right share, average time; the hardest and easiest question; the awards. Same figures as the results page.
- Texts in both dictionaries; the certificates use the game's language as the results page does; help page items.

Out of scope: storing PDFs, e-mailing them, Letter paper, a design editor for certificates.

## Files (from the code survey)

- Shared: `quiz.ts` (settings), `game.ts` (`GameResults` gains `branding` and `endFacts`).
- Server: `game/results.ts` (`toResults`), `routes/results.ts`.
- Web: new `features/pdf/` (lazy loader, fonts, colour conversion, image embedding, `certificate.ts`, `report.ts`, their tests on the pure parts), `features/play/podium.tsx` (download button), `routes/host/results.$gameId.tsx` (buttons), `features/host/game-settings-form.tsx`, `lib/download.ts`, `public/fonts/`, both dictionaries.
- `apps/web/package.json` (the two libraries).

## Steps

1. **Fonts, loader and colour conversion.** Check: unit tests for `oklch → sRGB` against known values; a scratch script makes a one-page PDF with Hungarian accents that opens correctly.
2. **Settings and the results response.** Check: server results test includes branding and end facts; batch edit test covers the new keys.
3. **Certificate renderer.** Check: scratch PDFs for 1st, 3rd, a team and "took part", in a playful and a subdued theme, with and without a logo and a custom line, and a 30-character name; look at them, and print one page to paper once.
4. **Phone button and host buttons.** Check: e2e: a winning player downloads a certificate (a PDF of one page), a 4th player sees no button, the host downloads all certificates (page count = winners).
5. **Report renderer.** Check: a scratch report for a 20-question team game; each page looked at; the figures match the results page.
6. **Size and performance.** Check: the main bundle does not grow by more than a few hundred bytes (the PDF code is a separate chunk); a certificate is made in under 2 seconds on a 4× slowed phone profile.
7. **Texts and docs.** Help items, a `certificates` feature skill (decisions above), backlog and CHANGELOG; the libraries noted in `docs/security-notes.md`. Check: `i18n.test.ts`.

## Done when

- Winners and top teams can download their certificate on the phone; with the setting on, everyone can.
- The host gets all certificates in one printable file and a report whose figures match the results page.
- Hungarian names and texts render correctly; logos and theme colours show.
- No PDF is stored on the server; the PDF code loads only when used.
- `pnpm verify` and the whole e2e suite pass.

## Verification command

```
pnpm verify
$env:E2E_BASE_URL="http://localhost:3999"; $env:E2E_USERNAME="admin"; $env:E2E_PASSWORD="<password>"; pnpm e2e
```

## Manual test list

1. Play a game with four phones to the end. On the last end page, the top three see "Download certificate"; the fourth does not.
2. Download it on a phone: a one-page landscape PDF opens with the name, place, points, the quiz title and the date, in the game's theme colours.
3. Set a logo in My settings with "Also on the phones", and a custom line "Company Day 2026" in the new game dialog. Play again: both appear on the certificates.
4. A player named "Őrült Űrhajós" gets a certificate: the accents are correct.
5. Host results page: "Certificates (PDF)" gives one file with three pages; print it to paper and check the margins.
6. "Report (PDF)": the summary, standings and every question's bars match the results page.
7. Turn on "Certificates for everyone" and play: every phone has a certificate, the non-winners a "took part" design.
8. Team game: members of the top three teams get the team's certificate.
9. On the venue LAN with no internet connection, the certificates and the report still download.

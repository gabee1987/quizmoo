# Feature backlog

Candidate features after the design phases (9 to 12). None is planned in detail yet: pick the ones wanted and a phase plan is written for each group, in the format of the other plans. Effort is a rough size: S (a day), M (a few days), L (a week or more). Every item keeps the existing rules: nickname only, server-authoritative state, same origin, i18n keys for errors.

## Playing

| Feature | Why | Effort | Notes |
|---|---|---|---|
| Partial-credit multiple choice ("some of these") | Several correct options where picking some is enough | M | New question type in the shared schema (keeps `multiple` as "all must be picked"); scoring option per question: same points for any correct pick, or points per correct option; wrong picks subtract or void, to decide; phone UI as multiple choice |
| Slider or range question | Estimation questions with a visual answer | M | Like number with min/max/step and a slider input; distribution as a histogram |
| Player reactions | Audience energy between questions | M | Emoji burst on the projector; rate limited; not persisted |
| Sounds and music | Atmosphere | M | Needs licensed audio assets; opt-in on the projector only; phones silent by default |
| Practice mode (self-paced) | Training use, no host needed | L | Different flow: player advances alone, no projector; engine mostly reusable |

## Hosting

| Feature | Why | Effort | Notes |
|---|---|---|---|
| Question bank | Reuse questions across quizzes | L | New table, picker in the editor, tags |
| Quiz sharing between hosts | Team of organisers | M | Owner plus editors per quiz; permission checks on every route |
| PDF results report | Hand-out after the event | M | Server-side rendering; no third-party service |

## Platform

| Feature | Why | Effort | Notes |
|---|---|---|---|
| Admin dashboard | See running games, player counts, errors | M | Reuses `/api/health` data; admin only |
| Metrics endpoint | Operations in the cloud | S | Prometheus-style counters; protected |
| Password reset | Host forgot the password | M | The admin can set a new password on the Users page (phase 28); a self-service reset needs e-mail delivery, which is a third-party service (compliance review) |
| Two-factor login for hosts | Security for public deployments | M | TOTP, no SMS |

## From the test notes (October 2026)

Collected while testing phases 9 to 12. Effort as above.

### Already done

- Bubble-gum press animations and playful details (phase 11 follow-up).
- Drag and drop for questions with a drag preview and a pop on landing (phase 11).
- Structured game settings: readable summary when collapsed, real collapse and expand controls, tabs instead of one long list (phase 11).
- Subdued themes and answer colours for company events (phase 11 follow-up).
- Custom drop-down lists (phase 11 follow-up).
- Pause on the projector's results summary (phase 11 follow-up).
- The quiz settings push the content aside instead of covering the phone preview (phase 11 follow-up).
- Sticky top bar in the quiz editor (phase 11 follow-up).
- Host messages fly in and out with an elastic animation, and the content below follows (phase 12 follow-up).
- Streak bonus, ordering question, avatars, nickname generator and filter, play again (phase 13).
- Pause and resume, host messages that leave by themselves, showing an answered question again, "Show podium" telling the host where it went, the selected-answer marker, the double scrollbar (phase 14).
- Phone game screens without the header, question images that fit, review cards, results summary, new game dialog in groups (phase 15).
- Join and login home screen with the big animated cow (phase 16).
- Host lobby rebuilt around the QR code, with player tiles (phase 17).
- Players can change their answer until the time is up or a lock-in a few seconds before; the last answer counts, with its time (phase 18).
- Teams can answer as one: majority vote or a shared answer, with captains, chosen by the host or by each team (phase 19).
- Teams choose their mode by default; captain decides with live team picks and a majority fallback; the shared answer mode removed (phase 20).
- Clearly visible answer selection, a team of one answers without confirming, team answers labelled in the review, installable app, bigger new game dialog, custom theme and answer colours, bigger editor settings panel, scheduled games with a shareable link, names page markup (phase 21).
- My settings per host account: quick messages, game defaults, branding (logo and event name on the projector and phones), and a host home page (phase 22).
- Teams set up per game (host teams, player-made teams or both), moving players, late joining, the captaincy at any time, team toasts, the team's answer and picks on the phones, and mixed play with solo players ranked with the teams (phase 23).
- Player and host polish from testing: player details and "Leave game" in the phone menu, offline and left teammates, the player's own answer kept in view, swipeable host messages with "Important", the menu button bottom left, a desktop waiting screen, readable lobby rows and join/drop notes for the host, "Running now" for 12 hours, about 180 funny names per language with fitting avatars (phase 24).
- Game history in pages while scrolling, search by title or PIN, state and period filters, and at most 200 finished games kept per host (phase 25).
- Host sign-up with the admin's approval, without e-mail (phase 26).
- E-mail to admins about new sign-ups through Brevo, with a link to the Users page and a return to it after login (phase 36).
- Patch notes for hosts ("What's new" with a dot until read, remembered per account) and the version in the footer (phase 33).
- Cow antics: face gags and silly lines every 30–60 s on the home pages, the header logo and the waiting screens, and seasonal looks on special days (phase 32).
- Admin pages: a Users page with each account's figures and last login, setting a new password, changing the role, logging out everywhere and deleting an account; a Names page that edits the "Surprise me" names row by row (phase 28).
- My settings in four tabs (Games first), and an Account tab: overview, this device's language and look, password, logging out other logins, deleting the own account (phase 29).
- Legal pages (privacy notice, terms, cookies and storage, imprint), terms accepted at sign-up and recorded, "Download my data", a storage notice, and a security review with every finding fixed (phase 30).
- The host's running-game screen: standings shown midgame (also with answers at the end), a Standings card with "Results so far", names in full, controls that stay in view, "Show answers" for any closed question, a chip and a preview of what everyone sees, a screen lock with a code or the password (phase 35), and closing a game at any point without the podium (phase 31).
- Quiz files: questions written in a spreadsheet anywhere (template with a guide and examples) imported with a row-by-row problem report, and quizzes downloaded as a spreadsheet or a full Quizmoo file with settings and pictures (phase 27).
- Question groups (rounds): intros on the projector and the phones, standings and answers after a round, per-round time, points and rules, groups in the editor, spreadsheets and Quizmoo files, colour tags, and 200 questions per quiz (phase 40).
- Random question order per game (groups move as blocks, a group can keep its order), the editor's Shuffle button, and a slim top bar on phones that makes question pictures bigger (phase 39).
- The host's live board: the running game on one screen without scrolling, a tile per player filled in live with the answer, time and verdict, results on the same tiles between questions, tiles or list, sort orders, hidden answers, and the panels as tabs (phase 43, from the first family game, October 2026).
- Questions and groups switched off without deleting them, search in the editor's list, add buttons in the top bar and at the top of the list, jump to the selected question with a clearer selected card, the title in the General tab, and default time and points for new questions (phases 42 and 38).
- Any upcoming question played next between questions (with search and a sticky "plays next" in the Questions tab), the estimated game length everywhere a game starts or runs, the projector and phones between questions (progress, what's next, top 3) and an optional 3-2-1 countdown, each part a setting; quick messages from the top bar and the host seeing their own message (phases 44 and 41).
- Lock joining in the lobby and, with late joining, during the game; the join page and the projector say joining is closed (phase 45).
- Picture details in the editor: stored pixel size, file size and format under each picture (phase 46).

### Open

| Task | Kind | Effort | Notes |
|---|---|---|---|
| Every member's own answer in team results (after the MVP) | Feature | M | Teams that answer as one keep only the team's answer today: members' votes and suggestions are replaced at the reveal. Keep them (`votes` per team answer), and show on the results page and the phones' review what each member would have answered ("so they can blame each other"). From the 13 October test notes. |
| Hosting without an account (after the MVP) | Feature | L | A guest host with a short-lived identity, tighter limits, the terms checkbox, and "Keep my quizzes" to turn it into an account. Design and open questions in [later-guest-hosting.md](later-guest-hosting.md). Requested 20 October 2026. |
| Rooms with their own admin | Feature | L | Each room (workspace) has an admin; only its members see and edit its quizzes and games. Today every quiz and game belongs to one host account. Needs a rooms table, membership and roles, permission checks on every route and socket attach, migration of existing quizzes. |
| Hints to selected players | Feature | M | Messages or hints to chosen players instead of everyone (host-to-player messages were out of scope in phase 12). The live view of the running game itself was done in phase 43; a tile on the board could be where the host picks the players. |
| Fixes in the patch notes (phase 37) | Feature | S | Each release on the "What's new" page gets a "Fixed" section next to the news, and every future release keeps its notes there. From the 20 October 2026 notes. |
| Help page and tutorial (phase 34) | Feature | L | A full help page on how the app works, plus an interactive first-run tutorial with hints on the host pages. To decide in the plan: which flows the tour covers, whether it can be replayed, whether players get hints too. From the 20 October 2026 notes; asked again on 24 October 2026: a full tutorial with interactive hints and help, plus a dedicated help page with everything about how the app works. |
| Sounds for key moments | Feature | M | Short playful sounds for important events and messages, switched on per quiz. Generated in the browser (Web Audio) to avoid licensed audio files; projector only, phones silent by default. Same as the "Sounds and music" item above. |
| Seasonal themes | Feature | M | The cow logo already changes on special days (phase 32: Christmas, Halloween and others). Each season gets a full theme as well: its own colours, flourishes and background on the app's pages and game screens, switched on by date. Anyone can switch it off and keep their usual theme (a per-device setting next to the colour mode; to decide in the plan whether hosts can also switch it off for their games). Requested 30 October 2026. |

### From the first production test (24 October 2026)

Collected while testing the Railway deployment. The help page and tutorial (phase 34), default time and points (phase 38, done in phase 42) and the estimated game length (phase 41) were asked for again; their rows above carry the new details. The switch, the search, the add buttons, the jump and the title field were done in phase 42.

| Task | Kind | Effort | Notes |
|---|---|---|---|
| Tooltips in the app's own look on desktop | Improvement | M | About 60 places use the browser's native `title` tooltip. Replace them with the `Tooltip` primitive styled like the rest of the app (delay, arrow, theme colours, also on keyboard focus), shown only on devices with a mouse. |
| A PIN remembered after a page refresh | Fix | S | The join page keeps the last PIN after a refresh even when that game is not running yet (it stays in the address as `?pin=`). After a refresh the page should start empty, or check the PIN and drop it when no game answers; the QR join link (`/?pin=…`) must keep working. |
| Leaving the host pages through the logo | Fix | S | Clicking the logo (home) while logged in goes to the player join page and does not log the host out. The expected behaviour is still open: the user's note says the logo "does not log me out". |

### From the first family game (27 October 2026)

Picture details and typo tolerance are planned as phases 46 and 47; lock joining, the play-through preview and smoother drag as phases 45, 49 and 48.

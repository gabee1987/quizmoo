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
- Admin pages: a Users page with each account's figures and last login, setting a new password, changing the role, logging out everywhere and deleting an account; a Names page that edits the "Surprise me" names row by row (phase 28).
- My settings in four tabs (Games first), and an Account tab: overview, this device's language and look, password, logging out other logins, deleting the own account (phase 29).
- Legal pages (privacy notice, terms, cookies and storage, imprint), terms accepted at sign-up and recorded, "Download my data", a storage notice, and a security review with every finding fixed (phase 30).
- The host's running-game screen: standings shown midgame (also with answers at the end), a Standings card with "Results so far", names in full, controls that stay in view, "Show answers" for any closed question, a chip and a preview of what everyone sees, a screen lock with a code or the password (phase 35), and closing a game at any point without the podium (phase 31).
- Quiz files: questions written in a spreadsheet anywhere (template with a guide and examples) imported with a row-by-row problem report, and quizzes downloaded as a spreadsheet or a full Quizmoo file with settings and pictures (phase 27).

### Open

| Task | Kind | Effort | Notes |
|---|---|---|---|
| Every member's own answer in team results (after the MVP) | Feature | M | Teams that answer as one keep only the team's answer today: members' votes and suggestions are replaced at the reveal. Keep them (`votes` per team answer), and show on the results page and the phones' review what each member would have answered ("so they can blame each other"). From the 13 October test notes. |
| Estimated game length | Feature | S | How long a quiz will take, from its questions: the sum of the time limits plus a grace time per question for the reveal, the scoreboard, pauses and the host talking (a fixed number of seconds per question, or a share of the total; to decide in the plan). Shown as "about 25 min" in the quiz list, the editor, the new game dialog and the phone lobby's "About the game" (the phones know only the question count today, so the snapshot needs the estimate). Settings that add steps (scoreboard after every question, host-graded text) could raise it. From the 16 October 2026 request. |
| Hosting without an account (after the MVP) | Feature | L | A guest host with a short-lived identity, tighter limits, the terms checkbox, and "Keep my quizzes" to turn it into an account. Design and open questions in [later-guest-hosting.md](later-guest-hosting.md). Requested 20 October 2026. |
| Lock joining | Feature | S | A host switch that closes the lobby to new players (bots or latecomers), found in the phase 30 security review. |
| Rooms with their own admin | Feature | L | Each room (workspace) has an admin; only its members see and edit its quizzes and games. Today every quiz and game belongs to one host account. Needs a rooms table, membership and roles, permission checks on every route and socket attach, migration of existing quizzes. |
| Play-through preview in the editor | Feature | M | The host plays the quiz on a phone-like frame (question, answer, reveal) without starting a game. Reuses the phone screens with a local fake snapshot; no server state. |
| Host live dashboard and hints | Feature | L | One coherent view of the running game: answers in, who is stuck or offline, per-question stats, standings. Hints or messages to selected players (host-to-player messages were out of scope in phase 12). |
| Sounds for key moments | Feature | M | Short playful sounds for important events and messages, switched on per quiz. Generated in the browser (Web Audio) to avoid licensed audio files; projector only, phones silent by default. Same as the "Sounds and music" item above. |

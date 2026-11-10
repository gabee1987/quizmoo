# Feature backlog

Candidate features and fixes not planned yet. Pick the ones wanted and a phase plan is written for each group, in the format of the other plans; finished items move to "Already done". The platform work (reactions, partial credit, PDF certificates, metrics, communities, dashboards, the question bank, sharing, the public library, party games) is planned in [platform-roadmap.md](platform-roadmap.md), phases 58 to 70. Effort is a rough size: S (a day), M (a few days), L (a week or more). Every item keeps the existing rules: nickname only, server-authoritative state, same origin, i18n keys for errors.

## Playing

| Feature | Why | Effort | Notes |
|---|---|---|---|
| Practice mode (self-paced) | Training use, no host needed | L | Different flow: player advances alone, no projector; engine mostly reusable |

## Platform

| Feature | Why | Effort | Notes |
|---|---|---|---|
| Password reset | Host forgot the password | M | The admin can set a new password on the Users page (phase 28); a self-service reset needs e-mail delivery, which is a third-party service (compliance review) |
| Two-factor login for hosts | Security for public deployments | M | TOTP, no SMS |
| Ready-made quizzes from Quizmoo | Friends want to play without writing a quiz first; a varied, good pool gives the platform its own identity | L | Requested 10 November 2026. A curated library of quizzes made by Quizmoo itself (not by users, unlike the public library in phase 66 of [platform-roadmap.md](platform-roadmap.md#66-public-quiz-library), which it can seed). Any host browses it by topic, language, length and audience (family, office, pub), previews a few questions and adds a copy to their quizzes or starts a game from it at once. **Quality rules:** every question is checked against a reliable source (encyclopaedias such as Britannica, official statistics such as KSH and Eurostat, museums, scientific bodies; Wikipedia only through its cited sources), and the source is stored with the question for the editor and shown after the reveal as "Source" where helpful. Questions are written in our own words in both languages, not copied from other quiz sites or books (their wording is copyrighted; facts are not). Avoid facts that go stale (records, "current" office holders) or give them a checked-on date and review them yearly. Pictures only under licences that allow it (own drawings, public domain, CC0 / CC BY with attribution). A first set of perhaps 15–20 quizzes of 15–20 questions across general knowledge, Hungary, geography, science, nature and animals, history, music and film (facts only), food, sport, language, and a kids' set. To decide in the plan: storage (seeded rows owned by a system account, or files in the repository built into the image), versioning and updates of copies already taken, and who reviews new content. |
| Passwordless host login: passkeys and an e-mail code | No passwords to remember, reuse or leak; nothing personal stored | L | Both optional, next to the current username and password (requested 4 November 2026). **Passkeys** (WebAuthn): log in with the device's fingerprint, face or PIN; nothing personal stored, no third-party service, phishing-resistant; several passkeys per account (laptop, phone), added and removed under My settings → Account; a library such as SimpleWebAuthn is a dependency, not a service. **E-mail code**: a host links an address, and the server stores only a keyed hash of it (HMAC-SHA256 with a secret from the environment), never the address. That hash is still pseudonymised personal data under GDPR: the privacy notice says so. Login asks for the address and mails a 6-digit code, not a link, since mail scanners open links and a code works across devices. The code is valid for 10 minutes, works once, is stored hashed and allows few tries; rate limits per IP and per hash; the same answer whether the account exists or not. Sending goes through Brevo, which keeps send logs with the address, so it needs a compliance review (data processing agreement, log retention). Sign-up can verify the address with a code before the admin approves it. To decide in the plan: recovery when a device or mailbox is lost (the admin re-links); whether the first admin and installs without mail or internet (venue LAN) keep passwords; the privacy, terms and cookies texts. **Later, once both are tested thoroughly:** remove username and password logins, or keep them only for the first admin and offline installs. This also covers "Password reset" and most of "Two-factor login" above. Part of phase 69 in [platform-roadmap.md](platform-roadmap.md#69-opening-the-platform). |

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
- Typo tolerance for typed answers: "Accept small typos", near misses marked for host and player (phase 47).
- Seasonal themes: nine seasons with their own colours, decorations, cow costumes and greeting; the Seasonal theme as the default, a per-device switch, and season dates admins can change (phase 50); six season lines for the cow and seasonal podium confetti (phase 51).
- Smoother drag with 200 questions: the rows no longer render again on each move of a drag (phase 48).
- Play-through preview in the editor: "Try it" plays the quiz on the phone preview with the real reveal screen, nothing saved (phase 49).
- Fixes on the What's new page: every release lists what was fixed after its news, the earlier releases included (phase 37); the join page drops a PIN no game answers from the address, and the logo on the host pages leads to the host's home, hosts log in on the front page's Host tab, and its Play / Host switch no longer jumps (1.10.1).
- The phone's end of the game in four pages (standings, answers, facts with awards, the player's own stats), stepped through with buttons, swipes or arrow keys (phase 52).
- The projector's end of the game in five pages (podium with a drum roll, leaderboard, awards, game facts) and a question recap the host opens, moved from the host's Finished card or in automatic mode (phase 53).
- Every text reviewed for one voice, rounds named alike everywhere, the legal pages aligned between the languages (phase 54).
- A 20-question starter quiz for every new host, and a button to add it again (phase 55).
- Tooltips in the app's own bubble instead of the browser's `title`, on hover and keyboard focus (phase 57).
- Tutorial tours on every main host page and in the players' lobby, and a help page for everyone (phase 34).
- Partial credit for multiple choice, chosen per question, with "Partly right" on every screen (phase 59).

### Open

| Task | Kind | Effort | Notes |
|---|---|---|---|
| Rewind to any question, from a game history | Feature | L | A failsafe for technical or human mistakes (a phone dropped out, the wrong answer was marked, the host pressed Next too early): the host can go back to any earlier point of the game and play a question again with no hassle. Today a closed question can only be shown again read-only (`showQuestion`, "Show answers") or skipped; nothing can be replayed or undone. Idea: keep a history of the game state at each question's start (the state is already a plain, persisted value, saved on every transition), and a host command that restores the game to the start of question N, taking back the points, answers and streaks given from there on. To decide in the plan: rewind the whole game to that point or replay one question and keep the later ones; what players who joined, left or changed teams since keep; how the phones and the projector show a rewind; a confirmation and an undo of the rewind itself; how much history to keep and for how long (data minimisation: answers only, deleted with the game). Requested 3 November 2026. |
| Every member's own answer in team results (after the MVP) | Feature | M | Teams that answer as one keep only the team's answer today: members' votes and suggestions are replaced at the reveal. Keep them (`votes` per team answer), and show on the results page and the phones' review what each member would have answered ("so they can blame each other"). From the 13 October test notes. |
| Hosting without an account (after the MVP) | Feature | L | A guest host with a short-lived identity, tighter limits, the terms checkbox, and "Keep my quizzes" to turn it into an account. Design and open questions in [later-guest-hosting.md](later-guest-hosting.md). Requested 20 October 2026. |
| Rooms with their own admin | Feature | L | Planned as phase 62 in [platform-roadmap.md](platform-roadmap.md#62-communities-separate-spaces-with-their-own-owner). Each room (workspace) has an admin; only its members see and edit its quizzes and games. Today every quiz and game belongs to one host account. Needs a rooms table, membership and roles, permission checks on every route and socket attach, migration of existing quizzes. |
| Who else is here: a player list on the phone's waiting screen | Feature | S | While players wait in the lobby, an expandable list shows everyone who has joined, with name and avatar (grouped by team in team mode), so players can see each other. Today the phone shows only a player-count chip, plus the player's own team card in team mode. Collapsed by default under the count, so the waiting screen stays calm on a small phone; it updates live from the snapshot (`snapshot.players` already holds names and avatars, so nothing new is sent or stored). The emoji reactions of phase 58 go here as well: the reaction bar sits with the list, and a reaction can float from the sender's row. Build after or together with [phase 58](phase-58-player-reactions.md). Requested 5 November 2026. |
| Hints to selected players | Feature | M | Messages or hints to chosen players instead of everyone (host-to-player messages were out of scope in phase 12). The live view of the running game itself was done in phase 43; a tile on the board could be where the host picks the players. |
| Sounds for key moments | Feature | M | Short playful sounds for important events and messages, switched on per quiz. Generated in the browser (Web Audio) to avoid licensed audio files; projector only, phones silent by default. Opt-in on the projector only; licensed music files would need their own review. |

### From the first production test (24 October 2026)

Collected while testing the Railway deployment. The help page and tutorial (phase 34), default time and points (phase 38, done in phase 42) and the estimated game length (phase 41) were asked for again; their rows above carry the new details. The switch, the search, the add buttons, the jump and the title field were done in phase 42.

| Task | Kind | Effort | Notes |
|---|---|---|---|


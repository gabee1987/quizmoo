# Changelog

## Unreleased

### New name
- The app is now called Quizmoo, with a cow as its logo (in the header and as the browser tab icon).
- Hosts are logged out once after the update, and phones forget their saved language, colour mode and game once.

### Design
- New design system: shadcn/ui components on Radix, design tokens for colours, radii and shadows, the Nunito font (served by the app itself), icons.
- Light, dark and system colour mode on every screen, chosen per device and remembered, applied before the page is drawn (no flash).
- Four game themes (Classic, Arcade, Sunset, Mint), set per quiz and overridable per game; phones, the projector and the host control follow the game's theme.
- New layout for hosts: sidebar on laptops, bottom tab bar on phones; restyled login, quiz list (cards), game history (table on laptops, cards on phones), results, users, password, editor forms and host control.
- Errors from the server that no form field causes are shown as toasts.
- Accessibility: visible focus rings, contrast checked automatically in both modes, reduced-motion setting respected.

### Game screens
- Motion everywhere players and the audience look: buttons lift and sink, a soft colour backdrop drifts behind every page, questions and answers pop in, the timer is a ring, points count up, the reveal bars grow, the scoreboard shows who moved up or down, the podium rises third, second, first with confetti.
- Join page: one box per PIN digit (typing, pasting and SMS-style autofill all work), and a camera button that reads the projector's QR code inside the app (over HTTPS).
- Answer colours and symbols are game settings: four palettes (Vivid, Candy, Neon, Earth) and four symbol sets (shapes, letters, numbers, icons), independent of the theme so answers stand out from the background. New quizzes get coloured answer buttons on phones by default; quizzes saved before the answer style existed now get them too.
- Four more themes: Ocean, Berry, Forest and Graphite (a nearly neutral one for formal events).
- Projector: the reveal shows the question's image, the correct answer in its colour, the bars and the figures in one layout; the podium adds a crown, confetti and the runners-up; the results summary has on-screen arrows and a progress bar; a projector opened by the host shows the next step as a button next to the keyboard shortcut.
- Phones: rank change arrows on the reveal and the scoreboard, a "Well played" card for everyone outside the top three.
- Results page: each question's image next to its statistics.
- Editor: the phone preview renders in the quiz's theme and palette and shows a sample question when none is selected, so every visual setting is previewed at once.

### Quiz editor
- New layout: the question list, the question being edited and the phone preview side by side on a laptop, with the quiz title, save state and Play in a top bar; on phones the list opens from a bar at the bottom and the preview behind a button. Description and game settings moved into a "Quiz settings" panel.
- Questions and answer options are reordered by dragging: with the mouse, by pressing and holding on a touch screen, or with the keyboard (Space, arrows, Space). Move up and down stay as buttons; move to top or bottom is in the question's menu.
- Adding a question shows the types as cards and inserts the new one after the current question. Duplicating needs no confirmation, and deleting needs none either: an "Undo" in the notification brings the question back in place for 10 seconds.
- Option rows show the colour and symbol the option gets in the game, a large "Correct" toggle, and Enter jumps to the next option or adds one.
- Images can be dropped or pasted (a screenshot pasted anywhere in the editor becomes the question's image), with an upload progress bar and a "Replace" button.
- Problems are listed under "N to fix" in the top bar, each taking you to its field, and marked with a red dot in the list; Play explains why it is disabled.
- Saving tells the truth: saved, saving, offline (sent automatically once the connection is back) or failed (with a retry button). Leaving the editor with changes that cannot be saved asks first.
- Keyboard shortcuts: Ctrl+D duplicate, Ctrl+Enter add, Alt+Up/Down move, "?" for the list. They never fire while typing in a field.
- Quiz list: search by title, sort by last edited or title; a duplicated quiz opens straight in the editor.
- The top bar stays in view while scrolling (tablets and laptops). On a laptop the quiz settings open beside the question and the phone preview instead of over them, so theme and colour choices are previewed as they are made.
- Drop-down lists (time limit, points, sorting) have the app's own look instead of the browser's.
- A quiz can be deleted from the editor too (at the bottom of the quiz settings).
- Quiz list: "Select" turns the cards into a selection. The selected quizzes can be deleted together, or given the same look, scoring, game flow, or time limit and points for every question; groups that are not ticked keep each quiz's own settings.

### Look and feel
- Opening the quiz settings on a laptop is animated: the question list slides out to the left, the question narrows and the settings slide in from the right with a soft spring; closing plays it backwards.
- Scrollbars in the app's style: a rounded thumb in the theme colour that grows under the pointer.
- Notifications and host messages share one design: rounded bubbles with a pressed edge in the message's colour (green for done, red for errors, amber for warnings, the theme colour for information and host messages), springing in with a small bounce, with a round icon that pops in. Error icons shake, the host's megaphone toots, and the Undo button is chunky. A host message falls in from the top of the screen like bubble gum (splat, stretch, wobble) and, when cleared, winds up, wobbles and flies back up off the screen; it never grows past the screen edge, and the content below glides down and back up with it instead of jumping. The host's message box previews the banner exactly as phones see it.
- Springy details: focus rings, switch thumbs (which stretch while held), check marks, dialogs, side panels and menus.
- Every button, menu item and choice card gives a short elastic "bubble gum" wobble when pressed; icons in buttons tilt on hover, choice cards lift, menus spring open, quiz cards fade in one after the other. Reduced-motion settings switch all of it off.
- Four subdued themes for formal company events (Navy, Petrol, Stone, Bordeaux, next to Graphite) and two calmer answer colour sets (Muted, Corporate).
- The results summary on the projector can be paused (button or P), so it no longer has to move on by itself.

### Connection and host messages
- The connection bar shows how long the connection has been gone ("Reconnecting… 12 s", or "No network" when the device itself is offline), and a short "Reconnected" message appears once it is back. The page reconnects at once when the network returns or the phone is unlocked.
- An answer tapped during a connection drop is sent as soon as the phone is back in the game, retried once if the server's reply was lost, and stays marked as sending until then. If it still cannot be delivered while the question is open, the player is told to tap again; it is never lost silently.
- Host buttons pressed while the host's own connection is coming back wait for it and then go through; before, they could be rejected.
- Phones can no longer show an older state over a newer one after a reconnect: every update is numbered and an older one is ignored.
- Host control: each player shows how long they have been offline, the header shows "connected / total" and the round-trip time to the server (green, amber, red), and a hint appears next to Start or Next question when more than a fifth of the players are reconnecting.
- Host messages: "Get ready!", "Short break", "Last question!" or any text up to 200 characters, shown as a banner on every phone and the projector until the host clears it or the next question starts. Reloaded phones and a restarted server keep it.

### Play features
- Streak bonus (a game setting, off by default): correct answers in a row earn +100 from the second, up to +500. Phones show "3 in a row +200" on the reveal; the host's standings show the streak.
- New question type "Put in order": the editor's order is the correct one, phones get the items shuffled and sort them by dragging or with arrow buttons; scored all or nothing; the reveal shows the correct order and how many players put each item in its place.
- Avatars: players pick an animal when joining (a random one is preselected); it shows next to their name in the lobby, on the scoreboard, the podium, the host control and the results.
- Offensive names are refused on the join page with a polite message.
- Host control: while a question runs, the host sees it as the players do (image, text, timer) with the correct answer, the answers so far as live bars, and who has not answered yet.
- Ordering questions on phones: an item is dragged from anywhere on it, at once (no press and hold), and the list no longer replays its entrance animation after a drop.
- Join page: an OK button under the PIN closes the phone's keyboard. The avatar opens into 60 emoji in four groups (animals, food, fantasy, fun). "Surprise me" picks a whole silly name from a list admins edit on the new Names page (one list per language), never one already taken in the game.
- Play again: after a game the host starts a new round of the same quiz with the same settings; phones get "Join the next round" (one tap, same name, avatar and team) and the projector switches to the new lobby by itself.

### Host control
- Pause and Resume during a question: the clock stops on the host control, the projector and every phone ("Paused"), and nobody can answer until the host resumes. The time left and the speed points stay as they were before the pause. Space on the projector resumes, and a server restart keeps the game paused.
- Host messages can disappear by themselves after 10 s, 30 s or 60 s. The message itself shows the time left as a striped bar that drains on every phone, the projector and the host's preview, and turns warm and wobbles near the end. "Until cleared" stays the default.
- Join page: only the PIN is asked first. The name, avatar and team appear once the PIN has found the game (with the quiz's title), and the phone's keyboard closes by itself after the last digit.
- Show again: between questions the host can put any question already played back on the projector and the phones (from "Questions so far" in the review panel) to talk it through. Each phone shows its own result on it; scores and ranks do not change. "Back to the game" returns to where the game was.
- After the podium is shown, the host control says it is on the projector and has an "Open projector" button. Opening the projector again brings up the window that is already open instead of opening a second one.

### Phone and results screens
- Phones in a game have the whole screen: no header; the language and light or dark mode are in a small round menu button in the top right corner.
- A question with an image shows the image and every answer together without scrolling: the image shrinks to the space the answers leave.
- The end-of-game review on phones is one card per question, open at first: the question as a large heading, then a chip in the result's colour ("Correct! +900", "Not this time", "Voted", "No answer"). The whole card takes that colour (border, pressed edge, a coloured band behind the title and a light tint below), and your answer and the correct one follow on separate lines. Each card folds away with its arrow.
- The results page starts with a summary: the podium, number of players and questions, the average share of right answers, the average answer time, and the easiest and hardest question. Players and questions follow in two tabs.
- Host control between questions: a panel about the question on the screens says what they show (answers revealed, the scoreboard after it, or shown again) and gives the question's type, time and points, its image, the correct answer, how many answered and were right, the average time, the fastest right answer, the answer bars and who did not answer.
- The new game dialog shows the settings in three groups (game flow, look, scoring) with short summaries. "Change" opens one group; a group changed for this game is marked and can be reset to the quiz's settings.

### Change answers
- New game setting "Change answers" (scoring group, off by default): players can change their answer while the question runs, and the last one counts, with its time for the speed bonus.
- An optional lock-in stops changes 5 or 10 seconds before the end; a player who has not answered yet can still answer until the time is up.
- On the phone, the answered view offers "Change answer" with the seconds left; changing shows the question again with the previous answer selected, and "Keep it" goes back.

### Team answers
- New team mode settings: how teams answer ("Everyone answers" as before, "Majority vote" or "One shared answer") and "Teams choose their mode", which lets each team's captain pick in the lobby.
- Every team has a captain: the first to join, shown with a crown. The captain can pass it on, the host can give it to anyone, and if the captain's phone drops, the earliest teammate online takes over.
- Majority vote: the answer most members gave counts for the whole team (a tie goes to the first answer, number questions take the median). Members see the team's votes live.
- One shared answer: any member sets the team's answer and anyone can change it; everyone sees who picked what.
- Teams that answer as one score their answer once; the projector and host count teams, the host sees each team's answer live, and the results page and CSV list the team answers.

### Host lobby
- While players join, the host control is one layout around the QR code: the QR code, the PIN in big digits, the join link and "Open projector" in one card, with Start and the players next to it.
- Players appear as avatar tiles that pop in, grouped by team in team mode; offline players show a dashed tile and how long they have been away; each tile has a small remove button.
- The standings table of zeros is gone from the lobby, and "End game" moved to the bottom.

### Home screen
- The join and login pages open with the cow and the Quizmoo name big and centre stage, with a short tagline; on laptops the cow is on the left and the form on the right.
- The cow bobs, blinks and flicks its ears, the name's letters drop in, and answer shapes float around the edges. Tap the cow and it jumps and says something ("Moo!" and three more lines).
- The Hungarian texts are rewritten across the app in a friendly, informal tone ("Csatlakozz!" instead of "Csatlakozás a játékhoz"), hosts and editors included.
- The pages stay as fast as before: no new downloads, every animation runs on the graphics thread, nothing jumps while loading, and everything stands still with reduced motion.

### Fixes
- The selected answer on phones (colourful buttons) is marked inside the option, in its text colour, instead of with a ring that reached into the neighbouring answers.
- The quiz editor no longer shows two scrollbars when the quiz settings are open beside a short question.
- Rate limiting applies to API requests only. Static files were counted too, so many phones sharing one public IP (venue wifi with a cloud deployment) could get errors and a blank page while loading the app.

## 1.0.0 – 2026-10-07

First release.

### Playing
- Players join with a QR code or a 6-digit PIN and a nickname; up to 60 players per game.
- Question types: single and multiple choice, true/false, free text (automatic or host-graded), number with tolerance, poll; optional images.
- Individual and team mode; speed bonus; shuffled options.
- Reconnect and page reload keep the player's identity and score.
- Projector screen with QR code, live answer count, answer distribution, scoreboard and podium.

### Hosting
- Quiz editor with autosave, validation, phone preview and image upload.
- Game settings per quiz, overridable per game: when correct answers and the scoreboard are shown, answer button style, final results released by the host (projector and phones separately).
- Host control for laptop and phone: next question, scoreboard, +30 s, skip, end, remove player, grade free-text answers.
- Game history, results page (podium, per-question statistics, sortable player and team tables), CSV export for Excel, results summary on the projector.
- User management for administrators.

### Operations
- One Docker image (API, realtime and web app on one origin) with PostgreSQL; migrations run on start.
- Every game transition is persisted; a restart resumes running games.
- Graceful shutdown on SIGTERM; `/api/health` with database status and running game count.
- Automatic deletion of finished games after the retention period (default 90 days).
- Security headers and Content Security Policy, request size limits, rate-limited login.
- Load test (60 players, 20% reconnecting) and browser end-to-end test, both in the repository; the end-to-end test runs in CI against the Docker image.

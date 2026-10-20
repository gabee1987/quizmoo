# Changelog

## Unreleased

### Hosted beta
- Privacy page (`/privacy`, Hungarian and English), linked from the join and login pages: what is stored, for how long, cookies, where it runs, and whom to ask, with the operator's name and e-mail from `OPERATOR_NAME` and `OPERATOR_EMAIL`.
- Hosts can sign up on `/register` when `REGISTRATION_OPEN=true`: the account waits until an admin approves or rejects it under "Waiting for approval" on the Users page. Username and password only, no e-mail; unapproved sign-ups are deleted after 7 days.
- A Feedback item in the host navigation when `FEEDBACK_URL` is set, and a feedback issue form in the repository.
- Proxies are trusted only when `TRUST_PROXY` is set, and then exactly that many, so a client can no longer fake its address to get round the login limit. Request logs no longer contain IP addresses.
- `scripts/smoke.mjs` checks a deployed address end to end; `railway.json` sets the build and health check; `docs/deploy.md` describes Railway first, with releases, rollback, backups and a restore drill.

### Admin pages
- The admin pages (Users, Names) have their own "Admin" group in the sidebar, and an "Admin" heading in the phone's Account menu.
- The Users page shows a card per account: role, when it joined and last logged in, its quizzes, games played, players reached, active games, images and their size, and active logins. A search finds an account by name; sign-ups waiting for approval stay on top.
- Admins can set a new password for an account (it must be changed at the next login, and every login of it ends), make it an admin or a host, log it out everywhere, and delete it with everything it owns after typing its name. None of these works on the admin's own account, so there is always an admin left. Deleting a host ends their running games first.
- The last login time is stored for each account (shown to admins only, deleted with the account); the privacy page says so. After updating, run `pnpm --filter @quizmoo/server db:migrate` (production deploys migrate on start).
- The Names page edits the "Surprise me" names one by one: each row shows the avatar the name gets, names are added one at a time or as a pasted list (duplicates skipped), renamed and removed in place, and a name the join would refuse is marked at once. A search, a name count per language, and the same unsaved changes bar as My settings.

### My settings
- My settings is split into four tabs, Games first: Games, Messages, Branding, Account. The open tab is in the address, and a dot marks each tab with unsaved changes.
- The Account tab shows your username, role, when you joined and last logged in; sets this device's language and light or dark look; changes the password; logs out every other login; and deletes the account with all its quizzes, games, results and images after asking for the password again. The only admin cannot delete their own account.

### Legal pages and data rights
- A full privacy notice (what, why, legal basis, how long, who else, your rights, complaints to NAIH), terms of use, a cookies and storage page listing everything the browser keeps, and an imprint, in Hungarian and English, linked from the join, login and sign-up pages and the host navigation. The hosting provider is named with the new `HOSTING_PROVIDER` setting.
- Signing up needs the box "I'm 16 or older, I accept the terms of use and I've read the privacy notice"; the accepted version and time are stored. Accounts made by an admin, existing accounts, and everyone after a terms change accept the terms at their next login; until then they can only download their data, delete the account or log out. After updating, run `pnpm --filter @quizmoo/server db:migrate` (production deploys migrate on start).
- "Download my data" on My settings → Account: one JSON file with the account, settings, quizzes, image list and games with results.
- The Quizmoo logo in the header links to the join page, so the legal pages have a way back.
- A calm one-time note on the first visit that only necessary things are stored, with a link to the details. The join page says the nickname is shown to everyone in the game.

### Security
- Fixed: rate limits could be skipped with a percent-encoded path. Database errors are logged without their values, and request logs without query strings.
- Wrong game PINs are limited per network address; a host's browser loses control of running games as soon as its login ends; images over 50 megapixels are refused; a host can have at most 20 open games and 1,000 images.
- Unused images, expired logins and games nobody finished are cleaned up daily; old player seats are removed from the browser after two days.
- Over HTTPS the session cookie is `__Host-quizmoo_session` (everyone logs in once again after this update); production sockets accept only the app's own pages; production behind a proxy refuses to start without an https `APP_ORIGIN`; a Permissions-Policy header; the local Postgres in `docker-compose.yml` listens on this computer only.

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
- Teams choose how they answer by default: in the lobby each team's captain picks "Captain decides" (the default), "Majority vote" or "Everyone counts" (the average, as before). A team of one gets no picker. The host can instead set "Same for all teams" with one mode, and can change a team's mode in the lobby or between questions, from the next question on.
- Every team has a captain: the first to join, shown with a crown. The captain can pass it on, the host can give it to anyone, and if the captain's phone drops, the earliest teammate online takes over, also during a question.
- Captain decides: everyone suggests an answer and can change it until the captain confirms; the captain sees the suggestions and confirms one (or a teammate's from the list). If nobody confirms by the end, the team's majority counts and the phones say so; the host's reveal and the results mark it.
- Majority vote: the answer most members gave counts for the whole team (a tie goes to the first answer, number questions take the median).
- On the phones, teammates' picks show live as avatars on the options (three, then "+N"), and "Team picks" lists everyone with their answer or "thinking…". Other teams see nothing of it.
- Teams that answer as one score their answer once; the projector and host count teams, the host sees each team's answer and whether it is confirmed, and the results page and CSV list the team answers.
- Games and quizzes saved with the earlier "One shared answer" mode play as "Captain decides".

### Small improvements
- The selected answer stands out on every answer colour, palette and theme: a ring in the theme's colour around the option and a round check badge, in light and dark mode.
- A team of one in "Captain decides" just answers: no confirmation, no captain note.
- The end-of-game review on the phones says "Your team's answer" for team answers, and when the captain did not confirm.
- Quizmoo can be installed as an app (home screen icon, opens like an app). The service worker keeps only the app's own files; games, the API and images always come from the server. A page a phone has opened still loads without the network and shows "Connection lost".
- The admin's names page no longer nests a list inside a paragraph.
- The new game dialog is much bigger: the setting groups are tabs on the left with their summaries, the whole group's settings on the right, and Create game always in view; on a phone it fills the screen.
- A "Custom" theme with the host's own colours: a colour wheel for the main and the accent colour and a colour strength from muted to vivid. Text stays readable in light and dark mode whatever is picked.
- The custom theme shows a small lobby card in its colours, so the accent colour's effect is visible while picking, and the colour strength goes down to black and white.
- "Custom" answer colours: any colour per answer, black and white included; the text on each answer is white or dark, whichever reads better.
- The quiz editor's settings panel takes the whole width beside the phone preview (the question form folds away while it is open) and shows the settings in two columns.
- Games can be scheduled up to 30 days ahead ("Later" in the new game dialog): the PIN and the join link are reserved at once to share, the join page shows when the game starts, and joining opens at that time. The host can open it early, move the time or call it off; scheduled games come first in the games list. The host still presses Start.
- "Copy link" in the host lobby.
- While waiting for a scheduled game, players can fill in their name, avatar and team ahead; a reload keeps the PIN and their details, "Leave" goes back to an empty join page, and "Add to calendar" saves the game as a calendar event (an .ics file made in the browser, with the PIN, the join link and a reminder 10 minutes before). The host's scheduled card has the same button.
- Join page scrolling on phones: tapping the PIN boxes brings the join card to the top of the screen, and once the game is found the page settles with the Quizmoo name at the top.
- The start time is picked on the app's own calendar: a month grid that bubbles open with the same wobble as the buttons, hours and minutes in 24-hour style, all usable with the keyboard.

### My settings
- Every host account has a My settings page (in the navigation, where "Change password" was): quick messages, game defaults and the password change.
- Quick messages are one list of up to 25: the built-in ones (in the app's language until their text is edited) and the host's own. Any of them can be edited, removed, timed (until cleared, 10, 30 or 60 s, or any 5 to 600 s) and reordered by dragging, with the keyboard or with the arrows; removed built-in ones can be brought back. One click in the message box sends a message with its own time, unless a time (now also a custom number of seconds) is picked first.
- A game keeps the quick messages it was created with, also through a restart. "Save" next to Send adds the typed message to the host's messages and to the running game at once; "Edit" changes a quick message's time or takes it out of this game only.
- Game defaults: new quizzes start with the host's usual game settings instead of the app's.
- The settings are stored per host account, reachable only by that host, and deleted with the account.
- Motion: the sidebar's highlight springs to the chosen page, toasts are as wide as the page's panels and bubble in and out, rows moved with the arrows or shortcuts slide past each other (quick messages, the editor's question list, the ordering question), tab panels, rows and the unsaved changes bar animate in and out instead of blinking, and panels spring to their new height. The settings tabs are bigger and coloured, and the unsaved changes bar stands apart from the page under it.
- The quiz editor's settings on a phone use the full width, with a one-line summary in the header and the same space on both sides when a scrollbar shows.
- Password fields (login, password change, new users) have an eye button on the right that shows the characters.
- The new game dialog on a phone gives the settings about a third more height: a one-row header, and Now / Later next to Create game in one row (the X closes it). Its groups are pill tabs with icons like on My settings (the open one filled, on laptops too), a group changed for this game gets a dot, Now / Later is one sliding pill, and the custom colours' explanations open from an info button.
- Joyful controls everywhere: dialog and sheet close buttons are round chunky buttons whose X turns on hover; switches sit on the primary edge with a springing thumb and a check; a radio's dot springs in when chosen and shrinks away quietly; pressing something that turns a choice off gets a soft dip instead of the wobble.
- Game settings that come and go (team settings, the custom colours, the answer lock, help lines, the "Changed for this game" bar, the start time for Later) open and close smoothly, and what is below slides along instead of jumping.
- Phones and tablets keep their own scrollbars (thin, hidden while not scrolling, taking no space); the styled scrollbar is for mouse devices.
- Hosts land on a home page after logging in: a greeting, their figures (quizzes, games played, players), running games with "Back to the game", scheduled games, the recently edited quizzes with Play and the latest results. The quiz list moved to `/host/quizzes`; "Home" is the first item in the navigation, and on phones the admin pages (Users, Names) are in the Account menu.
- Branding: a host uploads a logo and sets an event name on My settings. The new game dialog (Look) starts with the last event name used and has "Show my branding" and "Also on the phones"; the projector's lobby and podium then show the logo and the name, and the phones' lobby too when chosen. A game keeps its branding through a restart and in "Play again"; a logo can only be the host's own image and is deleted with the account.
- Each quiz can have its own branding in its settings: a logo and an event name that replace the ones from My settings (left empty, My settings is used), or branding turned off, so its games show no logo or event name on the projector or the phones unless the host turns it on in the new game dialog.
- The editor's quiz settings are split into tabs (General, Game flow, Look, Scoring, Branding), so only one group shows at a time.

### Flexible teams
- Teams are set up for each game in the new game dialog, not in the quiz: "Who makes the teams" is the host ("I set the teams", as before), the players, or both. The quiz editor, My settings and the batch edit no longer have team names; a quiz's saved names prefill the dialog.
- Players can create a team on the join page ("New team" with a name; the creator is its captain), or join one from the list, which shows how many have joined. Team names are required, unique and pass the name filter; a game has at most 30 teams. A player alone plays as a team of one.
- The host adds, renames and removes teams in the lobby, and moves players between teams by dragging a tile (mouse, or a long press on touch) or with "Move" (touch and keyboard), in the lobby and between questions. Points earned stay with the old team. Players of a removed team pick another one on their phones; the game starts once everyone has a team. A team a player created goes when its last member leaves the lobby.
- "Players can join late" (off by default): latecomers join a running game and answer from the current question on.
- The captaincy can be passed at any point of the game: by the captain from the phone's menu, or by the host with the crown, also during a question (the new captain confirms at once).
- "Play again" keeps the teams, so phones rejoin theirs.
- The host's message stays pinned to the top of the phone while the player scrolls (long questions, the end-of-game review), as wide as a toast.
- Phones say what happened to their team: "The host moved you to …", "… joined your team", "You're the captain of … now", and to the old captain who the new one is.
- Once a whole team has its answer, its phones show what the team sent instead of only "Answer sent": the team's answer (with who confirmed it, or how many votes it had) and every member's pick; in "Everyone counts", that everyone has answered, with the picks. The reveal shows the same (also when correct answers are held back until the end), since the question closes as soon as every team has answered.
- Team-mode lobby tiles are rows with a small avatar and the whole name; make captain, move and remove are in one menu per player.
- The phone lobby shows the game PIN in big digits with "Copy PIN" (also over plain http on the venue wifi), and the phone's round menu keeps it (with the quiz title) at hand for the whole game, so players can tell others where to join.
- The phone lobby says what the game is like: the quiz, how many questions, how players score (on their own, in teams, teams and solo players), and the rules that are on (speed bonus, streak bonus, answer changes, answers revealed at the end, late joining).
- A player answering alone (classic, a team of one, a solo player) sees what they sent instead of only a check: the answer in its button colours and symbols, how long it took and which question it was.
- Mixed play: with "Players may play on their own" (new game dialog, off by default) the join page also offers "On my own". Solo players answer for themselves and are ranked with the teams by their own points on the scoreboard, the podium and the results ("Teams and solo players"), shown with their avatar; the results and the CSV mark them "On their own". The host lobby groups them under "On their own"; the host moves players between a team and playing alone (drag, the player's menu, or "Move" between questions), and their solo points wait for them when they come back.

### Player and host polish
- The phone's round menu is touch-sized (every row at least 48 px, larger text, wider), shows who the player joined as (avatar, name, team) and has "Leave game" with a confirmation. In the lobby the player is removed; once the game runs they stay in the standings and results with their points, the host sees "Left the game", the question no longer waits for them, and the phone cannot rejoin as the same player.
- Teammates who are offline show as "offline" on the team card and in "Team picks" (a dashed chip and a faded avatar), and a teammate who left as "left"; neither is "thinking…" any more.
- "Team picks" stays open on the next questions once opened (remembered per game in that tab).
- The player's own answer stays in view until the next question instead of a bare "Answer sent!": a team member's pick or vote before the team is done (with the teammates' picks below), the kept answer when results are held back until the end, and in the reveal when the answer was not the correct one (or a poll vote, or waiting for grading).
- Confirmation dialogs on phones have full-size buttons (they were squashed to half height).
- Players can swipe a host message away (left or right) or close it with ×, on their own phone only; it stays hidden after a reload. A swiped message just flies off; one closed with × wobbles out as before. The host can send a message as "Important" (a switch in the message box, off by default; a quick message can be set to always go out as important in My settings), and important messages cannot be hidden.
- Every toast can be swiped away sideways too.
- The phone's round menu button moved to the bottom left corner, in reach of a thumb, and opens upwards; messages and toasts at the top are full width again and never under it.
- A message or toast wobbling out is no longer cut off at the bottom.
- On a laptop or desktop the waiting screen has its own two-column layout: who the player is and the PIN on the left, the team and what the game is like on the right (its rules side by side), instead of the phone's narrow column.
- The phone lobby puts the team first: a big banner in the game's colour with the team's name (or "You're playing on your own"), then that the game is about to start and how many have joined, then the PIN, the team members with their count, and what the game is like.
- The host's lobby in a classic game lists players as rows with the whole name (on up to two lines), two to a column on a laptop, instead of narrow tiles that cut names off.
- The host gets a short note when players join, go offline, come back, leave or are removed. Many at once become one note ("12 players joined"), and a player who drops and is back within a second or two shows nothing. A bell next to the connection badge turns these notes off on that browser.
- "Running now" on the host's home lists unfinished games of the last 12 hours, the same games the server keeps running after a restart.
- "Surprise me" has about 180 built-in names per language, written separately for Hungarian and English players instead of translated (wordplay, films, cartoons, history and memes each audience knows), and gives the avatar that fits the name ("Pattogó Pingvin" gets the penguin). Names an admin adds on the Names page get their avatar from a word in the name (penguin, pingvin…), else a random one.

### Game history
- The game history loads 30 games at a time, more as you scroll down (or with "Load more"), so it stays quick with hundreds of games.
- Search by quiz title or a player's name, without minding capitals or accents ("karacsony" finds "Karácsony kvíz"), or by PIN; a game found by a player says who. The search starts from the third character. Filter running or finished games and the last day, 7 or 30 days. The search stays in the address, so a reload or a shared link keeps it.
- New results page: the game's PIN, date and length, the figures and the actions in one header card, Delete included; the winner large (the best player too in team mode) with second and third; the easiest and hardest question; players, teams and questions in large tabs, medals for the top three. Laid out for laptops and phones.
- The sidebar keeps the current page highlighted when the game history has a search.
- Games are listed by when they start, so scheduled games are at the top.
- Each host keeps at most 200 finished games (`MAX_GAMES_PER_HOST`); finishing one more deletes the oldest. Running and scheduled games never count. The 90-day limit stays, and the page says both.
- After updating, run `pnpm --filter @quizmoo/server db:migrate` (production deploys migrate on start).

### Quiz files
- Write questions without the app, in Excel, LibreOffice, Google Sheets or a notes app on the phone, and import them: Quizzes > Import takes a spreadsheet (CSV) with one question per row, every question type included.
- "Download template" gives a spreadsheet that explains every column in its first rows and has an example of each question type, in the app's language (Hungarian files use `;` and decimal commas, as Hungarian Excel expects). Type words work in either language, with or without accents.
- A broken spreadsheet is not imported: the dialog lists each problem with its row and column and what to write there.
- Any quiz can be downloaded as a spreadsheet (questions only) or as a Quizmoo file (`.quizmoo.json`) with every setting and picture, from the quiz list's menu and from the editor; a Quizmoo file imports as a full copy, on another install too. The format is described in `docs/quiz-files.md`.

### Development
- The web dev server runs on port 15173, away from the 5173+ ports other local Vite projects take.
- CI runs typecheck, tests and build only; the end-to-end suite runs locally before each pull request.

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

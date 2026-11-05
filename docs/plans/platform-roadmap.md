# From quiz app to platform: roadmap

Status: draft, 5 November 2026. Version 1.12.0 is the MVP: one host account runs its own quizzes for one event at a time. This roadmap takes Quizmoo towards a community platform: hosts create quizzes and questions, share them within their own community or publicly, and anyone can pick one and host it.

Each phase below is a draft plan: goal, scope, a design sketch, the decisions still open and the compliance points. Before a phase starts, `implement-phase` turns its section into a full plan file (`phase-<N>-<slug>.md`, with Files, Steps, Done when, Verification command and Manual test list) and the open decisions are settled with the user. Effort: S (a day), M (a few days), L (a week or more).

## Principles that stay

- Players remain anonymous: a nickname and an avatar, nothing else. The platform adds accounts for creators, never for players.
- The server stays authoritative and every game transition is persisted.
- No third-party service without a compliance review first (GDPR, NIS2, ISO 27001). Libraries that run inside the app (PDF, adapters) are dependencies, not services; each new one is still named in its plan.
- **Separation by design:** a community's quizzes, questions and games belong to that community. The platform operator (today's "admin") runs the platform, but the app gives the operator no screen or endpoint that shows a community's private content. The only exception is public content that someone has reported.
- Data minimisation: metrics and dashboards show counts and aggregates, never individual players.

## Order and dependencies

| Phase | Title | Track | Effort | Depends on |
|---|---|---|---|---|
| 58 | [Player reactions](#58-player-reactions) | Game | M | - |
| 59 | [Partial credit for multiple choice](#59-partial-credit-for-multiple-choice) | Game | M | - |
| 60 | [Certificates and a results report as PDF](#60-certificates-and-a-results-report-as-pdf) | Game | M | - |
| 61 | [Platform metrics and statistics](#61-platform-metrics-and-statistics) | Platform | M | - |
| 62 | [Communities: separate spaces with their own owner](#62-communities-separate-spaces-with-their-own-owner) | Platform | L | - |
| 63 | [Community dashboard](#63-community-dashboard) | Platform | M | 61, 62 |
| 64 | [Question bank and share codes](#64-question-bank-and-share-codes) | Sharing | L | - (per user first; community banks after 62) |
| 65 | [Editing quizzes together](#65-editing-quizzes-together) | Sharing | M | 62 |
| 66 | [Public quiz library](#66-public-quiz-library) | Sharing | L | 62, 65 |
| 67 | [Party games: a section next to quizzes](#67-party-games-a-section-next-to-quizzes) | Game | L | - |
| 68 | [More party games](#68-more-party-games) | Game | M each | 67 |
| 69 | [Opening the platform](#69-opening-the-platform) | Platform | L | 62, 66 |
| 70 | [More than one server process](#70-more-than-one-server-process) | Platform | L | before heavy public use |

58 to 61 and 64 are independent of the platform work and can ship as 1.x releases whenever they are ready. They now have full plans (5 November 2026), built in this order: [59](phase-59-partial-credit.md), [64](phase-64-question-bank.md), [58](phase-58-player-reactions.md), [60](phase-60-certificates.md), [61](phase-61-metrics.md). Where a plan file and a section below differ, the plan file wins. 62 is the turning point: it changes who owns what, so it goes before sharing within communities and the public library. The public library (66) together with opening the platform (69) would be a good point for **2.0.0**.

The open backlog items stay where they are ([backlog.md](backlog.md)). Two of them tie in here: "Rooms with their own admin" becomes phase 62, and "Passwordless host login" becomes part of 69.

---

## 58. Player reactions

**Goal:** players send a quick emoji reaction that everyone sees, without it turning into spam or getting in the way of answering.

**Scope**
- A fixed set of six reactions, for example 👏 😂 😮 🔥 ❤️ 🐮. Not free text, so there is nothing to moderate.
- Allowed in the lobby, reveal, scoreboard, between questions and on the end pages. **Not while a question runs**, so nobody is distracted while answering (the main protection against being intrusive).
- On the projector, reactions float up from the bottom edge, away from the question and the bars. On phones, a small ambient float in a corner, which a player can switch off in the game menu.
- The host can switch reactions off per game (a game setting, on by default) and mute them at any moment from the running game's page.

**Spam protection**
- On the phone: a tap gives a short cooldown on the reaction bar (about 2 s), shown as a draining ring.
- On the server: at most 1 reaction per player every 2 s, with a burst of 3; anything beyond that is dropped without an error. It fits inside the existing limit of 10 events per second.
- The server does not forward each tap. It adds them up and broadcasts one `game:reactions` event per game about every 750 ms (counts per emoji). The projector draws at most around 12 floating emoji at a time, scaled by the count, so 60 players tapping look lively and not like a flood.

**Design notes**
- Reactions are short-lived events and the one deliberate exception to "everything is a snapshot": they are not game state, not persisted and not in results (like `host:ping`). The skill `realtime` records this.
- Reduced motion: the counts appear as a static row instead of floating.

**Decisions to make:** the six emoji; whether a player sees their own reaction on their phone at once (recommended); whether there are team reactions in team mode.

**Compliance:** nothing stored, nothing new collected.

---

## 59. Partial credit for multiple choice

**Today:** a multiple-choice question is all or nothing: the set picked must equal the set of right options exactly.

**Recommendation:** a scoring option on the existing multiple-choice type, not a new question type. The editor, spreadsheet import, Quizmoo files and the phone screen already handle multiple choice, so one setting keeps all of that working.

- `scoring: 'all' | 'partial'` on the question. The user wants the choice on every multiple-choice question (5 November 2026): the editor shows a "Scoring" switch on a multiple-choice question, "All or nothing" or "Partial credit", next to its points. It is also a column in the spreadsheet template and is kept in Quizmoo files and batch edit. Which of the two a new question starts with is to decide.
- **Partial formula:** `points × max(0, right picks − wrong picks) / number of right options`, rounded, then the speed bonus as today. Example with 2 right options and 1000 points: one right pick scores 500, both score 1000, one right and one wrong scores 0. Example with 3 right options (A, B, C): A+B scores 667; A+B+D scores 333; picking every option scores at most 0 when there are as many wrong options as right ones. Subtracting wrong picks is what stops "tick everything". It never goes below zero, so nobody loses points they already have.
- **Result states:** a correct answer gets full marks; a partial one scores above zero but below full; a wrong one scores zero. `correct` becomes `true | false | 'partial' | null`, and the phones and the host show "Partly right, 2 of 3" with its own tone (a third colour between right and wrong).
- **Streak:** only a fully right answer continues the streak; a partial one keeps it as it is (it doesn't break it). This is to decide.
- **Teams:** majority voting works per option (an option goes in when most of the team picked it). Team average is unchanged.
- **Results and figures:** a partial answer counts as half-right in "share right" or as its own category (to decide).
- Old games and quizzes keep `'all'` and score exactly as before.

**Compliance:** none.

---

## 60. Certificates and a results report as PDF

**Goal:** a designed keepsake that makes the game feel worth it: certificates for the winners (and optionally everyone), and a clean results report for the host.

**Certificates**
- Landscape A4 in Quizmoo's style: cow mark, the game's theme colours, the host's logo and event name (branding from My settings), the quiz title, the date, the player's or team's name, place and points, and one highlight from the end facts ("Fastest finger", "Best streak: 7").
- Kinds: 1st, 2nd and 3rd place certificates (gold, silver and bronze touches), team certificates in team mode, and an optional "took part" certificate for everyone (a game setting).
- **Players:** a "Download certificate" button on the phone's end pages, for their own certificate only.
- **The host:** one PDF with every certificate, ready to print, from the results page.

**Results report**
- A multi-page PDF from the results page: summary figures, podium, standings, team table, per-question results with the bars, the hardest and easiest question, the awards. Built from the same data as the results page and `endFacts`, so it adds no new data.

**How to render** (decide in the plan; recommendation first)
1. In the browser with a lazily loaded PDF library (for example `pdf-lib`, MIT) and the self-hosted Nunito font. The data is already in the snapshot or the results response, so the server does no work, and it works on the venue LAN. No outside service.
2. On the server with a Node PDF library: one renderer for both, but CPU load on the single game process during an event.
3. A headless browser: pixel-identical to the app, but a much heavier Docker image. Not recommended.

**Decisions to make:** which certificates by default; whether the host can type a custom line ("Company Day 2026"); paper size (A4 only, or Letter too).

**Compliance:** a certificate holds only the nickname, which the player typed. The PDF is generated on the device and not stored.

---

## 61. Platform metrics and statistics

**Goal:** know how the platform is used and how healthy it is, without tracking people.

**Two outputs**
1. **`GET /metrics`** in Prometheus text format, protected by a token from the environment (`METRICS_TOKEN`), for monitoring tools. Live process figures: active games, connected sockets, players per game, event rates, rate-limit drops, persistence latency and failures, reconnects, memory and the event loop delay.
2. **Statistics page for the operator** in the app, backed by daily aggregates in a new `daily_stats` table, because Railway keeps no history of a scrape endpoint. Figures over time: games started and finished, players who joined, peak concurrent players, average game length and players per game, the question types used, team versus solo games, how many games used each setting (streak bonus, typo tolerance, rounds), new and active hosts, starter-quiz copies, tours finished or skipped, certificates downloaded.

**Rules**
- Aggregates only: no per-player rows, no IP addresses, no device data. Figures per host or community are shown only to that host or community (phase 63), never to the operator per name.
- Counts below a small threshold (for example under 5) are shown as "<5" on anything that could later be public.
- Kept for a fixed time (for example 400 days, to decide), then deleted by the daily job.

**Compliance:** a self-hosted Prometheus or Grafana is fine; a hosted one (for example Grafana Cloud) or any analytics service needs a compliance review before use. No web analytics script in the browser.

---

## 62. Communities: separate spaces with their own owner

**Goal:** every quiz, question, picture and game belongs to a community, not to one person. A community's owner manages its members. The platform operator cannot see inside communities. This replaces the backlog's "Rooms with their own admin".

**Today:** `quizzes.ownerId` points at one user and every route checks it, so hosts are already separated. The single `admin` role is both the platform operator and the only "manager".

**Model sketch**
- `communities` (id, name, slug, picture, settings, created at) and `community_members` (community, user, role, joined at).
- Roles: **owner** (one or more; members, roles, settings, deleting the community), **admin** (members and settings, not deleting), **editor** (creates and edits the community's quizzes and questions), **host** (runs the community's quizzes, cannot edit them).
- Every user has a **personal community** created automatically. The migration moves each host's quizzes, pictures and games into their personal community, so nothing changes for existing hosts on day one.
- A user can belong to several communities and switches between them (a switcher in the host navigation). The quiz list, history and results show the current community's items.
- The platform role is split off: `users.platformRole: 'operator' | null`. The operator approves accounts, edits names and seasons, sees platform statistics (61) and, later, handles reports (66). There is no operator endpoint that returns a community's quizzes, questions, pictures or results.
- Invitations: a link or code with a role and an expiry; no e-mail needed.
- Every route and socket attach checks membership and role instead of `ownerId`. This is the bulk of the work and needs a test per route.

**Decisions to make:** the community name for the UI ("community", "team", "club"); whether personal communities can invite others or a new community is needed for that; what happens to quizzes when a member leaves (they stay with the community, which is recommended); the per-community limits (members, quizzes, storage).

**Compliance:** memberships are new personal data (who belongs where): list them in the privacy notice and the data export, and delete them with the account. The operator still has technical database access, so the privacy notice says that this separation is an application rule, not encryption. An access log for operator actions is worth adding (ISO 27001 A.8.15).

---

## 63. Community dashboard

**Goal:** a community's owners and admins oversee their own community. Today's admin pages are few and platform-wide; this gives each community its own.

**Pages**
- **Overview:** games this week and month, players reached, the most-played quizzes, upcoming scheduled games, running games right now (with "Open" for hosts allowed to see them).
- **Members:** list, roles, last active, invitations, removal, each member's figures (games hosted, quizzes made).
- **Content:** the community's quizzes and questions with who edited them last and when; bulk tidy-up (archive, delete, move to another of the user's communities).
- **Settings:** name, picture, default game settings and branding for the whole community (inherited by its hosts' games, overridable), limits.
- The operator gets a separate **platform** dashboard: health, statistics (61), communities as counts (members, games), accounts awaiting approval, reports (66), with no content.

**Depends on:** 61 for the figures and 62 for the model.

**Compliance:** figures per member are visible to the community's owners and admins only; say so in the terms ("your community's admins see your activity in it").

---

## 64. Question bank and share codes

**What it means:** today a question lives inside one quiz. To reuse it, a host copies the whole quiz or retypes it. A question bank is a library of single questions kept apart from quizzes: you save questions into it, tag and search them, and pull them into any quiz.

**Per user first (decided 5 November 2026):** the bank belongs to the host's account and needs no communities, so this phase does not wait for 62. When communities arrive, each host's bank moves into their personal community, and a shared community bank is added there.

**Scope**
- **Copy to another quiz:** on any question in the editor (and on a selection of several), "Copy to quiz…" picks one of the host's other quizzes and adds a copy at its end, pictures included. This works without the bank and is the quickest win.
- **The bank:** "Save to bank" on a question or a selection; "Add from bank" in the editor, a searchable picker by text, type, tag and language, with a preview. A bank page under Quizzes lists, edits, tags and deletes bank questions.
- Adding to a quiz **copies** the question, so editing the quiz never changes the bank, and the other way round. A "from the bank" mark keeps a link so the editor can say "a newer version is in the bank".
- **Share codes:** "Share" on a question, a selection or a whole quiz creates a short code, for example `QM-7K4P-2XNA`, and a link carrying it. Anyone with a host account who enters the code sees a preview and adds the questions to their bank or to one of their quizzes (or, for a whole quiz, gets their own copy). What is shared is a frozen copy made when the code was created, so later edits by the sharer do not leak through.
- The sharer sees their codes under the bank page, with how often each was used, and can revoke one at any time; a code can also be given an expiry (for example 7 days, 30 days or never).
- Import into the bank from a spreadsheet, using the existing template.
- Later, with the public library (66): public question collections.

**Share code rules**
- Codes are random, at least 10 characters from an unambiguous alphabet (no 0/O, 1/I), so they cannot be guessed; lookups are rate limited per account and per IP in memory.
- Only logged-in hosts can redeem a code at first. Opening the preview without an account is a decision for the plan.
- Pictures are copied into the receiver's own images, so deleting the original never breaks the copy.
- Codes and their frozen copies are deleted with the sharer's account, when revoked, or when expired.

**Decisions to make:** tags free-form or from a list; difficulty as a field (easy, medium, hard) or derived from how many got it right in past games (an aggregate only); whether a code can be redeemed without an account; the default expiry.

**Compliance:** a share code passes content to whoever holds it. The sharer is responsible for what they share; the terms say so, and a revoked or expired code stops working at once. Nothing about the receiver is stored beyond a use count.

---

## 65. Editing quizzes together

**Goal:** several people in a community prepare one quiz.

**Scope**
- The roles from 62 decide who can edit; a quiz can also be locked by its author ("only I edit").
- **Concurrent editing:** at first one editor at a time, with a soft lock ("host_12345 is editing: open read-only or take over"). Real-time co-editing is a much larger task and only worth it if asked for.
- "Last edited by" on quiz cards and in the editor; a simple version history (the last 20 saves, restore one), which also helps solo hosts.
- Hand over a quiz: move or copy it to another community the user belongs to.

**Decisions to make:** lock or last-save-wins; how long versions are kept.

---

## 66. Public quiz library

**Goal:** the platform idea: anyone can publish a quiz, anyone with an account can find one and host it.

**Scope**
- **Publish:** from a quiz, "Publish to the library" with a description, language, category, tags, an audience note (for example "family friendly"), a cover picture and the author's public name. Publishing makes a **frozen published version**; the author keeps editing their own copy and republishes when ready.
- **Browse:** a library page with search, filters (language, category, question count, length, question types), sorting (popular, new, top rated), a quiz page with a preview of a few questions (answers hidden) and figures (times played, average share right).
- **Use:** "Host it" starts a game from the published version directly; "Copy to my community" makes an editable copy (remix) that credits the original.
- **Feedback:** hosts rate and like; players can give a thumbs-up on the end pages without an account (counted only, one per player per game).
- **Moderation:** "Report" on every public quiz (reason and optional text), a review queue for the operator, hide or remove with a stated reason sent to the author, an appeal. Automatic checks on publish with the existing name filter for titles and texts.
- Public author profiles: the public name, published quizzes, total plays.

**Decisions to make:** whether the library is visible without logging in (good for discovery, more exposure); the content licence for published quizzes (for example Creative Commons BY, or a Quizmoo-only licence); whether published pictures are allowed at all at first (copyright risk) or only drawings and the author's own pictures with a confirmation.

**Compliance**
- **EU Digital Services Act:** a public library makes Quizmoo a hosting service that stores and shows user content. Expect a notice-and-action mechanism, statements of reasons on removal, a contact point and terms that describe moderation. Have this checked before launch. As a personal project the scale is small, but the duties still apply.
- **GDPR:** the public name is personal data made public; let the author choose a pseudonym and unpublish at any time.
- **Copyright:** uploaders confirm they hold the rights to texts and pictures; a takedown route.
- New terms version, privacy notice update, and a cookies page update if anything new is stored.

---

## 67. Party games: a section next to quizzes

**The idea:** besides quizzes, short interactive games played on the phones in the same room. Players do something, not just pick an option. It reuses everything Quizmoo already has (PIN and QR join, nicknames, avatars, teams, the projector, standings, end pages) but has its own section ("Party games") next to "Quizzes" on the host pages.

**Framework (this phase)**
- A party game is a list of **challenges**. Each challenge type is a module with pure engine functions, like question types today: its settings schema, the public view, what a player may send, scoring, and the reveal. The game manager, timers, snapshots and persistence stay as they are.
- A challenge type has a phone component (the controller) and a projector component (the stage). The phone sends inputs; the server decides; the projector shows the result.
- Fast inputs (taps, a slider being dragged) are throttled on the phone and summed on the server (as in 58); only the final value or the total counts.
- A "Party games" list for the host with ready-made games and an editor for the challenges' content.

**First three challenge types** (pick in the plan)
- **Estimate:** a slider or number line ("How tall is the Eiffel Tower?"); points by how close you are, with everyone's guesses shown as dots on the projector. This also becomes a quiz question type.
- **Pin it:** tap the spot on a picture (where is the cow's tail, find the mistake); points by distance. Uses the host's own pictures, so no map service.
- **Slow reveal:** a picture sharpens over time; answer early for more points.

**Ideas for later (68)**
- **Tug of war:** two teams tap as fast as they can and the rope moves on the projector (taps summed per team; rate limits keep it fair).
- **Buzzer:** the first phone to buzz gets to answer out loud, and the host marks it right or wrong.
- **Timeline:** put events in order on a line, scored by how close each one is.
- **Odd one out**, **word scramble**, **draw and guess** (drawing is larger: it needs a canvas and stroke streaming).
- **Reaction:** tap when the screen changes colour. Note that network delay is unfair here, so the phone measures the time locally against a moment the server sets in advance.

**Decisions to make:** whether party games and quizzes can be mixed in one event (a quiz round, then a tug of war) or stay separate (simpler first); the section's name; which three challenges first.

**Compliance:** nothing new is stored beyond the existing answer records. The games must be original designs: no copies of existing branded games.

---

## 68. More party games

One small phase per new challenge type on top of 67's framework, each with its phone, projector, scoring, editor and tests. Order by what the user enjoys most at events.

---

## 69. Opening the platform

**Goal:** what has to be true before strangers can sign up and use Quizmoo freely.

**Scope**
- **Sign-up without manual approval,** with abuse protection instead: rate limits, the honeypot, limits for new accounts (games per day, storage), and a verified way to log in. This is where the backlog's **passwordless login** (passkeys first, an e-mail code after its compliance review) belongs.
- **Self-service account recovery** (passkeys or the e-mail code), because an admin reset does not scale.
- **Storage limits** per community for pictures, and quotas visible in the community dashboard.
- **Legal:** terms for a public platform (user content, moderation, licence, the DSA points from 66, the minimum age for hosts: 16 under the Hungarian GDPR rules unless a parent consents), the privacy notice for communities, public profiles and statistics, the imprint with an operator contact.
- **Own domain** instead of the Railway subdomain, with HSTS. The DNS provider is a third party, but it holds no user data.
- Landing page for visitors: what Quizmoo is, the library, "Create an account" and "Join a game".
- Load test with several games at once, and the limits of one process (see 70).

---

## 70. More than one server process

**Why:** today one Node process holds the live games in memory. That is fine for one event at a time and for a few in parallel, but a busy platform eventually needs more than one process, and deploys must not split running games.

**Sketch**
- Sticky routing by PIN, so every socket of a game reaches the process that runs it, plus a Socket.IO adapter so broadcasts work across processes. The **Postgres adapter** (`@socket.io/postgres-adapter`) uses the database Quizmoo already has, so no new service is needed. Redis would be faster but is a new service (compliance review).
- A game is owned by one process (a lease row in Postgres). On a deploy or a crash, another process takes the lease and restores the game from its persisted state, which already works at boot today.
- Measure first: a load test of N games × 60 players on one Railway instance decides when this is needed. It may not be needed for a long time.

**Compliance:** none with the Postgres adapter; Redis needs a review.

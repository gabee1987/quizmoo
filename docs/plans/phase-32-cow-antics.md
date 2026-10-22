# Phase 32: Cow antics

**Branch:** `feature/cow-antics`
**Skills to load:** `web-ui`, `motion`, `design-system`, `game-screens`, `i18n`, `verification`, `browser-checks`, `git-workflow`

## Goal

The cow does something silly by itself now and then: a wink, an eye roll, its tongue, a sneeze, or a short line in a speech bubble. On special days it dresses up and says fitting things. It makes the app funnier without getting in the way of a game.

## Decisions (from the user, 22 October 2026)

- **Where:** the home pages (join, login, sign-up), the header logo, and the waiting screens: the phone lobby, the phone's "Answer sent!" screen, and the projector lobby.
- **What:** face gags and moo bubbles; no body moves and no props apart from the seasonal ones.
- **How often:** at random, every 30–60 s.
- **Seasonal:** silly extras on special days (April Fools, Christmas and so on).

## Scope

1. **Antics.** These are short (at most 1.5 s), one-off CSS animations on the cow's parts:
   - `wink`: one eye closes.
   - `roll`: the pupils circle up.
   - `cross`: the pupils meet in the middle.
   - `lick`: the tongue wiggles out.
   - `sneeze`: the head shakes and the nostrils flare. Where a bubble can show, it adds "Hapci!" / "Achoo!".
   - `moo`: a speech bubble with a random silly line. It is only available where a bubble can show (the home hero and the waiting cows), not in the header.
2. **Timing.**
   - The first antic comes 10–20 s after the cow appears. Otherwise a page left after half a minute would never show one. After that, one comes every 30–60 s at random, and never the same antic twice in a row.
   - No antics while the tab is hidden, and none at all under reduced motion.
   - Tapping the home cow works as today (a jump and the next line). A tap also restarts the random timer.
3. **Seasonal looks.** They follow the device's local date and add an extra layer on the cow and two or three lines to the moo pool for the day:

   | Season | Days | Look |
   |---|---|---|
   | New Year | 28 Dec – 3 Jan | party hat |
   | Valentine's Day | 11–17 Feb | heart-shaped pupils |
   | April Fools | 29 Mar – 4 Apr (1 Apr always) | glasses with a fake nose and moustache; its `moo` lines are fake "facts" |
   | Easter | Thursday before to Wednesday after Easter Sunday (computed); wins over the rest of the April Fools week | bunny ears |
   | Halloween | 28 Oct – 3 Nov | witch hat |
   | Christmas | 3–9 Dec (Mikulás) and 20–27 Dec | Santa hat |

   The user widened each season to about a week on 22 October 2026; the first version had single days.

4. **The header logo** becomes the layered `CowLogo`, with no idle animations (it adds no endless animation), the antics minus `moo`, and the seasonal look.
5. **Waiting cow.** A small cow with a bubble (`WaitingCow`):
   - in the phone lobby's player card;
   - on the phone's "Answer sent!" screen;
   - in the projector lobby, sized for the projector.

   It has the idle blink only.
6. **For testing (development builds only).** The URL parameters `?cow=<season>` and `?cowAntics=fast` (an antic every 3 s) are read once when the app loads. Production builds ignore them.

## Out of scope

- Body moves (spin, dance, peek), props outside the seasons, sounds.
- The cow during a running question, on the reveal and scoreboard screens, or in the editor.
- `public/logo.svg`, the favicon and the app icons. They stay as they are.

## Files

- `apps/web/src/components/cow-logo.tsx`:
  - each eye in its own wrapper, with the pupils on their own layer;
  - the tongue and the nostrils on their own layers;
  - an `idle` prop (default true);
  - `antic` and `season` props.
- `apps/web/src/features/cow/antics.ts` and `antics.test.ts` (pure):
  - the antic list and `pickAntic(random, previous, { bubble })`;
  - `nextDelayMs(random, first)`;
  - `seasonFor(date)` with the Easter computation;
  - `mooLines(season)`;
  - the development overrides.
- `apps/web/src/features/cow/use-cow-antics.ts`: the timer hook. It returns the current antic, its replay key and its line, and stops while hidden and under reduced motion.
- `apps/web/src/components/cow-bubble.tsx`: the speech bubble, taken out of `home-hero.tsx`. It takes an optional `live` prop; only the tap lines are announced.
- `apps/web/src/components/waiting-cow.tsx`: the small cow with a bubble.
- Changed to use them:
  - `apps/web/src/components/home-hero.tsx`;
  - `app-header.tsx` (`LogoMark`);
  - `features/play/lobby-parts.tsx`;
  - `features/play/answered.tsx`;
  - `features/screen/lobby.tsx`.
- `apps/web/src/styles.css`: the antic keyframes under "Home hero", and the reduced-motion rule for the bubble.
- `apps/web/src/i18n/hu.json` and `en.json`: `cow.lines.*`, `cow.sneeze`, and `cow.seasons.<season>.*`.

## Steps

1. **Pure module and tests.** Write `antics.ts`, tested on:
   - every season's first and last day and the days around it;
   - Easter in 2026, 2027 and 2030;
   - the delay ranges;
   - no repeated antic;
   - no `moo` without a bubble.

   Check: `pnpm --filter @quizmoo/web exec vitest run src/features/cow/antics.test.ts`.
2. **Cow layers.** Split the cow into the new layers and draw the seasonal layers.

   Check: a screenshot of the home cow looks unchanged. Then render a still of each season at 390 px and 1440 px, in both colour modes.
3. **Antics in CSS and the hook.**

   Check: on the home page with `?cowAntics=fast`, every antic plays. Under emulated reduced motion, none plays.
4. **Header logo.** Use `CowLogo` without idle motion.

   Check: a header screenshot at 1× and 1.5×; `document.getAnimations()` on a host page shows no endless animations from the header.
5. **Waiting cow.** Add it to the phone lobby, the answered screen and the projector lobby.

   Check:
   - the 390 × 844 lobby and answered screens still fit without new scrolling;
   - the projector at 1920 × 1080.
6. **Translations and tests.**
   - Add the lines in both languages, in the Hungarian tone of the `i18n` skill.
   - Update `home-hero.test.tsx` and the e2e specs if a selector moved.

   Check: the `i18n` test passes.
7. **Performance.** Measure the join page on the phone profile (median of five runs), before and after.

   Check: idle `TaskDuration` stays within the noise of the old figure.
8. **Final checks.** Run `pnpm verify` and the whole e2e suite on :3999.

## Done when

- [ ] Each of the six antics plays on the home cow, and the waiting cows play them too; the header plays all but `moo`.
- [ ] Antics come at random every 30–60 s (the first after 10–20 s), never twice the same in a row, never while the tab is hidden, and never under reduced motion.
- [ ] The six seasons show their look and lines on their days, and only then (unit tested).
- [ ] The header logo is the layered cow, with no endless animation.
- [ ] The phone lobby, answered screen and projector lobby show the waiting cow without new scrolling at 390 × 844.
- [ ] Every new text is in `hu.json` and `en.json`.
- [ ] `pnpm verify` and the e2e suite pass; axe passes in both modes.

## Verification command

```
pnpm verify
```

## Manual test list (draft)

1. Open the join page, wait. Within 20 s the cow does something, then again every half minute or so.
2. Open `http://<lan address>/?cowAntics=fast`: an antic every 3 s, including a bubble line; a sneeze says "Hapci!".
3. Tap the cow: it jumps and says its next line as before.
4. Log in: the header cow winks or rolls its eyes now and then, but never shows a bubble.
5. Join a game on a phone: the lobby card shows the small cow, which does its antics while you wait.
6. Answer a question: the "Answer sent!" screen shows the cow.
7. Open the projector for the lobby: a bigger cow next to the PIN.
8. Try each season: `?cow=christmas`, `newYear`, `valentine`, `aprilFools`, `easter`, `halloween`. Each shows its look and lines.
9. Turn on reduced motion in the OS: the cow stays still, apart from the tap bubble on the home page.

## Results

- **Unit tests:** `antics.test.ts` has 40 tests:
  - every season's first and last day and the days just outside it;
  - the April Fools week against Easter's week in 2026;
  - Easter in 2024, 2026, 2027 and 2030;
  - the delays and antic picks;
  - every line in both dictionaries.

  `home-hero.test.tsx` covers the cow's own line: it comes after the first wait, is not announced, and a tap replaces it.
- **Browser checks on the dev server:**
  - with `?cowAntics=fast`, all six antics played within 40 s, with no console errors;
  - under emulated reduced motion, none played in 8 s;
  - the seasonal looks were checked in both colour modes;
  - the header at 1×, 1.25× and 1.5× has no endless animation in the cow.
- **A test game** (quiz and game "Shots p32", deleted afterwards):
  - the phone lobby and "Answer sent!" fit 390 × 844 without vertical or horizontal scrolling, also with a bubble showing;
  - the projector lobby at 1920 × 1080 shows the big cow and its bubble.
- **Final checks:**
  - `pnpm verify` passes: shared 22, web 279, server 477 with Postgres;
  - e2e 22/22 on the production build on :3999, including axe on the phone and projector lobbies in both modes;
  - 13 endless animations on the production join and login pages, none of them added by this phase.

## Deviations

- **Phone lobby:** the cow sits in the player card's top left corner, with its bubble to the right. Inline next to "Waiting for the host" it squeezed the line onto two rows. The bubble got a left-pointing tail for this.
- **Header logo:** it shows the seasonal look from the first page load; the development overrides are read once, so a full reload without `?cow=` returns to today's look.
- **Performance:** there was no before/after `TaskDuration` measurement. The home pages gained no endless animation (the antics are one-off, and the timer fires every 30–60 s), so instead the endless animations were counted on the production build.

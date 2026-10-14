---
name: motion
description: Quizmoo animation rules: CSS keyframe utilities, staggering, keying screens so animations replay only when meant to, reduced motion, press wobble, confetti, springy easings. Load when adding or changing any animation or transition.
---

# Motion

- CSS keyframes only, defined in `styles.css` under `@theme` and used as `animate-pop`, `animate-fade-up`, `animate-slide-in`, `animate-grow-x` / `animate-grow-y` (with `origin-left` / `origin-bottom`), `animate-float`, `animate-wiggle`, `animate-pulse-ring`, `animate-burst`, `animate-draw` (SVG stroke), `animate-progress`, `animate-drift` (backdrop), `animate-dot`; `glow-border` adds a slowly rotating gradient ring. No animation library: nothing to download, and the global reduced-motion rule ends every animation at once.
- Animate `transform` and `opacity` only. Lists stagger with `style={stagger(index)}` from `lib/motion.ts`.
- Entrance animations run on mount. Game screens are keyed by phase and question id, so a snapshot that only changes `answeredCount` never replays them; an element that should pop on every change is keyed by that value on purpose (the player counter).
- JS-driven effects go through `lib/motion.ts`: `useMotionOk()` / `motionOk()` for `prefers-reduced-motion`, `useCountUp()` / `<CountUp>` for numbers. Confetti is `celebrate()` in `lib/confetti.ts` (lazy `canvas-confetti`, no worker because of the CSP, skipped under reduced motion).
- `Backdrop` (three drifting colour blobs behind every page) is mounted once in the root layout.
- **Press wobble**: `installSquish()` (`lib/squish.ts`, installed in the root layout) gives every clicked button, button-like link, menu item and `[data-squish]` element (choice cards) a short "bubble gum" squash and stretch through the Web Animations API with `composite: 'add'`, so it stacks on hover lifts and entrance animations without restarting them. Nothing to add per component; opt out with `data-no-squish`.
- Menus and select lists open with `animate-menu-pop`, dialogs with `animate-dialog-pop`, popovers (the date picker) with `animate-bubble-pop` (rises from below with the press wobble's squash and stretch, from the middle of the edge facing the trigger: `data-[side=bottom]:origin-top data-[side=top]:origin-bottom`). Radix moves a popover with its anchor every frame, so the trigger's press wobble would shake it: anchor the popover to a still wrapper (`PopoverAnchor` around the trigger) and keep the trigger's wobble. To change a primitive's entrance, change its default class: tailwind-merge keeps two `data-[state=open]:animate-*` classes and the one later in the stylesheet wins. Springy transitions use the easing tokens `ease-spring` (small overshoot: focus rings, switch thumbs, icons) and `ease-spring-soft` (large moves: sheets, the editor's column change, progress bars).
- The editor's settings choreography animates `grid-template-columns` (four fixed tracks at `xl`, no grid gap, spacing inside the side columns) and slides each side panel inside an `overflow-x-clip` wrapper anchored to the moving edge. Keep track counts equal between states, or the browser jumps instead of interpolating.
- Scrollbars are styled globally in `styles.css` (pill thumb in the theme colour, plumper on hover); Firefox gets the thin `scrollbar-color` variant.
- The projector's results summary (`useSlideshow`) moves on every 8 s and can be paused (button or P); resuming keeps the time that was left.
- Host messages fly in and out with an elastic animation and show their remaining time as a progress bar on the message itself.

## Performance rules (learned in phase 16)

- Animate HTML elements, not parts inside an SVG: Chrome runs transform animations of HTML elements on the compositor, but animating an SVG child repaints the SVG on the main thread every frame. To move parts of a drawing, stack one `<svg>` per part in absolutely positioned wrappers and animate the wrappers (`CowLogo` in `components/cow-logo.tsx`).
- An element with an SVG `transform` attribute loses it when CSS animates its `transform`; animate a wrapper instead.
- Every running animation still costs a little main-thread time (about 2 ms per 5 s each on a 4× slowed CPU), even on the compositor and with `will-change`. Keep endless idle animations few (the home pages run 21 in all).
- Never fade the largest text of a page in from `opacity: 0`: the largest contentful paint waits until it is visible. Use transform-only entrances for headings and taglines.
- The reduced-motion rule ends animations at their last keyframe. An animation that ends hidden (the cow's speech bubble) needs `animation: none` in the reduced-motion block, or it never shows.
- Measure before and after with the phone profile script described in `browser-checks`.

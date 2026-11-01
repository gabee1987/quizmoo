import { useState, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { useCowAntics } from '@/features/cow/use-cow-antics'
import { stagger } from '@/lib/motion'
import { CowBubble } from './cow-bubble'
import { CowLogo } from './cow-logo'
import { SeasonGreeting } from './season-greeting'

/** Speech lines the cow cycles through, one per tap. */
export const MOO_LINES = 4

/** The i18n key of the cow's line after `taps` taps (1-based), cycling through the lines. */
export function mooKey(taps: number) {
  return `home.moo.line${((taps - 1) % MOO_LINES) + 1}`
}

/**
 * The cow and the Quizmoo name, big and centred, for the join and login pages. Tapping the cow
 * makes it jump and say something; by itself it does an antic now and then. All motion is CSS
 * (styles.css, "Home hero" and "Cow antics") and ends at once under reduced motion.
 */
export function HomeHero({ tagline, titleRef }: { tagline: string; titleRef?: Ref<HTMLHeadingElement> | undefined }) {
  const { t } = useTranslation()
  const [taps, setTaps] = useState(0)
  const { antic, line, count, season, restart } = useCowAntics({ bubble: true })
  // The antic count at the last tap: once the cow does an antic, the tap line does not come back.
  const [tappedAt, setTappedAt] = useState(0)
  const name = t('app.name')
  const bubbleSpot = 'pointer-events-none absolute -top-3 left-[70%] w-max max-w-36 lg:-top-2 lg:left-[82%] lg:max-w-52'

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="relative">
        <button
          type="button"
          data-no-squish
          aria-label={t('home.cowLabel')}
          onClick={() => {
            setTaps((n) => n + 1)
            setTappedAt(count)
            restart()
          }}
          className="block rounded-4xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          <span className="hero-bob block">
            {/* Keyed by the tap count so every tap replays the jump. */}
            <span key={taps} className={taps > 0 ? 'hero-jump block' : 'block'}>
              <span className="grid size-32 -rotate-6 place-items-center rounded-4xl bg-primary shadow-[0_6px_0_0_var(--primary-edge)] lg:size-48 lg:rounded-[2.5rem] lg:shadow-[0_9px_0_0_var(--primary-edge)]">
                <CowLogo antic={antic} season={season} className="size-28 lg:size-42" />
              </span>
            </span>
          </span>
          <span aria-hidden="true" className="hero-shadow mx-auto mt-3 block h-3 w-24 rounded-[50%] bg-foreground/15 lg:w-36" />
        </button>
        {/* The tap lines are announced; what the cow says by itself is decoration. A tap clears it. */}
        <p aria-live="polite" className={bubbleSpot}>
          {taps > 0 && tappedAt === count && (
            <CowBubble key={taps} className="text-base lg:text-lg">
              {t(mooKey(taps))}
            </CowBubble>
          )}
        </p>
        <p aria-hidden="true" className={bubbleSpot}>
          {line && (
            <CowBubble key={count} className="text-base lg:text-lg">
              {t(line)}
            </CowBubble>
          )}
        </p>
      </div>
      <h1 ref={titleRef} className="scroll-mt-4 text-5xl font-black tracking-tight lg:text-7xl">
        <span className="sr-only">{name}</span>
        {/* Letters drop in one by one; "moo" (from the fifth letter) is in the theme colour. */}
        <span aria-hidden="true">
          {[...name].map((letter, index) => (
            <span
              key={index}
              className={`hero-letter inline-block ${index >= 4 ? 'text-primary' : ''}`}
              style={stagger(index, 60, 150)}
            >
              {letter}
            </span>
          ))}
        </span>
      </h1>
      <p className="max-w-xs text-lg font-bold text-balance text-muted-foreground lg:max-w-sm lg:text-xl">
        {tagline}
      </p>
      <SeasonGreeting />
    </div>
  )
}

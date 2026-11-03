import type { AnswerSymbols, PlayerQuestionResult, PlayerSnapshot } from '@quizmoo/shared'
import { Link } from '@tanstack/react-router'
import {
  ChartLineIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListChecksIcon,
  type LucideIcon,
  SparklesIcon,
  TrophyIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { CheckIcon, CrossIcon } from '../../components/icons'
import { celebrate } from '../../lib/confetti'
import { stagger } from '../../lib/motion'
import { forgetPlayer } from '../../lib/player-storage'
import { useActiveSeason } from '../../lib/season'
import { CorrectAnswer } from '../questions/correct-answer'
import { formatAnswer } from '../questions/format-answer'
import { FactsPage } from './end-facts'
import { endPages, stepPage, swipeStep, type EndPage } from './end-pages'
import { StatsPage } from './end-stats'
import { StandingsPage } from './end-standings'

const pageIcons: Record<EndPage, LucideIcon> = {
  standings: TrophyIcon,
  answers: ListChecksIcon,
  facts: SparklesIcon,
  stats: ChartLineIcon,
}

/**
 * The end of the game on the phone: four pages the player steps through at their own pace with
 * the step pills, Back and Next, a swipe or the arrow keys. `page` lives in the address, so a refresh keeps it.
 */
export function Podium({ snapshot, page, onPage }: { snapshot: PlayerSnapshot; page: EndPage; onPage: (page: EndPage) => void }) {
  const { t } = useTranslation()
  const myTeam = snapshot.teams.find((team) => team.id === snapshot.me.teamId)
  const onPodium = !snapshot.resultsPending && (snapshot.mode === 'team' ? (myTeam?.rank ?? 99) : snapshot.me.rank) <= 3
  // The side the page turns in from: forward pages come from the right.
  const [from, setFrom] = useState<1 | -1>(1)
  const touch = useRef<{ x: number; y: number } | null>(null)

  const season = useActiveSeason()

  // Confetti for the top three once the results are in (the podium stage celebrates nobody on phones).
  useEffect(() => {
    if (onPodium) void celebrate(season)
  }, [onPodium, season])

  const go = (next: EndPage) => {
    if (next === page) return
    setFrom(endPages.indexOf(next) > endPages.indexOf(page) ? 1 : -1)
    onPage(next)
    window.scrollTo({ top: 0 })
  }
  const goRef = useRef(go)
  goRef.current = go

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      if ((event.target as HTMLElement | null)?.closest('input, textarea, [contenteditable], [role="dialog"]')) return
      if (event.key === 'ArrowRight') goRef.current(stepPage(page, 1))
      if (event.key === 'ArrowLeft') goRef.current(stepPage(page, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [page])

  if (snapshot.resultsPending) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h1 className="animate-pop text-3xl font-black">{t('play.gameOver')}</h1>
        <p className="text-lg text-foreground">{t('play.resultsComing')}</p>
      </div>
    )
  }
  const at = endPages.indexOf(page)
  const last = at === endPages.length - 1
  return (
    <div className="flex flex-1 flex-col gap-4">
      <nav aria-label={t('play.end.pagesLabel')} className="flex items-center justify-center gap-2">
        {endPages.map((p, i) => {
          const Icon = pageIcons[p]
          const current = p === page
          return (
            <button
              key={p}
              type="button"
              aria-current={current ? 'step' : undefined}
              aria-label={current ? undefined : t(`play.end.pages.${p}`)}
              onClick={() => go(p)}
              className={cn(
                'flex h-10 items-center justify-center gap-1.5 rounded-full text-sm font-extrabold transition-all duration-300 ease-spring outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                current
                  ? 'bg-primary px-4 text-primary-foreground shadow-[0_3px_0_var(--primary-edge)]'
                  : i < at
                    ? 'w-10 bg-[color-mix(in_srgb,var(--primary)_22%,var(--card))] text-foreground'
                    : 'w-10 bg-muted text-muted-foreground',
              )}
            >
              <Icon className="size-4.5" aria-hidden="true" />
              {current && t(`play.end.pages.${p}`)}
            </button>
          )
        })}
      </nav>
      <div
        key={page}
        className="flex-1 animate-page-in touch-pan-y"
        style={{ ['--page-from' as string]: `${from * 48}px` }}
        onPointerDown={(event) => {
          touch.current = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY }
        }}
        onPointerUp={(event) => {
          if (!touch.current) return
          const step = swipeStep(event.clientX - touch.current.x, event.clientY - touch.current.y)
          touch.current = null
          if (step !== 0) go(stepPage(page, step))
        }}
        onPointerCancel={() => (touch.current = null)}
      >
        {page === 'standings' && <StandingsPage snapshot={snapshot} />}
        {page === 'answers' && snapshot.myResults && <MyResults results={snapshot.myResults} symbols={snapshot.settings.answerSymbols} />}
        {page === 'facts' && snapshot.endFacts && <FactsPage facts={snapshot.endFacts} players={snapshot.players} meId={snapshot.me.id} />}
        {page === 'stats' && snapshot.myFacts && snapshot.myResults && (
          <StatsPage facts={snapshot.myFacts} results={snapshot.myResults} questionCount={snapshot.endFacts?.questionCount ?? 0} />
        )}
      </div>
      {/* Back and Next stay at hand at the bottom of the screen while a long page scrolls. */}
      <div className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 flex gap-3">
        {at > 0 && (
          <Button size="lg" variant="outline" className="flex-1 bg-card" onClick={() => go(stepPage(page, -1))}>
            <ChevronLeftIcon aria-hidden="true" />
            {t('play.end.back')}
          </Button>
        )}
        {last ? (
          <Button asChild size="lg" className="flex-1">
            <Link to="/" onClick={() => forgetPlayer(snapshot.pin)}>
              {t('play.backToHome')}
            </Link>
          </Button>
        ) : (
          <Button size="lg" className="flex-1" onClick={() => go(stepPage(page, 1))}>
            {t(`play.end.pages.${endPages[at + 1]!}`)}
            <ChevronRightIcon aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )
}

/** How a question went for the player: its colour, foreground and the stamp's label. */
type Outcome = 'right' | 'wrong' | 'voted' | 'missed'
const outcomeLook: Record<Outcome, { tone: string; toneForeground: string; label: string }> = {
  right: { tone: 'var(--success)', toneForeground: 'var(--success-foreground)', label: 'play.correct' },
  wrong: { tone: 'var(--destructive)', toneForeground: 'var(--destructive-foreground)', label: 'play.wrong' },
  voted: { tone: 'var(--primary)', toneForeground: 'var(--primary-foreground)', label: 'play.voted' },
  missed: { tone: 'var(--muted-foreground)', toneForeground: 'var(--background)', label: 'play.noAnswer' },
}

function outcomeOf(result: PlayerQuestionResult): Outcome {
  if (result.question.type === 'poll') return result.answer ? 'voted' : 'missed'
  if (result.correct === true) return 'right'
  if (result.correct === false) return 'wrong'
  // Unanswered, or host-graded text that was never graded.
  return result.answer ? 'voted' : 'missed'
}

/**
 * The player's answer to every question, closed at first: one chunky card each, tinted in the result
 * colour (border, pressed bottom edge, a coloured band behind the title and a light tint below), with the question as the
 * card's heading on its own row and a chip ("Correct! +900", "Not this time") under it.
 * Tapping a card opens the answer and the correct one.
 */
function MyResults({ results, symbols }: { results: PlayerQuestionResult[]; symbols: AnswerSymbols }) {
  const { t, i18n } = useTranslation()
  const right = results.filter((r) => r.correct === true).length
  return (
    <section className="flex w-full flex-col gap-3">
      <h1 className="text-center text-3xl font-black">{t('play.yourAnswers')}</h1>
      <p className="text-center font-bold text-muted-foreground">{t('play.end.rightOf', { right, count: results.length })}</p>
      <ol className="flex flex-col gap-4">
        {results.map((result, index) => {
          const { question, answer, points, teamAnswer, fallback, nearMiss } = result
          const outcome = outcomeOf(result)
          const look = outcomeLook[outcome]
          return (
            <li key={question.id} className="animate-fade-up" style={stagger(index, 50, 300)}>
              <details
                style={{ ['--tone' as string]: look.tone, ['--tone-foreground' as string]: look.toneForeground }}
                // Tints mix in sRGB: in oklch the card's own hue (0 for white) would pull green towards beige.
                className="group overflow-hidden rounded-2xl border-2 border-[color-mix(in_srgb,var(--tone)_75%,var(--border))] bg-[color-mix(in_srgb,var(--tone)_8%,var(--card))] shadow-[0_5px_0_color-mix(in_oklch,var(--tone),black_22%),0_14px_30px_-12px_var(--shadow-color)]"
              >
                <summary className="flex cursor-pointer list-none flex-col gap-2.5 bg-[color-mix(in_srgb,var(--tone)_22%,var(--card))] px-4 pt-3.5 pb-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
                  <h3 className="text-xl leading-snug font-black wrap-break-word">{question.text}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                      {t('results.questionNumber', { index: index + 1 })}
                    </span>
                    <span className="flex-1" />
                    {/* The result as a chunky chip in its colour. */}
                    <span
                      className="flex animate-pop items-center gap-1.5 rounded-full bg-(--tone) py-1 pr-1 pl-2.5 text-sm font-black text-(--tone-foreground) shadow-[0_3px_0_color-mix(in_oklch,var(--tone),black_25%)]"
                      style={stagger(index, 50, 500)}
                    >
                      {outcome === 'right' && <CheckIcon className="size-4" drawn />}
                      {outcome === 'wrong' && <CrossIcon className="size-4" />}
                      <span className={outcome === 'right' ? undefined : 'pr-1.5'}>{t(look.label)}</span>
                      {outcome === 'right' && (
                        <span className="rounded-full bg-(--tone-foreground) px-2 py-0.5 text-(--tone) tabular-nums">+{points}</span>
                      )}
                    </span>
                    <ChevronDownIcon
                      className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </div>
                </summary>
                <div className="flex flex-col gap-3 border-t border-[color-mix(in_srgb,var(--tone)_35%,var(--border))] px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-muted-foreground">
                      {teamAnswer ? t('play.team.teamAnswerLabel') : t('play.yourAnswer')}
                    </p>
                    <p className="text-lg font-bold wrap-break-word">
                      {answer ? formatAnswer(answer, question, t, i18n.language) : t('play.noAnswer')}
                    </p>
                    {fallback && <p className="text-sm font-semibold text-muted-foreground">{t('play.team.fallback')}</p>}
                    {nearMiss && <p className="text-sm font-semibold text-muted-foreground">{t('play.closeEnough')}</p>}
                  </div>
                  {/* Left-aligned here; the reveal centres it. */}
                  <div className="[&>div]:items-start [&>div]:text-left [&_ul]:justify-start">
                    <CorrectAnswer question={question} symbols={symbols} />
                  </div>
                </div>
              </details>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

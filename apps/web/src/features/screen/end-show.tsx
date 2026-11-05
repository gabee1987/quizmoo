import { endLoopPages, type EndShow, type EndShowPage, type HostCommand, type HostSnapshot } from '@quizmoo/shared'
import {
  ChartColumnIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListOrderedIcon,
  type LucideIcon,
  MedalIcon,
  PauseIcon,
  PlayIcon,
  SparklesIcon,
  TrophyIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Hint } from '@/components/hint'
import { cn } from '@/lib/cn'
import { EndAwards, EndFactsPage, EndLeaderboard, EndRecap } from './end-pages'
import { ScreenPodium } from './podium'

/** Each end page's icon, for the projector's steps and the host's panel. */
export const endPageIcons: Record<EndShowPage, LucideIcon> = {
  podium: TrophyIcon,
  leaderboard: ListOrderedIcon,
  awards: MedalIcon,
  facts: SparklesIcon,
  recap: ChartColumnIcon,
}

/** The steps the projector shows: the results pages, and the recap only while the host has it open. */
function stepsOf(show: EndShow): EndShowPage[] {
  return show.page === 'recap' ? [...endLoopPages, 'recap'] : [...endLoopPages]
}

/**
 * The projector after the game: the page the host chose (or automatic mode moved to), turning in
 * from the side, with the steps and the time left in automatic mode below.
 */
export function ScreenEnd({
  host,
  clockOffset,
  onCommand,
}: {
  host: HostSnapshot
  clockOffset: number
  /** A projector the host opened: its step bar moves the pages too. */
  onCommand?: ((command: HostCommand) => void) | undefined
}) {
  const { t } = useTranslation()
  // A host-attached projector receives the full results, so it must check this itself.
  if (host.resultsPending) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <h1 className="animate-pop text-6xl font-black">{t('play.gameOver')}</h1>
        <p className="text-4xl text-foreground">{t('play.resultsComing')}</p>
      </div>
    )
  }
  const show = host.endShow
  const page = show?.page ?? 'podium'
  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Keyed by page and recap question, so each one plays its entrance. */}
      <div key={`${page}-${show?.recapIndex ?? 0}`} className="flex flex-1 animate-page-in flex-col">
        <EndPage host={host} page={page} />
      </div>
      {show && <EndSteps show={show} clockOffset={clockOffset} onCommand={onCommand} />}
    </div>
  )
}

function EndPage({ host, page }: { host: HostSnapshot; page: EndShowPage }) {
  switch (page) {
    case 'podium':
      return <ScreenPodium host={host} />
    case 'leaderboard':
      return <EndLeaderboard host={host} />
    case 'awards':
      return <EndAwards host={host} />
    case 'facts':
      return <EndFactsPage host={host} />
    case 'recap':
      return <EndRecap host={host} />
  }
}

const control =
  'flex items-center gap-2 rounded-full px-4 py-1.5 text-lg font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none'

/**
 * Where the show is: one pill per page, the current one filled; in automatic mode it drains until
 * the next page. On a projector the host opened (`onCommand`) the pills are buttons, with Back and
 * Next around them, automatic mode on or off, and the question recap.
 */
function EndSteps({
  show,
  clockOffset,
  onCommand,
}: {
  show: EndShow & { recapCount: number }
  clockOffset: number
  onCommand?: ((command: HostCommand) => void) | undefined
}) {
  const { t } = useTranslation()
  const recap = show.page === 'recap'
  const RecapIcon = endPageIcons.recap
  return (
    <nav aria-label={t('screen.end.pagesLabel')} className="flex justify-center">
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border bg-card p-1.5 shadow-soft">
        {onCommand && (
          <Hint label={t(recap ? 'host.game.endShow.previousQuestion' : 'host.game.endShow.back')}>
            <button
              type="button"
              className={cn(control, 'px-2.5')}
              aria-label={t(recap ? 'host.game.endShow.previousQuestion' : 'host.game.endShow.back')}
              onClick={() => onCommand({ type: 'endPageStep', step: -1 })}
            >
              <ChevronLeftIcon className="size-6" aria-hidden="true" />
            </button>
          </Hint>
        )}
        <ol className="flex flex-wrap items-center justify-center gap-2">
          {stepsOf(show).map((page) => {
            const Icon = endPageIcons[page]
            const current = page === show.page
            const content = (
              <>
                <Icon className="size-5" aria-hidden="true" />
                {t(`screen.end.pages.${page}`)}
                {current && page === 'recap' && (
                  <span className="tabular-nums">
                    {show.recapIndex + 1}/{show.recapCount}
                  </span>
                )}
              </>
            )
            return (
              <li
                key={page}
                aria-current={current ? 'step' : undefined}
                className={cn('relative overflow-hidden rounded-full', current && 'bg-primary text-primary-foreground')}
              >
                {onCommand && !current ? (
                  <button type="button" className={control} onClick={() => onCommand({ type: 'endPage', page })}>
                    {content}
                  </button>
                ) : (
                  <span className={cn('flex items-center gap-2 px-4 py-1.5 text-lg font-bold', !current && 'text-muted-foreground')}>{content}</span>
                )}
                {current && show.pageEndsAt !== null && <TimeLeft key={show.pageEndsAt} endsAt={show.pageEndsAt} clockOffset={clockOffset} />}
              </li>
            )
          })}
        </ol>
        {onCommand && (
          <>
            <Hint label={t(recap ? 'host.game.endShow.nextQuestion' : 'host.game.endShow.next')}>
              <button
                type="button"
                className={cn(control, 'px-2.5')}
                aria-label={t(recap ? 'host.game.endShow.nextQuestion' : 'host.game.endShow.next')}
                onClick={() => onCommand({ type: 'endPageStep', step: 1 })}
              >
                <ChevronRightIcon className="size-6" aria-hidden="true" />
              </button>
            </Hint>
            <span className="h-8 w-px bg-border" aria-hidden="true" />
            <button
              type="button"
              className={cn(control, show.auto && 'bg-secondary text-secondary-foreground')}
              aria-pressed={show.auto}
              onClick={() => onCommand({ type: 'endAuto', auto: !show.auto })}
            >
              {show.auto ? <PauseIcon className="size-5" aria-hidden="true" /> : <PlayIcon className="size-5" aria-hidden="true" />}
              {t('host.game.endShow.auto')}
            </button>
            {show.recapCount > 0 && !recap && (
              <button type="button" className={control} onClick={() => onCommand({ type: 'endPage', page: 'recap' })}>
                <RecapIcon className="size-5" aria-hidden="true" />
                {t('host.game.endShow.recapShow')}
              </button>
            )}
          </>
        )}
      </div>
    </nav>
  )
}

/** A bar along the current pill's bottom edge that drains until automatic mode moves on. */
function TimeLeft({ endsAt, clockOffset }: { endsAt: number; clockOffset: number }) {
  const { t } = useTranslation()
  // Measured once per page: a later snapshot must not restart the bar.
  const [ms] = useState(() => Math.max(0, endsAt - (Date.now() + clockOffset)))
  return (
    <span
      role="timer"
      aria-label={t('screen.end.autoLeft')}
      className="absolute inset-x-0 bottom-0 h-1 origin-left animate-progress bg-primary-foreground/80"
      style={{ animationDuration: `${ms}ms`, animationDirection: 'reverse' }}
    />
  )
}

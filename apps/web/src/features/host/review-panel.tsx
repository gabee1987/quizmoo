import type { HostSnapshot } from '@quizmoo/shared'
import { ChevronDownIcon, InfoIcon, ListStartIcon, LoaderCircleIcon, MonitorUpIcon, SearchIcon, XIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { setBoardOptions, useBoardOptions } from './board-options'
import { matchesQuestion } from './question-search'

/**
 * The Questions tab. On top, always in view while the lists scroll: a search over both lists and
 * the question that plays next. Below, two lists that fold: the questions still to come (any of
 * which can play next, between questions) and the ones played so far, with how they went and the
 * way to put one back on the screens. The question running now is on the board, in neither list.
 */
export function ReviewPanel({
  host,
  onShowQuestion,
  onPlayNext,
}: {
  host: HostSnapshot
  onShowQuestion: (index: number) => void
  onPlayNext: (questionId: string) => Promise<boolean>
}) {
  const { t, i18n } = useTranslation()
  const { upcomingOpen, playedOpen } = useBoardOptions()
  const [query, setQuery] = useState('')
  // The question asked to play next, until the snapshot shows it there (or the command fails).
  const [picked, setPicked] = useState<string | null>(null)
  const searchId = useId()
  const nextRow = useRef<HTMLLIElement>(null)
  const lists = useRef<HTMLDivElement>(null)
  // Between questions (the engine's showQuestion rules): put a played question back on the screens,
  // also while answers are held back (the screens then show its answer, not the points).
  const canShowAgain = (host.phase === 'reveal' || host.phase === 'scoreboard') && !host.awaitingGrading
  // The engine's playNext rules; not while a played question is back on the screens.
  const canPick = canShowAgain && !host.reviewing
  const seconds = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 })
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent' })

  const next = host.upcoming[0] ?? null
  const nextId = next?.id ?? null
  if (picked !== null && picked === nextId) setPicked(null)
  // A pick that took effect: its row, now first in the list, comes into view under the header.
  const lastNext = useRef(nextId)
  useEffect(() => {
    if (lastNext.current !== nextId && upcomingOpen) nextRow.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    lastNext.current = nextId
  }, [nextId, upcomingOpen])

  async function pick(questionId: string) {
    setPicked(questionId)
    if (!(await onPlayNext(questionId))) setPicked(null)
  }

  const searching = query.trim() !== ''
  const upcoming = host.upcoming.filter((q) =>
    matchesQuestion(query, { index: q.index, text: q.text, extra: [t(`questionTypes.${q.type}`), q.groupTitle ?? ''] }),
  )
  const played = host.questionStats.filter((s) => matchesQuestion(query, { index: s.index, text: s.text, extra: [t(`questionTypes.${s.type}`)] }))

  return (
    <>
      <div className="sticky top-0 z-10 flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-soft">
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            {t('host.review.search')}
          </label>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={searchId}
            // Not type="search": the browser's own clear button would double ours.
            role="searchbox"
            className="h-10 pr-10 pl-9"
            placeholder={t('host.review.search')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              // The matches start under the header, not where the scrolled list happened to be.
              lists.current?.scrollIntoView({ block: 'nearest' })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) {
                e.stopPropagation()
                setQuery('')
              }
            }}
          />
          {searching && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1 -translate-y-1/2"
              aria-label={t('host.review.clearSearch')}
              onClick={() => setQuery('')}
            >
              <XIcon aria-hidden="true" />
            </Button>
          )}
        </div>
        {/* What plays next, always in view; it pops when the host picks another one. */}
        <div aria-live="polite" className="flex flex-col gap-0.5 rounded-xl border-2 border-primary bg-primary/10 px-3 py-2 dark:bg-primary/20">
          <span className="text-xs font-extrabold tracking-wider text-primary uppercase dark:text-foreground">{t('host.review.nextUp')}</span>
          {next ? (
            <div key={next.id} className="animate-pop">
              <p className="font-bold wrap-break-word">
                {next.index + 1}. {next.text}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(`questionTypes.${next.type}`)}
                {next.groupTitle && ` · ${next.groupTitle}`}
              </p>
            </div>
          ) : (
            <p className="font-bold">{t('host.review.noneLeft')}</p>
          )}
        </div>
      </div>

      {/* Where the lists start, for bringing them back under the header. */}
      <div ref={lists} className="-mb-3 scroll-mt-48" aria-hidden="true" />
      <Section
        title={t('host.review.upcoming')}
        count={host.upcoming.length}
        open={upcomingOpen || searching}
        onToggle={() => setBoardOptions({ upcomingOpen: !upcomingOpen })}
        disabled={searching}
      >
        <p className="text-sm text-muted-foreground">{t(canPick ? 'host.review.pickHelp' : 'host.review.pickWhen')}</p>
        {host.upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('host.review.noneLeft')}</p>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('host.review.noMatches')}</p>
        ) : (
          <ol className="flex flex-col gap-1.5 text-sm">
            {upcoming.map((question) => {
              const isNext = question.id === nextId
              const waiting = question.id === picked
              return (
                <li
                  key={question.id}
                  ref={isNext ? nextRow : undefined}
                  className={cn(
                    'flex scroll-mt-44 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-2 px-3 py-2 transition-colors',
                    isNext ? 'border-primary bg-primary/10 dark:bg-primary/20' : waiting ? 'border-primary/50' : 'border-transparent',
                  )}
                >
                  <div className="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
                    <span className="font-semibold wrap-break-word">
                      {question.index + 1}. {question.text}
                    </span>
                    <span className="text-muted-foreground">
                      {t(`questionTypes.${question.type}`)}
                      {question.groupTitle && ` · ${question.groupTitle}`}
                    </span>
                    {/* What a pick would do to rounds, said before the click. */}
                    {canPick && !isNext && question.ifPicked && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-warning-foreground dark:text-warning">
                        <InfoIcon className="size-3.5 shrink-0" aria-hidden="true" />
                        {t(question.ifPicked.change === 'joins' ? 'host.review.joinsRound' : 'host.review.leavesRound', {
                          round: question.ifPicked.round,
                        })}
                      </span>
                    )}
                  </div>
                  {isNext ? (
                    <Badge key="next" className="shrink-0 animate-pop">
                      {t('host.review.upNext')}
                    </Badge>
                  ) : (
                    canPick && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="shrink-0"
                        disabled={picked !== null}
                        aria-label={t('host.review.playNextLabel', { index: question.index + 1 })}
                        onClick={() => void pick(question.id)}
                      >
                        {waiting ? <LoaderCircleIcon className="animate-spin" aria-hidden="true" /> : <ListStartIcon aria-hidden="true" />}
                        {t('host.review.playNext')}
                      </Button>
                    )
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </Section>

      <Section
        title={t('host.review.questions')}
        count={host.questionStats.length}
        open={playedOpen || searching}
        onToggle={() => setBoardOptions({ playedOpen: !playedOpen })}
        disabled={searching}
      >
        {host.questionStats.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('host.review.noQuestionsYet')}</p>
        ) : played.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('host.review.noMatches')}</p>
        ) : (
          <ol className="flex flex-col gap-2 text-sm">
            {played.map((stat) => (
              <li key={stat.questionId} className="flex flex-col gap-1 border-t pt-2 first:border-t-0 first:pt-0">
                <span className="font-semibold wrap-break-word">
                  {stat.index + 1}. {stat.text}
                </span>
                <span className="text-muted-foreground">
                  {stat.type === 'poll'
                    ? t('host.review.pollAnswers', { count: stat.answeredCount })
                    : t('host.review.correctOf', {
                        correct: stat.correctCount,
                        count: stat.answeredCount,
                        percent: percent.format(stat.answeredCount ? stat.correctCount / stat.answeredCount : 0),
                      })}
                  {stat.averageTimeMs !== null && ` · ${t('host.review.averageTime', { seconds: seconds.format(stat.averageTimeMs / 1000) })}`}
                </span>
                {canShowAgain && !(host.reviewing && host.questionIndex === stat.index) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    aria-label={t('host.review.showAgainLabel', { index: stat.index + 1 })}
                    onClick={() => onShowQuestion(stat.index)}
                  >
                    <MonitorUpIcon aria-hidden="true" />
                    {t('host.review.showAgain')}
                  </Button>
                )}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  )
}

/** A card whose heading folds its list away; while searching it stays open to show the matches. */
function Section({
  title,
  count,
  open,
  onToggle,
  disabled,
  children,
}: {
  title: string
  count: number
  open: boolean
  onToggle: () => void
  disabled: boolean
  children: ReactNode
}) {
  const bodyId = useId()
  return (
    <section className="flex flex-col rounded-2xl border bg-card shadow-soft">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          disabled={disabled}
          onClick={onToggle}
          className="group flex w-full items-center gap-2 rounded-2xl p-4 text-left text-lg font-extrabold outline-none hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-transparent"
        >
          <span className="flex-1">{title}</span>
          <Badge variant="secondary" className="tabular-nums">
            {count}
          </Badge>
          <ChevronDownIcon
            className={cn('size-5 text-muted-foreground transition-transform duration-300 ease-spring', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </h2>
      {open && (
        <div id={bodyId} className="flex animate-fade-up flex-col gap-2 px-4 pb-4">
          {children}
        </div>
      )}
    </section>
  )
}

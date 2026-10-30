import type { HostSnapshot, RevealInfo } from '@quizmoo/shared'
import { ClockIcon, MonitorIcon, ZapIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { TypoTag } from '@/components/typo-tag'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import { CheckIcon, OptionSymbol } from '../../components/icons'
import { optionFill, optionVars } from '../../components/option-colours'
import { TimerBar, TimerRing, useTimer } from '../../components/timer'
import { CorrectAnswer } from '../questions/correct-answer'
import { toBuckets } from '../screen/buckets'
import { useBoardOptions } from './board-options'

/**
 * What the screens show, in one compact strip above the board: the round's intro, the running
 * question with its countdown and the answers per option so far, or the question between
 * questions with its correct answer and figures. The host sees the correct answer here first.
 */
export function QuestionStrip({ host, clockOffset }: { host: HostSnapshot; clockOffset: number }) {
  const { t } = useTranslation()
  const { hideAnswers } = useBoardOptions()

  if (host.phase === 'intro' && host.group) {
    const { group } = host
    const timer =
      host.introEndsAt !== null
        ? { endsAt: host.introEndsAt, totalMs: host.settings.groupIntroSec * 1000, clockOffset, pausedAt: host.pausedAt }
        : null
    return (
      <Strip imageId={group.imageId} timer={timer}>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{t('play.roundOf', { index: group.index + 1, count: group.count })}</Badge>
          <Badge variant="outline">{t('play.roundQuestions', { count: group.questionCount })}</Badge>
          <Badge variant="outline">
            {t('play.questionRange', { first: group.firstIndex + 1, last: group.firstIndex + group.questionCount })}
          </Badge>
        </div>
        <h2 id="strip-title" className="line-clamp-2 text-2xl font-extrabold wrap-break-word">
          {group.title}
        </h2>
        {group.info && <p className="line-clamp-2 text-sm whitespace-pre-line wrap-break-word text-muted-foreground">{group.info}</p>}
        {!timer && <p className="self-start rounded-xl bg-muted px-3 py-1 text-sm font-semibold">{t('host.game.introWaits')}</p>}
      </Strip>
    )
  }

  // The 3-2-1 before a question: what is coming and the ring counting it down ("Start now" skips it).
  if (host.phase === 'countdown' && host.countdownEndsAt !== null) {
    const next = host.nextQuestion
    const timer = { endsAt: host.countdownEndsAt, totalMs: host.settings.countdownSec * 1000, clockOffset, pausedAt: null }
    return (
      <Strip imageId={null} timer={timer}>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{t('play.questionOf', { index: host.questionIndex + 1, count: host.questionCount })}</Badge>
          {host.group && <Badge variant="outline">{host.group.title}</Badge>}
          {next && <Badge variant="outline">{t(`questionTypes.${next.type}`)}</Badge>}
          {next && <Badge variant="outline">{t('editor.seconds', { count: next.timeLimitSec })}</Badge>}
        </div>
        <h2 id="strip-title" className="text-2xl font-extrabold">
          {t('host.game.phase.countdown')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('between.opensIn')}</p>
      </Strip>
    )
  }

  const running = host.phase === 'question'
  const info = running ? host.live : host.reveal
  const question = info?.question ?? host.question
  if (!question || (running && host.questionEndsAt === null)) return null
  const onScreen = host.reviewing ? 'shownAgain' : host.phase === 'scoreboard' ? 'scoreboard' : host.answersHidden ? 'answerHidden' : 'reveal'
  // While it runs, the counts and the correct answer stay out of view when the host hides answers.
  const showAnswers = !running || !hideAnswers
  const timer =
    running && host.questionEndsAt !== null
      ? { endsAt: host.questionEndsAt, totalMs: question.timeLimitSec * 1000, clockOffset, pausedAt: host.pausedAt }
      : null

  return (
    <Strip imageId={question.imageId} timer={timer} side={info && showAnswers ? <Counts info={info} host={host} /> : null}>
      <div className="flex flex-wrap items-center gap-1.5">
        {!running && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
            <MonitorIcon className="size-3.5" aria-hidden="true" />
            {t(`host.shown.onScreen.${onScreen}`)}
          </span>
        )}
        <Badge variant="secondary">{t('play.questionOf', { index: host.questionIndex + 1, count: host.questionCount })}</Badge>
        {host.group && <Badge variant="outline">{host.group.title}</Badge>}
        <Badge variant="outline">{t(`questionTypes.${question.type}`)}</Badge>
        <Badge variant="outline">{t('editor.seconds', { count: question.timeLimitSec })}</Badge>
        {question.type !== 'poll' && <Badge variant="outline">{t('editor.pointsValue', { count: question.points })}</Badge>}
      </div>
      <h2 id="strip-title" className="line-clamp-3 text-xl leading-snug font-extrabold wrap-break-word xl:text-2xl">
        {question.text}
      </h2>
      {!running && <Figures host={host} />}
    </Strip>
  )
}

interface StripTimer {
  endsAt: number
  totalMs: number
  clockOffset: number
  pausedAt: number | null
}

/**
 * The strip's card: the content, then `side` (the answers so far), the picture and the ring with the
 * seconds, the shrinking bar along its bottom. Once the card is wide enough `side` gets a column of its
 * own beside the question, so the width is used instead of stacking everything on the left.
 */
function Strip({
  imageId,
  timer,
  side = null,
  children,
}: {
  imageId: string | null | undefined
  timer: StripTimer | null
  side?: ReactNode
  children: ReactNode
}) {
  const content = (ring: ReactNode, bar: ReactNode) => (
    <section aria-labelledby="strip-title" className="@container flex shrink-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className="flex gap-4 p-3 sm:px-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3 @3xl:flex-row @3xl:items-center @3xl:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">{children}</div>
          {side && <div className="min-w-0 @3xl:w-[45%] @3xl:shrink-0">{side}</div>}
        </div>
        {imageId && (
          <img src={`/api/images/${imageId}`} alt="" className="hidden max-h-24 max-w-36 shrink-0 self-start rounded-xl object-contain shadow-soft sm:block" />
        )}
        {ring}
      </div>
      {bar}
    </section>
  )
  return timer ? <TimedStrip timer={timer} content={content} /> : content(null, null)
}

function TimedStrip({ timer, content }: { timer: StripTimer; content: (ring: ReactNode, bar: ReactNode) => ReactNode }) {
  const state = useTimer(timer)
  return content(<TimerRing state={state} className="size-14 self-center text-xl" />, <TimerBar state={state} className="h-1.5 rounded-none" />)
}

/**
 * The answers per option (or the most common free answers) as small bars, each filled by its share
 * of the answers, the correct ones marked; two columns from four bars. The correct answer itself as
 * well for free answers, whose right answers may not be among the given ones yet.
 */
function Counts({ info, host }: { info: RevealInfo; host: HostSnapshot }) {
  const { t } = useTranslation()
  const symbols = host.settings.answerSymbols
  const buckets = toBuckets(info.question, info.distribution, info.correctKeys, {
    true: t('play.true'),
    false: t('play.false'),
    other: t('screen.other'),
  })
  const free = info.question.type === 'text' || info.question.type === 'number' || info.question.type === 'order'
  const total = Math.max(1, buckets.reduce((sum, bucket) => sum + bucket.count, 0))
  return (
    <div className="flex flex-col gap-1.5">
      {free && (
        <div className="[&>div]:items-start [&>div]:text-left [&_ul]:justify-start">
          <CorrectAnswer question={info.question} symbols={symbols} />
        </div>
      )}
      {buckets.length > 0 && (
        <ul className={cn('grid gap-1.5', buckets.length > 3 && 'sm:grid-cols-2')} aria-label={t('host.board.counts')}>
          {buckets.map((bucket) => {
            const correct = bucket.correct && info.question.type !== 'order'
            return (
              <li
                key={bucket.key}
                style={bucket.index !== null ? optionVars(bucket.index) : undefined}
                className={cn(
                  'relative flex min-w-0 items-center gap-1.5 overflow-hidden rounded-lg border bg-muted/40 py-0.5 pr-2 pl-0.5 text-sm',
                  correct && 'border-2 border-success font-semibold',
                )}
              >
                {/* The share of the answers, in the option's colour (the theme's for free answers). */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-y-0 left-0 transition-[width] duration-500 ease-spring-soft motion-reduce:transition-none',
                    bucket.index !== null ? 'bg-[color-mix(in_srgb,var(--option)_22%,transparent)]' : 'bg-primary/15',
                  )}
                  style={{ width: `${(bucket.count / total) * 100}%` }}
                />
                {bucket.index !== null ? (
                  <span className={cn('relative grid size-6 shrink-0 place-items-center rounded-md', optionFill)}>
                    <OptionSymbol symbols={symbols} index={bucket.index} className="size-3.5" />
                  </span>
                ) : (
                  <span className="w-1" />
                )}
                <span className="relative min-w-0 flex-1 truncate">{bucket.label}</span>
                {info.nearKeys.includes(bucket.key) && <TypoTag className="relative" />}
                {correct && <CheckIcon className="relative size-4 shrink-0 text-success" aria-label={t('play.correct')} />}
                <span className="relative font-black tabular-nums">{bucket.count}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Between questions: the average time and the fastest right answer. */
function Figures({ host }: { host: HostSnapshot }) {
  const { t, i18n } = useTranslation()
  const answers = host.currentAnswers ?? []
  if (answers.length === 0) return null
  const seconds = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 })
  const averageMs = answers.reduce((sum, a) => sum + a.timeMs, 0) / answers.length
  // currentAnswers come sorted by time: the first right one is the fastest.
  const fastest = answers.find((a) => a.correct === true)
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <div className="inline-flex items-center gap-1.5">
        <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
          <ClockIcon className="size-4" aria-hidden="true" />
          {t('host.shown.averageTime')}
        </dt>
        <dd className="font-bold tabular-nums">{t('host.shown.seconds', { seconds: seconds.format(averageMs / 1000) })}</dd>
      </div>
      {fastest && (
        <div className="inline-flex min-w-0 items-center gap-1.5">
          <dt className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground">
            <ZapIcon className="size-4" aria-hidden="true" />
            {t('host.shown.fastest')}
          </dt>
          <dd className="min-w-0 font-bold wrap-break-word">
            {fastest.name} <span className="tabular-nums">{t('host.shown.seconds', { seconds: seconds.format(fastest.timeMs / 1000) })}</span>
          </dd>
        </div>
      )}
    </dl>
  )
}

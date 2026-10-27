import type { HostSnapshot, RevealInfo } from '@quizmoo/shared'
import { ClockIcon, MonitorIcon, ZapIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
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
    <Strip imageId={question.imageId} timer={timer}>
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
      {info && showAnswers && <Counts info={info} host={host} />}
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

/** The strip's card: the content, the picture and the ring with the seconds beside it, the shrinking bar along its bottom. */
function Strip({ imageId, timer, children }: { imageId: string | null | undefined; timer: StripTimer | null; children: ReactNode }) {
  const content = (ring: ReactNode, bar: ReactNode) => (
    <section aria-labelledby="strip-title" className="flex shrink-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className="flex gap-4 p-3 sm:px-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">{children}</div>
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
 * The answers per option (or the most common free answers) as small chips, the correct ones
 * marked; the correct answer itself as well for free answers, whose right answers may not be
 * among the given ones yet.
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
  return (
    <div className="flex flex-col gap-1.5">
      {free && (
        <div className="[&>div]:items-start [&>div]:text-left [&_ul]:justify-start">
          <CorrectAnswer question={info.question} symbols={symbols} />
        </div>
      )}
      {buckets.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={t('host.board.counts')}>
          {buckets.map((bucket) => (
            <li
              key={bucket.key}
              className={cn(
                'flex max-w-60 min-w-0 items-center gap-1.5 rounded-lg border py-0.5 pr-2 pl-0.5 text-sm',
                bucket.correct && info.question.type !== 'order' ? 'border-success border-2 font-semibold' : 'bg-muted/40',
              )}
            >
              {bucket.index !== null ? (
                <span style={optionVars(bucket.index)} className={cn('grid size-6 shrink-0 place-items-center rounded-md', optionFill)}>
                  <OptionSymbol symbols={symbols} index={bucket.index} className="size-3.5" />
                </span>
              ) : (
                <span className="w-1" />
              )}
              <span className="truncate">{bucket.label}</span>
              <span className="font-black tabular-nums">{bucket.count}</span>
              {bucket.correct && info.question.type !== 'order' && (
                <CheckIcon className="size-4 shrink-0 text-success" aria-label={t('play.correct')} />
              )}
            </li>
          ))}
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

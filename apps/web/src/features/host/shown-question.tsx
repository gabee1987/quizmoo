import type { HostSnapshot } from '@quizmoo/shared'
import { CheckCircle2Icon, ClockIcon, MonitorIcon, UsersIcon, ZapIcon, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import { DistributionBars } from '../../components/distribution-bars'
import { PlayerAvatar } from '../../components/player-avatar'
import { CorrectAnswer } from '../questions/correct-answer'
import { TeamAnswerList } from '../results/team-answer-list'

/**
 * The question the screens show between questions (its reveal, the scoreboard after it, or a
 * question shown again), with what the host needs to talk about it: the correct answer, how many
 * answered and were right, the average and fastest time, the answer bars and who did not answer.
 */
export function ShownQuestion({ host }: { host: HostSnapshot }) {
  const { t, i18n } = useTranslation()
  const reveal = host.reveal
  if (!reveal) return null
  const { question } = reveal
  const seconds = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 })
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent' })

  const answers = host.currentAnswers ?? []
  const scored = question.type !== 'poll' && !host.awaitingGrading
  const averageMs = answers.length > 0 ? answers.reduce((sum, a) => sum + a.timeMs, 0) / answers.length : null
  // currentAnswers come sorted by time: the first right one is the fastest.
  const fastest = answers.find((a) => a.correct === true) ?? null
  const answered = new Set(answers.map((a) => a.playerId))
  const missing = host.players.filter((p) => !answered.has(p.id))
  const onScreen = host.reviewing ? 'shownAgain' : host.phase === 'scoreboard' ? 'scoreboard' : 'reveal'

  const figures: { icon: LucideIcon; label: string; value: string; detail?: string | undefined; wide?: boolean }[] = [
    {
      icon: UsersIcon,
      label: t('host.shown.answered'),
      value: `${reveal.answeredCount} / ${host.players.length}`,
    },
    ...(scored
      ? [
          {
            icon: CheckCircle2Icon,
            label: t('host.shown.right'),
            value: String(reveal.correctCount),
            detail: host.players.length > 0 ? percent.format(reveal.correctCount / host.players.length) : undefined,
          },
        ]
      : []),
    {
      icon: ClockIcon,
      label: t('host.shown.averageTime'),
      value: averageMs === null ? '–' : t('host.shown.seconds', { seconds: seconds.format(averageMs / 1000) }),
    },
    ...(scored
      ? [
          {
            icon: ZapIcon,
            wide: true,
            label: t('host.shown.fastest'),
            value: fastest ? fastest.name : '–',
            detail: fastest ? t('host.shown.seconds', { seconds: seconds.format(fastest.timeMs / 1000) }) : undefined,
          },
        ]
      : []),
  ]

  return (
    <section aria-labelledby="shown-question" className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <p className="flex items-center gap-2 self-start rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">
        <MonitorIcon className="size-4" aria-hidden="true" />
        {t(`host.shown.onScreen.${onScreen}`)}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{t('play.questionOf', { index: host.questionIndex + 1, count: host.questionCount })}</Badge>
        <Badge variant="outline">{t(`questionTypes.${question.type}`)}</Badge>
        <Badge variant="outline">{t('editor.seconds', { count: question.timeLimitSec })}</Badge>
        {question.type !== 'poll' && <Badge variant="outline">{t('editor.pointsValue', { count: question.points })}</Badge>}
      </div>
      <div className="flex gap-4">
        <h2 id="shown-question" className="min-w-0 flex-1 text-2xl font-extrabold wrap-break-word">
          {question.text}
        </h2>
        {question.imageId && (
          <img src={`/api/images/${question.imageId}`} alt="" className="max-h-24 max-w-32 shrink-0 self-start rounded-xl object-contain shadow-soft" />
        )}
      </div>
      <div className="[&>div]:items-start [&>div]:text-left [&_ul]:justify-start">
        <CorrectAnswer question={question} symbols={host.settings.answerSymbols} />
      </div>

      {/* The fastest right answer holds a whole name (up to 24 characters): it gets a row of its own. */}
      <dl className={cn('grid gap-2', scored ? 'grid-cols-3' : 'grid-cols-2')}>
        {figures.map(({ icon: Icon, label, value, detail, wide }) => (
          <div key={label} className={cn('flex min-w-0 flex-col gap-0.5 rounded-xl bg-muted px-3 py-2', wide && 'col-span-3')}>
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </dt>
            <dd className="text-lg leading-snug font-black wrap-break-word tabular-nums">
              {value}
              {detail && <span className="ml-1.5 text-sm font-bold text-muted-foreground">{detail}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <DistributionBars reveal={reveal} symbols={host.settings.answerSymbols} />
      <TeamAnswerList entries={host.teamAnswers ?? []} teams={host.teams} question={question} />

      {missing.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-muted-foreground">{t('host.shown.noAnswer', { count: missing.length })}</p>
          <ul className="flex flex-wrap gap-1.5">
            {missing.map((player) => (
              <li
                key={player.id}
                className="flex items-center gap-1.5 rounded-full bg-secondary py-0.5 pr-3 pl-0.5 text-sm font-semibold text-secondary-foreground"
              >
                <PlayerAvatar avatar={player.avatar} size="sm" />
                {player.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

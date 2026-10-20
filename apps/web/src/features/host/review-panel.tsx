import type { HostSnapshot } from '@quizmoo/shared'
import { MonitorUpIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { CheckIcon, CrossIcon } from '../../components/icons'
import { formatAnswer } from '../questions/format-answer'

/** Mid-game review: how each question went, and the answers to the current one (the standings are in `Standings`). */
export function ReviewPanel({ host, onShowQuestion }: { host: HostSnapshot; onShowQuestion: (index: number) => void }) {
  const { t, i18n } = useTranslation()
  // Between questions (the engine's showQuestion rules): put a played question back on the screens.
  const canShowAgain =
    (host.phase === 'reveal' || host.phase === 'scoreboard') && !host.awaitingGrading && !host.answersHidden
  const seconds = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 })
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent' })
  const question = host.reveal?.question ?? host.question

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-extrabold">{t('host.review.title')}</h2>

      <details className="rounded-2xl border bg-card p-3 shadow-soft">
        <summary className="min-h-8 cursor-pointer rounded-md font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring">{t('host.review.questions')}</summary>
        {host.questionStats.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">{t('host.review.noQuestionsYet')}</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2 text-sm">
            {host.questionStats.map((stat) => (
              <li key={stat.questionId} className="flex flex-col gap-1 border-t pt-2">
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
                  {stat.averageTimeMs !== null &&
                    ` · ${t('host.review.averageTime', { seconds: seconds.format(stat.averageTimeMs / 1000) })}`}
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
      </details>

      {host.currentAnswers && host.phase !== 'lobby' && host.phase !== 'finished' && (
        <details className="rounded-2xl border bg-card p-3 shadow-soft">
          <summary className="min-h-8 cursor-pointer rounded-md font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
            {t('host.review.currentAnswers', { count: host.currentAnswers.length })}
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {host.currentAnswers.map((a) => (
              <li key={a.playerId} className="flex items-start gap-2 border-t pt-1">
                {a.correct === true && <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />}
                {a.correct === false && <CrossIcon className="mt-0.5 size-4 shrink-0 text-destructive" />}
                <span className="w-28 shrink-0 font-semibold wrap-break-word">{a.name}</span>
                <span className="min-w-0 flex-1 wrap-break-word">{formatAnswer(a.answer, question, t, i18n.language)}</span>
                <span className="text-muted-foreground tabular-nums">{seconds.format(a.timeMs / 1000)} s</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

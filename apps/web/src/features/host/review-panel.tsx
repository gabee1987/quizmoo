import type { HostSnapshot } from '@quizmoo/shared'
import { MonitorUpIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

/** Mid-game review: how each question went, and the way to put one back on the screens (the answers to the current one are on the board). */
export function ReviewPanel({ host, onShowQuestion }: { host: HostSnapshot; onShowQuestion: (index: number) => void }) {
  const { t, i18n } = useTranslation()
  // Between questions (the engine's showQuestion rules): put a played question back on the screens,
  // also while answers are held back (the screens then show its answer, not the points).
  const canShowAgain = (host.phase === 'reveal' || host.phase === 'scoreboard') && !host.awaitingGrading
  const seconds = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 })
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent' })

  return (
    <section aria-labelledby="review-title" className="flex flex-col gap-2 rounded-2xl border bg-card p-4 shadow-soft">
      <h2 id="review-title" className="text-lg font-extrabold">
        {t('host.review.questions')}
      </h2>
      {host.questionStats.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('host.review.noQuestionsYet')}</p>
      ) : (
        <ol className="flex flex-col gap-2 text-sm">
          {host.questionStats.map((stat) => (
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
    </section>
  )
}

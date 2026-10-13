import type { HostSnapshot } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { answerProgress } from '@/lib/answer-progress'
import { DistributionBars } from '../../components/distribution-bars'
import { PlayerAvatar } from '../../components/player-avatar'
import { Timer } from '../../components/timer'
import { CorrectAnswer } from '../questions/correct-answer'
import { formatAnswer } from '../questions/format-answer'

/**
 * The running question on the host control: what the players see, the correct answer, the
 * answers so far as live bars, and who has not answered yet. The host sees the correct answer
 * here before anyone else; the projector never shows this view.
 */
export function LiveQuestion({ host, clockOffset }: { host: HostSnapshot; clockOffset: number }) {
  const { t, i18n } = useTranslation()
  const { question, live } = host
  if (!question || host.questionEndsAt === null) return null
  const answered = new Set(host.currentAnswers?.map((a) => a.playerId))
  const waiting = host.players.filter((p) => !answered.has(p.id))
  const progress = answerProgress(host)
  const share = progress.count > 0 ? (progress.answered / progress.count) * 100 : 0

  return (
    <section aria-labelledby="live-question" className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{t('play.questionOf', { index: host.questionIndex + 1, count: host.questionCount })}</Badge>
        <Badge variant="outline">{t(`questionTypes.${question.type}`)}</Badge>
        <Badge variant="outline">{t('editor.seconds', { count: question.timeLimitSec })}</Badge>
        {question.type !== 'poll' && <Badge variant="outline">{t('editor.pointsValue', { count: question.points })}</Badge>}
      </div>
      {question.imageId && (
        <img src={`/api/images/${question.imageId}`} alt="" className="max-h-56 self-center rounded-2xl object-contain shadow-soft" />
      )}
      <h2 id="live-question" className="text-2xl font-extrabold wrap-break-word">
        {question.text}
      </h2>
      <Timer endsAt={host.questionEndsAt} totalMs={question.timeLimitSec * 1000} clockOffset={clockOffset} pausedAt={host.pausedAt} />

      <div className="flex flex-col gap-1.5">
        <p className="font-bold tabular-nums" aria-live="polite">
          {t(progress.teams ? 'host.game.teamsAnswered' : 'host.game.answered', { answered: progress.answered, count: progress.count })}
        </p>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-success transition-[width] duration-500 ease-spring" style={{ width: `${share}%` }} />
        </div>
      </div>

      {host.teamAnswers && (
        <ul className="flex flex-col gap-1.5" aria-label={t('host.game.teamAnswers')}>
          {host.teamAnswers.map((entry) => {
            const team = host.teams.find((x) => x.id === entry.teamId)
            if (!team) return null
            const setBy = host.players.find((p) => p.id === entry.setBy)
            return (
              <li key={entry.teamId} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-xl bg-muted/60 px-3 py-2">
                <span className="font-bold">{team.name}</span>
                <span className="text-xs font-semibold text-muted-foreground">{t(`host.create.teamAnswerOptions.${team.answerMode}`)}</span>
                <span className="ml-auto font-semibold wrap-break-word">
                  {entry.answer ? formatAnswer(entry.answer, live?.question ?? question, t, i18n.language) : '…'}
                  {setBy && <span className="text-xs text-muted-foreground"> · {setBy.name}</span>}
                </span>
                {team.answered && <Badge variant="secondary">{t('host.game.teamDone')}</Badge>}
              </li>
            )
          })}
        </ul>
      )}

      {live && (
        <>
          <DistributionBars reveal={live} symbols={host.settings.answerSymbols} />
          <CorrectAnswer question={live.question} symbols={host.settings.answerSymbols} />
        </>
      )}

      {waiting.length > 0 && host.answeredCount > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-muted-foreground">{t('host.game.notAnswered', { count: waiting.length })}</p>
          <ul className="flex flex-wrap gap-1.5">
            {waiting.map((player) => (
              <li
                key={player.id}
                className="flex items-center gap-1.5 rounded-full bg-secondary py-0.5 pr-3 pl-0.5 text-sm font-semibold text-secondary-foreground"
              >
                <PlayerAvatar avatar={player.avatar} size="sm" />
                <span className={player.connected ? undefined : 'opacity-60'}>{player.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

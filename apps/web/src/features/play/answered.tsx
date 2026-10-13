import type { PlayerSnapshot, TeamLive } from '@quizmoo/shared'
import { PencilIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { answerProgress } from '@/lib/answer-progress'
import { useNow } from '@/lib/clock'
import { CheckIcon } from '../../components/icons'
import { PlayerAvatar } from '../../components/player-avatar'
import { WaitingDots } from '../../components/waiting-dots'
import { stagger } from '../../lib/motion'
import { formatAnswer } from '../questions/format-answer'
import { changeWindow, myTeamMode } from './change-window'

export function Answered({
  snapshot,
  clockOffset,
  onChange,
}: {
  snapshot: PlayerSnapshot
  clockOffset: number
  onChange: () => void
}) {
  const { t, i18n } = useTranslation()
  const teamMode = myTeamMode(snapshot)
  const live = snapshot.teamLive
  // Ticks only while the answer can change. Server time, like the timer.
  const now = useNow(snapshot.settings.answerChanges || teamMode === 'shared') + clockOffset
  const change = changeWindow(snapshot, now)
  const setBy = live?.setBy ? snapshot.players.find((p) => p.id === live.setBy) : undefined
  const progress = answerProgress(snapshot)

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <span className="grid size-28 animate-pop place-items-center rounded-full bg-success text-success-foreground shadow-soft">
        <CheckIcon className="size-16" drawn />
      </span>
      <h1 className="animate-fade-up text-3xl font-black" style={stagger(1, 0, 200)}>
        {teamMode === 'shared' ? t('play.team.answerSet') : teamMode === 'majority' ? t('play.team.voteSent') : t('play.answerSent')}
      </h1>
      {teamMode === 'shared' && live?.answer && (
        <p className="animate-fade-up text-lg font-bold wrap-break-word" style={stagger(1, 0, 260)}>
          {setBy?.id === snapshot.me.id
            ? t('play.team.pickedByYou', { answer: formatAnswer(live.answer, snapshot.question, t, i18n.language) })
            : t('play.team.pickedBy', { name: setBy?.name ?? '', answer: formatAnswer(live.answer, snapshot.question, t, i18n.language) })}
        </p>
      )}
      {teamMode === 'majority' && live && <TeamVotes snapshot={snapshot} live={live} />}
      <p className="animate-fade-up font-semibold text-muted-foreground" style={stagger(1, 0, 320)}>
        {t(progress.teams ? 'play.team.teamsAnswered' : 'play.answeredSoFar', { answered: progress.answered, count: progress.count })}
      </p>
      <WaitingDots className="text-muted-foreground" />
      {change && (
        <div className="flex animate-fade-up flex-col items-center gap-2" style={stagger(1, 0, 440)}>
          <Button variant="secondary" size="lg" disabled={change.paused} onClick={onChange}>
            <PencilIcon aria-hidden="true" />
            {t('play.changeAnswer')}
          </Button>
          <p className="text-sm font-semibold text-muted-foreground tabular-nums">
            {t('play.changeSecondsLeft', { count: change.secondsLeft })}
          </p>
        </div>
      )}
    </div>
  )
}

/** The team's votes so far, most first, with who gave them. The first one is what the team answers now. */
function TeamVotes({ snapshot, live }: { snapshot: PlayerSnapshot; live: TeamLive }) {
  const { t, i18n } = useTranslation()
  return (
    <section className="flex w-full max-w-sm animate-fade-up flex-col gap-2 text-left" style={stagger(1, 0, 260)}>
      <h2 className="text-sm font-bold text-muted-foreground">{t('play.team.votes')}</h2>
      <ol className="flex flex-col gap-2">
        {live.votes.map((group, i) => (
          <li
            key={i}
            className={
              i === 0
                ? 'flex items-center gap-3 rounded-2xl border-2 border-primary bg-card px-3 py-2 shadow-soft'
                : 'flex items-center gap-3 rounded-2xl border bg-card px-3 py-2'
            }
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-bold wrap-break-word">{formatAnswer(group.answer, snapshot.question, t, i18n.language)}</span>
              <span className="text-xs font-semibold text-muted-foreground wrap-break-word">
                {group.playerIds.map((id) => snapshot.players.find((p) => p.id === id)?.name ?? '').join(', ')}
              </span>
            </span>
            <span className="flex -space-x-2" aria-hidden="true">
              {group.playerIds.slice(0, 4).map((id) => (
                <PlayerAvatar key={id} avatar={snapshot.players.find((p) => p.id === id)?.avatar} className="ring-2 ring-card" />
              ))}
            </span>
            <span className="font-black tabular-nums" aria-label={t('play.team.voteCount', { count: group.playerIds.length })}>
              {group.playerIds.length}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

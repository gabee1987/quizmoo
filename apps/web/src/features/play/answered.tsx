import type { PlayerSnapshot } from '@quizmoo/shared'
import { PencilIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { answerProgress } from '@/lib/answer-progress'
import { useNow } from '@/lib/clock'
import { CheckIcon } from '../../components/icons'
import { WaitingDots } from '../../components/waiting-dots'
import { stagger } from '../../lib/motion'
import { formatAnswer } from '../questions/format-answer'
import { captainDecides, changeWindow, myTeamMode, myTeamSize } from './change-window'
import { MyAnswer } from './my-answer'
import { TeamPicksPanel } from './team-picks-panel'
import { TeamSummary } from './team-summary'

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
  const [picksOpen, setPicksOpen] = useState(true)
  const teamMode = myTeamMode(snapshot)
  const decides = captainDecides(snapshot)
  // A team of one has nobody to show picks to.
  const live = myTeamSize(snapshot) > 1 ? snapshot.teamLive : null
  // Ticks only while the answer can change. Server time, like the timer.
  const now = useNow(snapshot.settings.answerChanges) + clockOffset
  const change = changeWindow(snapshot, now)
  const confirmedBy = live?.setBy ? snapshot.players.find((p) => p.id === live.setBy) : undefined
  const progress = answerProgress(snapshot)
  // The whole team has its answer (confirmed, or everyone voted): show what the team sent, not just a check.
  const teamDone = Boolean(live && snapshot.teams.find((team) => team.id === snapshot.me.teamId)?.answered)

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      {teamDone && live ? (
        <>
          <span className="grid size-16 animate-pop place-items-center rounded-full bg-success text-success-foreground shadow-soft">
            <CheckIcon className="size-10" drawn />
          </span>
          <TeamSummary snapshot={snapshot} team={live} />
        </>
      ) : !live && snapshot.myAnswer ? (
        // Answering alone (classic, a team of one, a solo player): what was sent, not only a check.
        <>
          <h1 className="flex animate-pop items-center gap-2 text-2xl font-black">
            <span className="grid size-10 place-items-center rounded-full bg-success text-success-foreground shadow-soft">
              <CheckIcon className="size-6" drawn />
            </span>
            {t('play.answerSent')}
          </h1>
          <MyAnswer snapshot={snapshot} answer={snapshot.myAnswer} />
        </>
      ) : (
        <>
          <span className="grid size-28 animate-pop place-items-center rounded-full bg-success text-success-foreground shadow-soft">
            <CheckIcon className="size-16" drawn />
          </span>
          <h1 className="animate-fade-up text-3xl font-black" style={stagger(1, 0, 200)}>
            {decides ? t('play.team.confirmed') : teamMode === 'majority' ? t('play.team.voteSent') : t('play.answerSent')}
          </h1>
          {decides && live?.answer && (
            <p className="animate-fade-up text-lg font-bold wrap-break-word" style={stagger(1, 0, 260)}>
              {confirmedBy?.id === snapshot.me.id
                ? t('play.team.confirmedByYou', { answer: formatAnswer(live.answer, snapshot.question, t, i18n.language) })
                : t('play.team.confirmedBy', { name: confirmedBy?.name ?? '', answer: formatAnswer(live.answer, snapshot.question, t, i18n.language) })}
            </p>
          )}
        </>
      )}
      {live && (
        <TeamPicksPanel
          snapshot={snapshot}
          live={live}
          open={picksOpen}
          onOpenChange={setPicksOpen}
          className="max-w-sm animate-fade-up"
        />
      )}
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

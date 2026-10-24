import type { PlayerSnapshot } from '@quizmoo/shared'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { GameMenu } from '@/components/game-menu'
import { RoundChip } from '@/components/round-chip'
import { TimerBar, TimerRing, useTimer } from '@/components/timer'
import { useGameStore } from '@/lib/socket'

const row = 'flex min-h-11 items-center gap-2'

/**
 * The phone's one row of chrome in a game: during a question the question number, the round and the
 * timer's ring, with the timer's bar right under the row; otherwise the quiz's title. The settings
 * button sits at the right end. It takes the place of the header, so the game keeps the rest of the
 * screen (a question's picture gets what is left).
 */
export function GameBar() {
  const { player: snapshot, clockOffset } = useGameStore()
  return (
    <header className="px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      {snapshot?.phase === 'question' && snapshot.question ? (
        <QuestionBar snapshot={snapshot} timeLimitSec={snapshot.question.timeLimitSec} clockOffset={clockOffset} />
      ) : (
        <div className={row}>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-muted-foreground">{snapshot?.quizTitle}</span>
          <GameMenu />
        </div>
      )}
    </header>
  )
}

function QuestionBar({ snapshot, timeLimitSec, clockOffset }: { snapshot: PlayerSnapshot; timeLimitSec: number; clockOffset: number }) {
  const { t } = useTranslation()
  const info: ReactNode = (
    <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
      <span className="shrink-0 rounded-full bg-muted px-3 py-0.5 font-extrabold tabular-nums">
        {t('play.questionOf', { index: snapshot.questionIndex + 1, count: snapshot.questionCount })}
      </span>
      <RoundChip group={snapshot.group} />
    </div>
  )
  if (snapshot.questionEndsAt === null) {
    return (
      <div className={row}>
        {info}
        <GameMenu />
      </div>
    )
  }
  return <TimedBar endsAt={snapshot.questionEndsAt} totalMs={timeLimitSec * 1000} clockOffset={clockOffset} pausedAt={snapshot.pausedAt} info={info} />
}

function TimedBar({ info, ...input }: { endsAt: number; totalMs: number; clockOffset: number; pausedAt: number | null; info: ReactNode }) {
  const timer = useTimer(input)
  return (
    <>
      <div className={row}>
        {info}
        <TimerRing state={timer} className="size-11 text-lg" />
        <GameMenu />
      </div>
      <TimerBar state={timer} className="mt-2 h-2" />
    </>
  )
}

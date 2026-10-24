import type { HostSnapshot } from '@quizmoo/shared'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FitImage } from '@/components/fit-image'
import { TimerBar, TimerRing, useTimer } from '@/components/timer'
import { answerProgress } from '@/lib/answer-progress'
import { PausedNote } from '../../components/paused-note'
import { RoundChip } from '../../components/round-chip'
import { QuestionInput } from '../questions/question-input'

/**
 * The projector's question, always whole on one screen: one row with the question number, the round,
 * the answers so far and the timer's ring (its bar right under it), the question, the picture as big as
 * it fits, then the answers in their grid filling the rest. The caller gives this phase the screen's
 * height.
 */
export function ScreenQuestion({ host, clockOffset }: { host: HostSnapshot; clockOffset: number }) {
  const { t } = useTranslation()
  const question = host.question
  if (!question) return null
  const progress = answerProgress(host)
  const info = (
    <>
      <span className="shrink-0">{t('play.questionOf', { index: host.questionIndex + 1, count: host.questionCount })}</span>
      <RoundChip group={host.group} size="screen" />
      {/* Keyed by the count so it pops with every answer. */}
      <span key={progress.answered} className="ml-auto shrink-0 animate-pop rounded-full bg-secondary px-5 py-1 text-secondary-foreground">
        {t(progress.teams ? 'host.game.teamsAnswered' : 'host.game.answered', { answered: progress.answered, count: progress.count })}
      </span>
    </>
  )
  const answers = <QuestionInput question={question} mode="display" large symbols={host.settings.answerSymbols} />
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      {host.questionEndsAt !== null ? (
        <TimedRow endsAt={host.questionEndsAt} totalMs={question.timeLimitSec * 1000} clockOffset={clockOffset} pausedAt={host.pausedAt}>
          {info}
        </TimedRow>
      ) : (
        <div className={row}>{info}</div>
      )}
      {host.pausedAt !== null && <PausedNote size="screen" />}
      <h1 className="animate-fade-up text-6xl leading-tight font-black wrap-break-word">{question.text}</h1>
      {/*
        0px bases, so the picture and the answers split the screen's height and no content can push it
        taller: the picture 3 parts (never more than it needs at full width, the rest goes to the
        answers), the answers 2, never below their own height.
      */}
      {question.imageId && <FitImage imageId={question.imageId} capHeight className="min-h-40 flex-[3_1_0px]" />}
      <div className="flex flex-[2_1_0px] flex-col">{answers}</div>
    </div>
  )
}

const row = 'flex min-h-24 items-center gap-5 text-3xl font-semibold text-muted-foreground'

function TimedRow({ children, ...input }: { endsAt: number; totalMs: number; clockOffset: number; pausedAt: number | null; children: ReactNode }) {
  const timer = useTimer(input)
  return (
    <div className="flex flex-col gap-3">
      <div className={row}>
        {children}
        <TimerRing state={timer} className="size-24 text-4xl" />
      </div>
      <TimerBar state={timer} className="h-4" />
    </div>
  )
}

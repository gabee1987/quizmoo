import type { PlayerSnapshot } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { CheckIcon, CrossIcon } from '../../components/icons'
import { RankArrow } from '../../components/rank-arrow'
import { stagger, useCountUp } from '../../lib/motion'
import { CorrectAnswer } from '../questions/correct-answer'
import { formatAnswer } from '../questions/format-answer'
import { myTeamMode } from './change-window'

export function Reveal({ snapshot }: { snapshot: PlayerSnapshot }) {
  const { t, i18n } = useTranslation()
  const points = useCountUp(snapshot.lastPoints ?? 0, 900, 350)
  if (snapshot.answersHidden) return <AnswerKept answered={snapshot.myAnswer !== null} />

  const question = snapshot.reveal?.question
  const isPoll = question?.type === 'poll'
  const answered = snapshot.myAnswer !== null
  const correct = snapshot.lastCorrect

  let tone = 'border bg-card'
  let title = t('play.noAnswer')
  if (isPoll) title = answered ? t('play.thanksForVoting') : t('play.noAnswer')
  else if (correct === true) [tone, title] = ['bg-success text-success-foreground', t('play.correct')]
  else if (correct === false) [tone, title] = ['bg-destructive text-destructive-foreground', t('play.wrong')]
  else if (answered) title = t('play.awaitingGrading')

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      {/* The host put an earlier question back on the screens: this is how it went for you. */}
      {snapshot.reviewing && (
        <p className="rounded-full bg-secondary px-4 py-1 text-sm font-bold text-secondary-foreground">
          {t('play.questionOf', { index: snapshot.questionIndex + 1, count: snapshot.questionCount })} · {t('play.shownAgain')}
        </p>
      )}
      <div className={cn('relative flex w-full animate-pop flex-col items-center gap-3 rounded-3xl px-4 py-8 shadow-soft', tone)}>
        {correct === true && <Sparkles />}
        {correct === true && (
          <span className="grid size-20 animate-pop place-items-center rounded-full bg-success-foreground/20" style={stagger(1, 0, 150)}>
            <CheckIcon className="size-12" drawn />
          </span>
        )}
        {correct === false && (
          <span className="grid size-20 animate-wiggle place-items-center rounded-full bg-destructive-foreground/20" style={stagger(1, 0, 150)}>
            <CrossIcon className="size-12" />
          </span>
        )}
        <h1 className="text-3xl font-black">{title}</h1>
        {/* One answer for the whole team: say which one counted. */}
        {question && snapshot.myAnswer && (myTeamMode(snapshot) === 'majority' || myTeamMode(snapshot) === 'shared') && (
          <p className="font-bold wrap-break-word">
            {t('play.team.teamAnswered', { answer: formatAnswer(snapshot.myAnswer, question, t, i18n.language) })}
          </p>
        )}
        {!isPoll && snapshot.lastPoints !== null && <p className="text-2xl font-black tabular-nums">{t('play.points', { count: points })}</p>}
        {/* Streak bonus: from the second correct answer in a row. */}
        {correct === true && snapshot.settings.streakBonus && snapshot.me.streak >= 2 && (
          <p
            className="flex animate-pop items-center gap-2 rounded-full bg-success-foreground/20 px-4 py-1.5 text-lg font-black"
            style={stagger(1, 0, 600)}
          >
            <span aria-hidden="true" className="inline-block animate-wiggle">
              🔥
            </span>
            {t('play.streak', { count: snapshot.me.streak })}
            {(snapshot.lastBonus ?? 0) > 0 && <span className="tabular-nums">+{snapshot.lastBonus}</span>}
          </p>
        )}
      </div>
      {question && (
        <div className="animate-fade-up" style={stagger(1, 0, 300)}>
          <CorrectAnswer question={question} symbols={snapshot.settings.answerSymbols} />
        </div>
      )}
      {/* The running rank is a scoreboard of its own: only shown when the scoreboard follows every question. */}
      {snapshot.settings.scoreboard === 'afterQuestion' && (
        <p className="flex animate-fade-up items-center gap-2 font-semibold text-muted-foreground" style={stagger(1, 0, 450)}>
          <span>{t('play.totalScore', { score: snapshot.me.score })}</span>
          <span aria-hidden="true">·</span>
          <span>{t('play.rank', { rank: snapshot.me.rank })}</span>
          <RankArrow previous={snapshot.me.previousRank} rank={snapshot.me.rank} />
        </p>
      )}
    </div>
  )
}

/** Eight dots flying out from the centre of the card once. */
function Sparkles() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2
        return (
          <span
            key={i}
            className="absolute top-1/2 left-1/2 size-3 animate-burst rounded-full bg-success-foreground"
            style={{
              ['--dx' as string]: `${Math.cos(angle) * 130}px`,
              ['--dy' as string]: `${Math.sin(angle) * 110}px`,
              animationDelay: '200ms',
            }}
          />
        )
      })}
    </span>
  )
}

/** Results are held back until the end: confirm the answer was kept, reveal nothing. */
function AnswerKept({ answered }: { answered: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <div className="flex w-full animate-pop flex-col items-center gap-2 rounded-3xl border bg-card px-4 py-8 shadow-soft">
        <h1 className="text-3xl font-black">{answered ? t('play.answerKept') : t('play.noAnswer')}</h1>
      </div>
      <p className="font-semibold text-muted-foreground">{t('play.resultsAtEnd')}</p>
    </div>
  )
}

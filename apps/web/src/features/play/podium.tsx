import type { AnswerSymbols, PlayerQuestionResult, PlayerSnapshot } from '@quizmoo/shared'
import { Link } from '@tanstack/react-router'
import { ChevronDownIcon, TrophyIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { CheckIcon, CrossIcon } from '../../components/icons'
import { celebrate } from '../../lib/confetti'
import { stagger } from '../../lib/motion'
import { forgetPlayer } from '../../lib/player-storage'
import { CorrectAnswer } from '../questions/correct-answer'
import { formatAnswer } from '../questions/format-answer'
import { PodiumStage } from '../screen/podium'

export function Podium({ snapshot }: { snapshot: PlayerSnapshot }) {
  const { t } = useTranslation()
  const myTeam = snapshot.teams.find((team) => team.id === snapshot.me.teamId)
  const onPodium = !snapshot.resultsPending && (snapshot.mode === 'team' ? (myTeam?.rank ?? 99) : snapshot.me.rank) <= 3

  // Confetti for the top three once the results are in (the podium stage below celebrates nobody on phones).
  useEffect(() => {
    if (onPodium) void celebrate()
  }, [onPodium])

  if (snapshot.resultsPending) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h1 className="animate-pop text-3xl font-black">{t('play.gameOver')}</h1>
        <p className="text-lg text-foreground">{t('play.resultsComing')}</p>
      </div>
    )
  }
  return (
    <div className="flex flex-1 flex-col items-center gap-5">
      <h1 className="animate-pop text-3xl font-black">{t('play.gameOver')}</h1>
      <div className="w-full animate-pop rounded-3xl border bg-card p-5 text-center shadow-soft" style={stagger(1, 0, 200)}>
        {onPodium && <TrophyIcon className="mx-auto size-10 animate-float text-warning" aria-hidden="true" />}
        <p className="font-semibold text-muted-foreground">{onPodium ? t('play.finalRank') : t('play.wellPlayed')}</p>
        <p className="text-6xl font-black">{snapshot.me.rank}.</p>
        <p className="text-lg font-semibold">{t('play.totalScore', { score: snapshot.me.score })}</p>
        {myTeam && (
          <p className="text-foreground">
            {myTeam.solo ? t('play.soloRank', { rank: myTeam.rank }) : t('play.teamRank', { team: myTeam.name, rank: myTeam.rank })}
          </p>
        )}
      </div>
      <h2 className="text-xl font-extrabold">{t('play.podium')}</h2>
      <PodiumStage places={snapshot.mode === 'team' ? snapshot.teams : snapshot.players} compact celebrate={false} />
      {snapshot.myResults && snapshot.myResults.length > 0 && (
        <MyResults results={snapshot.myResults} symbols={snapshot.settings.answerSymbols} />
      )}
      <Button asChild size="lg" className="w-full">
        <Link to="/" onClick={() => forgetPlayer(snapshot.pin)}>
          {t('play.backToHome')}
        </Link>
      </Button>
    </div>
  )
}

/** How a question went for the player: its colour, foreground and the stamp's label. */
type Outcome = 'right' | 'wrong' | 'voted' | 'missed'
const outcomeLook: Record<Outcome, { tone: string; toneForeground: string; label: string }> = {
  right: { tone: 'var(--success)', toneForeground: 'var(--success-foreground)', label: 'play.correct' },
  wrong: { tone: 'var(--destructive)', toneForeground: 'var(--destructive-foreground)', label: 'play.wrong' },
  voted: { tone: 'var(--primary)', toneForeground: 'var(--primary-foreground)', label: 'play.voted' },
  missed: { tone: 'var(--muted-foreground)', toneForeground: 'var(--background)', label: 'play.noAnswer' },
}

function outcomeOf(result: PlayerQuestionResult): Outcome {
  if (result.question.type === 'poll') return result.answer ? 'voted' : 'missed'
  if (result.correct === true) return 'right'
  if (result.correct === false) return 'wrong'
  // Unanswered, or host-graded text that was never graded.
  return result.answer ? 'voted' : 'missed'
}

/**
 * The player's answer to every question, open at first: one chunky card each, tinted in the result
 * colour (border, pressed bottom edge, a coloured band behind the title and a light tint below), with the question as the
 * card's heading on its own row and a chip ("Correct! +900", "Not this time") under it.
 * The chevron folds a card away.
 */
function MyResults({ results, symbols }: { results: PlayerQuestionResult[]; symbols: AnswerSymbols }) {
  const { t, i18n } = useTranslation()
  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-center text-xl font-extrabold">{t('play.yourAnswers')}</h2>
      <ol className="flex flex-col gap-4">
        {results.map((result, index) => {
          const { question, answer, points, teamAnswer, fallback, nearMiss } = result
          const outcome = outcomeOf(result)
          const look = outcomeLook[outcome]
          return (
            <li key={question.id} className="animate-fade-up" style={stagger(index, 50, 300)}>
              <details
                open
                style={{ ['--tone' as string]: look.tone, ['--tone-foreground' as string]: look.toneForeground }}
                // Tints mix in sRGB: in oklch the card's own hue (0 for white) would pull green towards beige.
                className="group overflow-hidden rounded-2xl border-2 border-[color-mix(in_srgb,var(--tone)_75%,var(--border))] bg-[color-mix(in_srgb,var(--tone)_8%,var(--card))] shadow-[0_5px_0_color-mix(in_oklch,var(--tone),black_22%),0_14px_30px_-12px_var(--shadow-color)]"
              >
                <summary className="flex cursor-pointer list-none flex-col gap-2.5 bg-[color-mix(in_srgb,var(--tone)_22%,var(--card))] px-4 pt-3.5 pb-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
                  <h3 className="text-xl leading-snug font-black wrap-break-word">{question.text}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">
                      {t('results.questionNumber', { index: index + 1 })}
                    </span>
                    <span className="flex-1" />
                    {/* The result as a chunky chip in its colour. */}
                    <span
                      className="flex animate-pop items-center gap-1.5 rounded-full bg-(--tone) py-1 pr-1 pl-2.5 text-sm font-black text-(--tone-foreground) shadow-[0_3px_0_color-mix(in_oklch,var(--tone),black_25%)]"
                      style={stagger(index, 50, 500)}
                    >
                      {outcome === 'right' && <CheckIcon className="size-4" drawn />}
                      {outcome === 'wrong' && <CrossIcon className="size-4" />}
                      <span className={outcome === 'right' ? undefined : 'pr-1.5'}>{t(look.label)}</span>
                      {outcome === 'right' && (
                        <span className="rounded-full bg-(--tone-foreground)/20 px-2 py-0.5 tabular-nums">+{points}</span>
                      )}
                    </span>
                    <ChevronDownIcon
                      className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </div>
                </summary>
                <div className="flex flex-col gap-3 border-t border-[color-mix(in_srgb,var(--tone)_35%,var(--border))] px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-muted-foreground">
                      {teamAnswer ? t('play.team.teamAnswerLabel') : t('play.yourAnswer')}
                    </p>
                    <p className="text-lg font-bold wrap-break-word">
                      {answer ? formatAnswer(answer, question, t, i18n.language) : t('play.noAnswer')}
                    </p>
                    {fallback && <p className="text-sm font-semibold text-muted-foreground">{t('play.team.fallback')}</p>}
                    {nearMiss && <p className="text-sm font-semibold text-muted-foreground">{t('play.closeEnough')}</p>}
                  </div>
                  {/* Left-aligned here; the reveal centres it. */}
                  <div className="[&>div]:items-start [&>div]:text-left [&_ul]:justify-start">
                    <CorrectAnswer question={question} symbols={symbols} />
                  </div>
                </div>
              </details>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

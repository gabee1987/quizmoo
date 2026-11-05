import { toPublicQuestion, type GameSettings, type Question } from '@quizmoo/shared'
import type { TFunction } from 'i18next'
import { PlayIcon } from 'lucide-react'
import { useEffect, useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { Hint } from '@/components/hint'
import { Timer } from '@/components/timer'
import { Button } from '@/components/ui/button'
import { useScreenLook } from '@/lib/season'
import { gameVars } from '@/lib/themes'
import { RoundIntroCard } from '../play/round-intro'
import { Reveal } from '../play/reveal'
import { QuestionInput } from '../questions/question-input'
import {
  currentQuestion,
  nextQuestion,
  playedQuestions,
  restartQuestion,
  reveal,
  revealSnapshot,
  scoreOf,
  startPlay,
  type PreviewPlay,
  type PreviewQuiz,
} from './preview-play'

/** A question to show when none is selected, so the theme, palette and symbols can be previewed on an answer screen. */
function sampleQuestion(t: TFunction): Question {
  return {
    id: 'sample',
    type: 'single',
    text: t('editor.sampleQuestion'),
    options: [1, 2, 3, 4].map((n) => ({ id: `sample-${n}`, text: t(`editor.sampleOption${n}`) })),
    correctOptionId: 'sample-1',
    timeLimitSec: 20,
    points: 1000,
  }
}

/** A still countdown at its start, as the round's intro begins. */
function StillTimer({ seconds }: { seconds: number }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-3 flex-1 rounded-full bg-primary" />
      <span className="grid size-14 place-items-center rounded-full border-[5px] border-primary text-xl font-black">{seconds}</span>
    </div>
  )
}

/**
 * The selected question (or a sample) as a player sees it, inside a 375 px phone frame that
 * renders in the quiz's theme and answer palette: the tokens are recomputed inside [data-theme].
 * With `intro` (a group is selected) the frame shows that round's intro instead.
 * Play runs the quiz on the frame from question `from` (`PreviewPlay`): answer, see the result, go on.
 */
export function PhonePreview({
  question,
  index,
  count,
  settings,
  intro = null,
  quiz,
  from,
  label,
}: {
  /** A heading shown beside Try it (the editor's docked preview column). */
  label?: string | undefined
  question: Question | null
  index: number
  count: number
  settings: GameSettings
  intro?: { group: ComponentProps<typeof RoundIntroCard>['group'] & { id: string }; introSec: number } | null
  quiz: PreviewQuiz
  /** The editor's question index Play starts from; null when there is nothing to play. */
  from: number | null
}) {
  const { t, i18n } = useTranslation()
  // What the phones will show today: the season's theme, or the quiz's own.
  const { theme } = useScreenLook(settings, 'phones')
  const [play, setPlay] = useState<PreviewPlay | null>(null)
  const playing = play ? currentQuestion(quiz, play) : undefined

  // An edit to the question being played plays it again; deleting or switching it off stops.
  useEffect(() => {
    if (!play) return
    const now = currentQuestion(quiz, play)
    if (!now) setPlay(null)
    else if (JSON.stringify(now) !== play.shown) setPlay(restartQuestion(quiz, play, Date.now()))
  }, [quiz, play])

  const frame = 'mx-auto w-[375px] max-w-full rounded-[2.5rem] border-8 border-foreground/85 bg-background p-4 text-foreground shadow-soft'
  const look = { 'data-theme': theme, 'data-palette': settings.answerPalette, style: gameVars({ ...settings, theme }) }

  if (play && playing) {
    const last = play.index + 1 >= playedQuestions(quiz).length
    const snapshot = play.revealed ? revealSnapshot(quiz, play, Date.now()) : null
    const limitMs = playing.timeLimitSec * 1000
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <p role="status" className="min-w-0 flex-1 truncate text-sm font-bold">
            {t('editor.playThrough.status', {
              index: play.index + 1,
              count: playedQuestions(quiz).length,
              score: new Intl.NumberFormat(i18n.language).format(scoreOf(play)),
            })}
          </p>
          {play.revealed && last ? (
            <span className="text-sm font-semibold text-muted-foreground">{t('editor.playThrough.ended')}</span>
          ) : (
            <Button
              size="sm"
              onClick={() => setPlay(play.revealed ? nextQuestion(quiz, play, Date.now()) : reveal(quiz, play, null, Date.now()))}
            >
              {t('common.next')}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setPlay(null)}>
            {t('editor.playThrough.stop')}
          </Button>
        </div>
        <div {...look} className={frame}>
          {/* Keyed by the question's start, so its answer and animations begin again on a restart. */}
          <div key={`${play.index}-${play.startedAt}`} className="flex min-h-[600px] flex-col gap-4">
            {snapshot ? (
              <Reveal snapshot={snapshot} ungradedTitle={t('editor.playThrough.noGrading')} />
            ) : (
              <>
                <p className="text-sm font-semibold text-muted-foreground">
                  {t('play.questionOf', { index: play.index + 1, count: playedQuestions(quiz).length })}
                </p>
                <Timer endsAt={play.startedAt + limitMs} totalMs={limitMs} clockOffset={0} />
                <p className="text-2xl font-black wrap-break-word">{playing.text || t('editor.untitledQuestion')}</p>
                {playing.imageId && (
                  <img src={`/api/images/${playing.imageId}`} alt="" className="max-h-48 self-center rounded-2xl object-contain shadow-soft" />
                )}
                <QuestionInput
                  question={toPublicQuestion(playing)}
                  mode="answer"
                  colourful={settings.answerStyle === 'colourful'}
                  symbols={settings.answerSymbols}
                  onSubmit={(answer) => setPlay(reveal(quiz, play, answer, Date.now()))}
                />
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // The heading (scaled with the preview, so a size up) and Try it on one row.
  const start = (
    <div className="flex items-center justify-center gap-3">
      {label && <p className="text-base font-semibold text-muted-foreground">{label}</p>}
      <Hint label={t('editor.playThrough.startHelp')}>
        <Button size="sm" variant="outline" disabled={from === null} onClick={() => from !== null && setPlay(startPlay(quiz, from, Date.now()))}>
          <PlayIcon aria-hidden="true" />
          {t('editor.playThrough.start')}
        </Button>
      </Hint>
    </div>
  )

  if (intro) {
    return (
      <div className="flex flex-col gap-3">
        {start}
        <div {...look} className={frame}>
          <div key={`${intro.group.id}-${theme}`} className="pointer-events-none flex h-[600px] flex-col" inert>
            <RoundIntroCard group={intro.group} countdown={intro.introSec > 0 && <StillTimer seconds={intro.introSec} />} />
          </div>
        </div>
      </div>
    )
  }
  const shown = question ?? sampleQuestion(t)
  return (
    <div className="flex flex-col gap-3">
      {start}
      <div {...look} className={frame}>
        {/* Inert: a preview, not a playable question. Re-keyed so the entrance animations replay on changes. */}
        <div
          key={`${shown.id}-${settings.answerStyle}-${settings.answerSymbols}-${settings.answerPalette}-${theme}-${JSON.stringify(settings.customTheme)}-${settings.customPalette.join()}`}
          className="pointer-events-none flex min-h-[600px] flex-col gap-4"
          inert
        >
          <p className="text-sm font-semibold text-muted-foreground">
            {question ? t('play.questionOf', { index: index + 1, count }) : t('editor.previewSample')}
          </p>
          <StillTimer seconds={shown.timeLimitSec} />
          <p className="text-2xl font-black wrap-break-word">{shown.text || t('editor.untitledQuestion')}</p>
          {shown.imageId && (
            <img src={`/api/images/${shown.imageId}`} alt="" className="max-h-48 self-center rounded-2xl object-contain shadow-soft" />
          )}
          <QuestionInput
            question={shown}
            mode="answer"
            colourful={settings.answerStyle === 'colourful'}
            symbols={settings.answerSymbols}
          />
        </div>
      </div>
    </div>
  )
}

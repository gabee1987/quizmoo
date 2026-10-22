import type { GameResults, ResultQuestion } from '@quizmoo/shared'
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useQuestionFigures } from '../results/question-stats'
import { PodiumStage } from './podium'
import { RevealLayout } from './reveal-layout'
import { useSlideshow } from './use-slideshow'

export const SUMMARY_SLIDE_MS = 8000

/**
 * Results summary for the projector: the podium, then one slide per question.
 * Moves on by itself every 8 s unless paused (the pause button or P); the arrows on screen,
 * Space or → skip ahead, ← goes back. Wraps around.
 */
export function ScreenSummary({ results }: { results: GameResults }) {
  const { t } = useTranslation()
  const slides = 1 + results.questions.length
  const { slide, paused, forward, back, togglePause } = useSlideshow(slides, SUMMARY_SLIDE_MS)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowRight') forward()
      else if (e.key === 'ArrowLeft') back()
      else if (e.key === 'p' || e.key === 'P') togglePause()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [forward, back, togglePause])

  const question = slide > 0 ? results.questions[slide - 1] : undefined
  return (
    <div className="flex flex-1 flex-col gap-4">
      <p className="flex justify-between text-2xl font-semibold text-muted-foreground">
        <span className="wrap-break-word">{results.quizTitle}</span>
        <span className="tabular-nums">
          {slide + 1} / {slides}
        </span>
      </p>
      {question ? (
        <QuestionSlide key={question.question.id} question={question} playerCount={results.players.length} />
      ) : (
        <div key="podium" className="flex flex-1 flex-col gap-8">
          <h1 className="animate-pop text-center text-6xl font-black">{t('results.podium')}</h1>
          <PodiumStage places={results.podium} />
        </div>
      )}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={back} aria-label={t('screen.previous')}>
          <ChevronLeftIcon />
        </Button>
        <Button
          variant={paused ? 'default' : 'outline'}
          size="icon"
          onClick={togglePause}
          aria-label={paused ? t('screen.resume') : t('screen.pause')}
          aria-pressed={paused}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </Button>
        {/* Time left until the next slide; it stops while paused. */}
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            key={slide}
            className="h-full origin-left animate-progress rounded-full bg-primary"
            style={{ animationDuration: `${SUMMARY_SLIDE_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }}
          />
        </div>
        {paused && <span className="animate-pop text-lg font-bold text-muted-foreground">{t('screen.paused')}</span>}
        <Button variant="outline" size="icon" onClick={forward} aria-label={t('screen.next')}>
          <ChevronRightIcon />
        </Button>
      </div>
      <p className="text-center text-sm text-muted-foreground">{t('results.screenHint')}</p>
    </div>
  )
}

function QuestionSlide({ question, playerCount }: { question: ResultQuestion; playerCount: number }) {
  const { t } = useTranslation()
  const figures = useQuestionFigures(question, playerCount)
  return (
    <RevealLayout
      question={question.question}
      reveal={question}
      heading={<span>{t('results.questionNumber', { index: question.index + 1 })}</span>}
      stats={figures}
    />
  )
}

import type { GameSettings, Question } from '@quizmoo/shared'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { gameVars } from '@/lib/themes'
import { QuestionInput } from '../questions/question-input'

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

/**
 * The selected question (or a sample) as a player sees it, inside a 375 px phone frame that
 * renders in the quiz's theme and answer palette: the tokens are recomputed inside [data-theme].
 */
export function PhonePreview({
  question,
  index,
  count,
  settings,
}: {
  question: Question | null
  index: number
  count: number
  settings: GameSettings
}) {
  const { t } = useTranslation()
  const shown = question ?? sampleQuestion(t)
  return (
    <div
      data-theme={settings.theme}
      style={gameVars(settings)}
      data-palette={settings.answerPalette}
      className="mx-auto w-[375px] max-w-full rounded-[2.5rem] border-8 border-foreground/85 bg-background p-4 text-foreground shadow-soft"
    >
      {/* Inert: a preview, not a playable question. Re-keyed so the entrance animations replay on changes. */}
      <div
        key={`${shown.id}-${settings.answerStyle}-${settings.answerSymbols}-${settings.answerPalette}-${settings.theme}-${JSON.stringify(settings.customTheme)}-${settings.customPalette.join()}`}
        className="pointer-events-none flex min-h-[600px] flex-col gap-4"
        inert
      >
        <p className="text-sm font-semibold text-muted-foreground">
          {question ? t('play.questionOf', { index: index + 1, count }) : t('editor.previewSample')}
        </p>
        <div className="flex items-center gap-4">
          <div className="h-3 flex-1 rounded-full bg-primary" />
          <span className="grid size-14 place-items-center rounded-full border-[5px] border-primary text-xl font-black">
            {shown.timeLimitSec}
          </span>
        </div>
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
  )
}

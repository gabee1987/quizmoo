import type { GameSettings, Question } from '@quizmoo/shared'
import type { TFunction } from 'i18next'
import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { useScreenLook } from '@/lib/season'
import { gameVars } from '@/lib/themes'
import { RoundIntroCard } from '../play/round-intro'
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
 */
export function PhonePreview({
  question,
  index,
  count,
  settings,
  intro = null,
}: {
  question: Question | null
  index: number
  count: number
  settings: GameSettings
  intro?: { group: ComponentProps<typeof RoundIntroCard>['group'] & { id: string }; introSec: number } | null
}) {
  const { t } = useTranslation()
  // What the phones will show today: the season's theme, or the quiz's own.
  const { theme } = useScreenLook(settings, 'phones')
  if (intro) {
    return (
      <div
        data-theme={theme}
        style={gameVars({ ...settings, theme })}
        className="mx-auto w-[375px] max-w-full rounded-[2.5rem] border-8 border-foreground/85 bg-background p-4 text-foreground shadow-soft"
      >
        <div key={`${intro.group.id}-${theme}`} className="pointer-events-none flex h-[600px] flex-col" inert>
          <RoundIntroCard group={intro.group} countdown={intro.introSec > 0 && <StillTimer seconds={intro.introSec} />} />
        </div>
      </div>
    )
  }
  const shown = question ?? sampleQuestion(t)
  return (
    <div
      data-theme={theme}
      style={gameVars({ ...settings, theme })}
      data-palette={settings.answerPalette}
      className="mx-auto w-[375px] max-w-full rounded-[2.5rem] border-8 border-foreground/85 bg-background p-4 text-foreground shadow-soft"
    >
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
  )
}

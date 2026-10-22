import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OptionButton } from '../../components/option-button'
import { stagger } from '../../lib/motion'
import type { QuestionProps } from './types'

export function TrueFalse({ mode, disabled, pending, large, colourful, symbols, initial, onSubmit, picks, onPicks }: QuestionProps<'truefalse'>) {
  const { t } = useTranslation()
  const [chosen, setChosen] = useState<boolean | null>(initial?.type === 'truefalse' ? initial.value : null)
  const choices = [
    { value: true, label: t('play.true') },
    { value: false, label: t('play.false') },
  ]
  return (
    <div className="@container flex flex-1 flex-col">
      <div className="grid flex-1 auto-rows-fr gap-3 @md:grid-cols-2">
        {choices.map((choice, index) => (
          <OptionButton
            key={String(choice.value)}
            index={index}
            label={choice.label}
            symbols={symbols}
            large={large ?? false}
            colourful={colourful ?? large ?? false}
            selected={chosen === choice.value}
            pending={(pending ?? false) && chosen === choice.value}
            picks={picks && (picks[String(choice.value)] ?? [])}
            onPicks={onPicks}
            disabled={mode === 'display' || disabled}
            className="animate-pop"
            style={stagger(index, 70, 150)}
            onClick={() => {
              setChosen(choice.value)
              onSubmit?.({ type: 'truefalse', value: choice.value })
            }}
          />
        ))}
      </div>
    </div>
  )
}

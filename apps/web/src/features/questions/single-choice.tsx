import { useState } from 'react'
import { OptionButton } from '../../components/option-button'
import { stagger } from '../../lib/motion'
import type { QuestionProps } from './types'

/** Tap to submit. Polls share this layout. */
export function SingleChoice({ question, mode, disabled, pending, large, colourful, symbols, initial, onSubmit, picks, onPicks }: QuestionProps<'single' | 'poll'>) {
  const [chosen, setChosen] = useState<string | null>(
    initial?.type === 'single' || initial?.type === 'poll' ? initial.optionId : null,
  )
  return (
    <div className="@container flex flex-1 flex-col">
      <div className="grid flex-1 auto-rows-fr gap-3 @md:grid-cols-2">
        {question.options.map((option, index) => (
          <OptionButton
            key={option.id}
            index={index}
            label={option.text}
            imageId={option.imageId}
            symbols={symbols}
            large={large ?? false}
            colourful={colourful ?? large ?? false}
            selected={chosen === option.id}
            pending={(pending ?? false) && chosen === option.id}
            picks={picks && (picks[option.id] ?? [])}
            onPicks={onPicks}
            disabled={mode === 'display' || disabled}
            className="animate-pop"
            style={stagger(index, 70, 150)}
            onClick={() => {
              setChosen(option.id)
              onSubmit?.({ type: question.type, optionId: option.id })
            }}
          />
        ))}
      </div>
    </div>
  )
}

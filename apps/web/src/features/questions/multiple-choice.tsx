import { Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { OptionButton } from '../../components/option-button'
import { stagger } from '../../lib/motion'
import type { QuestionProps } from './types'

/** Toggle options, then confirm. */
export function MultipleChoice({ question, mode, disabled, pending, large, colourful, symbols, initial, onSubmit, picks, onPicks }: QuestionProps<'multiple'>) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<string[]>(initial?.type === 'multiple' ? initial.optionIds : [])
  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))

  return (
    <div className="@container flex flex-1 flex-col gap-3">
      {mode === 'answer' && <p className="text-center text-sm text-muted-foreground">{t('play.selectAll')}</p>}
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
            selected={selected.includes(option.id)}
            picks={picks && (picks[option.id] ?? [])}
            onPicks={onPicks}
            disabled={mode === 'display' || disabled}
            className="animate-pop"
            style={stagger(index, 70, 150)}
            onClick={() => toggle(option.id)}
          />
        ))}
      </div>
      {mode === 'answer' && (
        <Button
          size="lg"
          disabled={disabled || selected.length === 0}
          onClick={() => onSubmit?.({ type: 'multiple', optionIds: selected })}
        >
          {pending && <Loader2Icon className="animate-spin" aria-hidden="true" />}
          {t('play.confirm')}
        </Button>
      )}
    </div>
  )
}

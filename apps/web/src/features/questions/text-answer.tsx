import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { QuestionProps } from './types'

export function TextAnswer({ mode, disabled, large, initial, onSubmit }: QuestionProps<'text'>) {
  const { t } = useTranslation()
  const [value, setValue] = useState(initial?.type === 'text' ? initial.value : '')
  if (mode === 'display') {
    return <p className={`text-center text-muted-foreground ${large ? 'text-4xl' : ''}`}>{t('screen.answerOnPhone')}</p>
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed) onSubmit?.({ type: 'text', value: trimmed })
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={100}
        autoComplete="off"
        enterKeyHint="send"
        aria-label={t('play.typeAnswer')}
        placeholder={t('play.typeAnswer')}
        disabled={disabled}
        className="min-h-14 rounded-xl border-2 border-input bg-card px-4 py-3 text-xl font-semibold text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
      />
      <Button type="submit" disabled={disabled || !value.trim()}>
        {t('play.submit')}
      </Button>
    </form>
  )
}

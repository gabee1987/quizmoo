import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { QuestionProps } from './types'

/** Accepts a decimal comma as well, since Hungarian keyboards type "3,5". */
export function parseNumber(input: string): number | null {
  const normalised = input.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(normalised)) return null
  const value = Number(normalised)
  return Number.isFinite(value) ? value : null
}

export function NumberAnswer({ mode, disabled, large, initial, onSubmit }: QuestionProps<'number'>) {
  const { t } = useTranslation()
  const [value, setValue] = useState(initial?.type === 'number' ? String(initial.value) : '')
  if (mode === 'display') {
    return <p className={`text-center text-muted-foreground ${large ? 'text-4xl' : ''}`}>{t('screen.answerOnPhone')}</p>
  }
  const parsed = parseNumber(value)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (parsed !== null) onSubmit?.({ type: 'number', value: parsed })
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="send"
        aria-label={t('play.typeNumber')}
        placeholder={t('play.typeNumber')}
        disabled={disabled}
        className="min-h-14 rounded-xl border-2 border-input bg-card px-4 py-3 text-center text-2xl font-bold text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
      />
      <Button type="submit" disabled={disabled || parsed === null}>
        {t('play.submit')}
      </Button>
    </form>
  )
}

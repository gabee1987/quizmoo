import { useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseNumber } from '../questions/number-answer'

/** Number input that keeps the typed text (e.g. "-" or "3,") until it parses; accepts a decimal comma. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  error,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  error?: string | undefined
}) {
  const id = useId()
  const [text, setText] = useState(String(value))
  const parsed = parseNumber(text)
  const invalid = parsed === null || (min !== undefined && parsed < min)
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const next = parseNumber(e.target.value)
          if (next !== null && (min === undefined || next >= min)) onChange(next)
        }}
        aria-invalid={invalid || error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="text-lg"
      />
      {error && (
        <span id={`${id}-error`} className="text-sm font-semibold text-destructive">
          {error}
        </span>
      )}
    </div>
  )
}

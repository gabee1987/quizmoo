import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { PIN_LENGTH } from '../lib/pin'

/**
 * One box per digit of the game PIN. Typing moves to the next box, Backspace on an empty box
 * goes back, a paste or an SMS-style autofill fills every box at once; anything but digits is ignored.
 */
export function PinInput({
  value,
  onChange,
  invalid = false,
  describedBy,
}: {
  value: string
  onChange: (pin: string) => void
  invalid?: boolean
  describedBy?: string | undefined
}) {
  const { t } = useTranslation()
  const boxes = useRef<(HTMLInputElement | null)[]>([])
  // No scroll: the join page keeps the card at the top while the PIN is typed.
  const focus = (index: number) => boxes.current[Math.max(0, Math.min(PIN_LENGTH - 1, index))]?.focus({ preventScroll: true })

  /** Writes `digits` from box `index` on, moving the focus past them. */
  function write(index: number, digits: string) {
    if (!digits) return
    const next = (value.slice(0, index) + digits + value.slice(index + digits.length)).slice(0, PIN_LENGTH)
    onChange(next)
    focus(index + digits.length)
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (value[index]) onChange(value.slice(0, index) + value.slice(index + 1))
      else {
        onChange(value.slice(0, Math.max(0, index - 1)) + value.slice(index))
        focus(index - 1)
      }
    } else if (e.key === 'ArrowLeft') focus(index - 1)
    else if (e.key === 'ArrowRight') focus(index + 1)
  }

  function onPaste(index: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    write(index, e.clipboardData.getData('text').replace(/\D/g, ''))
  }

  return (
    <div role="group" aria-label={t('join.pin')} className="flex justify-between gap-1.5">
      {Array.from({ length: PIN_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(el) => {
            boxes.current[index] = el
          }}
          value={value[index] ?? ''}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '')
            if (digits) write(index, digits)
          }}
          onKeyDown={(e) => onKeyDown(index, e)}
          onPaste={(e) => onPaste(index, e)}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={t('join.pinDigit', { n: index + 1 })}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-14 w-full min-w-0 rounded-xl border-2 border-input bg-card text-center text-2xl font-black text-foreground caret-primary transition-[border-color,box-shadow,transform] outline-none',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40',
            value[index] && 'border-primary',
            invalid && 'border-destructive',
          )}
        />
      ))}
    </div>
  )
}

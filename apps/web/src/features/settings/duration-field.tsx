import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SelectField } from '@/components/select-field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { MESSAGE_DURATIONS, clampSeconds } from './host-settings'

type Choice = 'stays' | 'custom' | number

/**
 * How long a quick message stays: until cleared, 10, 30 or 60 s, or any other number of seconds
 * from 5 to 600. Used in My settings and in a game's message box.
 */
export function DurationField({
  value,
  onChange,
  label,
  hideLabel = false,
  className,
}: {
  value: number | null
  onChange: (value: number | null) => void
  label?: string | undefined
  hideLabel?: boolean
  className?: string | undefined
}) {
  const { t } = useTranslation()
  const preset = value === null || (MESSAGE_DURATIONS as readonly (number | null)[]).includes(value)
  // "Other…" stays picked for the value it set, even one of the usual ones; any other value (a discard) shows as itself.
  const [customFor, setCustomFor] = useState<number | null | undefined>(undefined)
  const custom = !preset || customFor === value
  const [seconds, setSeconds] = useState(String(value ?? 45))
  const inputId = useId()
  const choice: Choice = custom ? 'custom' : (value ?? 'stays')
  const options: { value: Choice; label: string }[] = [
    { value: 'stays', label: t('host.game.message.stays') },
    ...MESSAGE_DURATIONS.filter((d) => d !== null).map((d) => ({ value: d as Choice, label: t('host.game.message.seconds', { count: d }) })),
    { value: 'custom', label: t('settings.messages.custom') },
  ]

  function commit(raw: string) {
    const clamped = clampSeconds(raw)
    setSeconds(String(clamped))
    setCustomFor(clamped)
    if (clamped !== value) onChange(clamped)
  }

  return (
    <div className={cn('flex items-end gap-2', className)}>
      <SelectField
        className="w-40"
        label={label ?? t('host.game.message.duration')}
        hideLabel={hideLabel}
        value={choice}
        options={options}
        onChange={(next) => {
          if (next === 'custom') return commit(seconds)
          setCustomFor(undefined)
          onChange(next === 'stays' ? null : next)
        }}
      />
      {custom && (
        <div className="flex animate-pop flex-col gap-2">
          <label htmlFor={inputId} className={cn('text-sm font-semibold', hideLabel && 'sr-only')}>
            {t('settings.messages.customSeconds')}
          </label>
          <Input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={5}
            max={600}
            className="w-24"
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit(e.currentTarget.value)
              }
            }}
          />
        </div>
      )}
    </div>
  )
}

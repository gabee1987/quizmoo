import { useId, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Collapse } from '@/components/collapse'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

export interface Choice<T extends string> {
  value: T
  label: ReactNode
  description?: ReactNode
  /** Extra content on the right, e.g. colour swatches. */
  adornment?: ReactNode
}

/** A labelled single choice shown as selectable cards (Radix radio group: arrow keys move the choice). */
export function ChoiceCards<T extends string>({
  legend,
  value,
  choices,
  onChange,
  disabled = false,
  help,
  columns = 2,
}: {
  legend: string
  value: T
  choices: readonly Choice<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  help?: ReactNode
  columns?: 1 | 2 | 3
}) {
  const id = useId()
  const lastHelp = useRef(help)
  if (help) lastHelp.current = help
  return (
    // Two columns when the fieldset itself is wide enough (a container query), so the cards also fit narrow panels.
    <fieldset className="@container flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-2 font-bold">{legend}</legend>
      <RadioGroup
        value={value}
        onValueChange={(next) => onChange(next as T)}
        disabled={disabled}
        className={cn('gap-2', columns === 2 && '@md:grid-cols-2', columns === 3 && '@md:grid-cols-3')}
      >
        {choices.map((choice) => (
          <label
            key={choice.value}
            htmlFor={`${id}-${choice.value}`}
            data-squish
            className={cn(
              'group/choice flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 bg-card px-3 py-2 transition-[border-color,background-color,transform,box-shadow] duration-200',
              'hover:-translate-y-0.5 hover:border-ring/60 hover:shadow-soft has-data-[state=checked]:border-primary has-data-[state=checked]:bg-secondary',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <RadioGroupItem id={`${id}-${choice.value}`} value={choice.value} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{choice.label}</span>
              {choice.description && <span className="block text-sm text-muted-foreground">{choice.description}</span>}
            </span>
            {choice.adornment && (
              <span className="transition-transform duration-300 group-hover/choice:scale-110 group-hover/choice:-rotate-3">
                {choice.adornment}
              </span>
            )}
          </label>
        ))}
      </RadioGroup>
      {/* Help that comes and goes with the choice opens smoothly and keeps its text while closing. */}
      <Collapse open={!!help} className="-mt-2" innerClassName="pt-2">
        <p className="text-sm text-muted-foreground">{lastHelp.current}</p>
      </Collapse>
    </fieldset>
  )
}

import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/cn'

/**
 * A labelled select in the app's own style (Radix underneath: keyboard, typeahead and screen readers
 * work). Values may be numbers; they are passed to Radix as strings and converted back.
 */
export function SelectField<T extends string | number>({
  label,
  hideLabel = false,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  hideLabel?: boolean
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id} className={cn('text-sm font-semibold', hideLabel && 'sr-only')}>
        {label}
      </Label>
      <Select
        value={String(value)}
        onValueChange={(next) => onChange(options.find((o) => String(o.value) === next)!.value)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={String(option.value)} value={String(option.value)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

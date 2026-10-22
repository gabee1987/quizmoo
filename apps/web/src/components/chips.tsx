import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** A list of short strings edited as removable chips plus an input (Enter or Add appends). */
export function ChipsInput({
  label,
  values,
  onChange,
  placeholder,
  maxItems = 20,
  maxLength = 100,
}: {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  maxItems?: number
  maxLength?: number
}) {
  const { t } = useTranslation()
  const id = useId()
  const [draft, setDraft] = useState('')
  const add = () => {
    const value = draft.trim()
    if (!value || values.length >= maxItems) return
    if (!values.some((v) => v.toLowerCase() === value.toLowerCase())) onChange([...values, value])
    setDraft('')
  }
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="font-semibold">
        {label}
      </Label>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {values.map((value, i) => (
            <li key={`${value}-${i}`} className="flex items-center gap-1 rounded-full bg-secondary py-1 pr-1 pl-3 font-semibold text-secondary-foreground">
              <span className="wrap-break-word">{value}</span>
              <button
                type="button"
                className="flex size-8 items-center justify-center rounded-full hover:bg-background/60 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
                aria-label={t('common.removeItem', { name: value })}
                onClick={() => onChange(values.filter((_, j) => j !== i))}
              >
                <XIcon className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          className="flex-1"
        />
        <Button type="button" variant="secondary" onClick={add}>
          {t('common.add')}
        </Button>
      </div>
    </div>
  )
}

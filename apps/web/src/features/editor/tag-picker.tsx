import { tagColors, type TagColor } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { PaletteIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/cn'
import { tagStyle } from '@/lib/tags'

const NONE = 'none'

/** An icon button that picks the colour tag of a question or group (only the editor shows it). */
export function TagPicker({ value, onChange }: { value: TagColor | undefined; onChange: (color: TagColor | undefined) => void }) {
  const { t } = useTranslation()
  const label = value ? t('editor.tagColorOf', { color: t(`editor.tagColors.${value}`) }) : t('editor.tagColor')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} title={label} className="relative" style={tagStyle(value)}>
          <PaletteIcon aria-hidden="true" />
          {value && <span className="absolute right-2 bottom-2 size-2.5 rounded-full border-2 border-card bg-(--tag)" aria-hidden="true" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel>{t('editor.tagColor')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value ?? NONE} onValueChange={(next) => onChange(next === NONE ? undefined : (next as TagColor))}>
          {[NONE, ...tagColors].map((color) => (
            <DropdownMenuRadioItem key={color} value={color} className="min-h-10">
              <span
                aria-hidden="true"
                style={tagStyle(color === NONE ? undefined : (color as TagColor))}
                className={cn('size-4 shrink-0 rounded-full', color === NONE ? 'border-2 border-dashed border-muted-foreground' : 'bg-(--tag)')}
              />
              {color === NONE ? t('editor.tagNone') : t(`editor.tagColors.${color}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

import { avatarGroups, type Avatar, type AvatarGroup } from '@quizmoo/shared'
import { ChevronDownIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

/**
 * The avatar on the join page: the chosen emoji with a button that opens the full set, grouped
 * (animals, food, fantasy, fun). Native radio buttons under the emoji tiles, so arrow keys and
 * screen readers work as with any radio group; the picked tile pops and stays raised.
 */
export function AvatarPicker({ value, onChange }: { value: Avatar; onChange: (avatar: Avatar) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">{t('join.avatar')}</legend>
      <div className="flex items-center gap-3">
        <span
          key={value}
          aria-hidden="true"
          className="grid size-14 shrink-0 animate-pop place-items-center rounded-2xl border-2 border-primary bg-primary/15 text-4xl shadow-soft"
        >
          {value}
        </span>
        <span className="min-w-0 flex-1 font-semibold">{t('join.avatar')}</span>
        <Button type="button" variant="outline" size="sm" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
          {open ? t('join.avatarDone') : t('join.avatarChange')}
          <ChevronDownIcon className={cn('transition-transform duration-300', open && 'rotate-180')} aria-hidden="true" />
        </Button>
      </div>
      {open && (
        <div id={panelId} className="flex animate-fade-up flex-col gap-3">
          {(Object.keys(avatarGroups) as AvatarGroup[]).map((group) => (
            <div key={group} className="flex flex-col gap-1.5">
              <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{t(`join.avatarGroups.${group}`)}</p>
              <div className="grid grid-cols-6 gap-1.5 min-[360px]:grid-cols-8" data-squish>
                {avatarGroups[group].map((avatar) => {
                  const checked = avatar === value
                  return (
                    <label
                      key={avatar}
                      className={cn(
                        'relative grid aspect-square cursor-pointer place-items-center rounded-xl border-2 text-2xl transition-[transform,background-color,border-color] duration-300 ease-spring select-none has-focus-visible:ring-[3px] has-focus-visible:ring-ring',
                        checked ? '-translate-y-0.5 scale-110 border-primary bg-primary/15 shadow-soft' : 'border-transparent hover:bg-secondary',
                      )}
                    >
                      <input
                        type="radio"
                        name="avatar"
                        value={avatar}
                        checked={checked}
                        onChange={() => onChange(avatar)}
                        className="sr-only"
                      />
                      {/* Screen readers name the emoji ("fox"), which labels the radio. */}
                      <span key={checked ? 'on' : 'off'} className={cn(checked && 'animate-pop')}>
                        {avatar}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  )
}

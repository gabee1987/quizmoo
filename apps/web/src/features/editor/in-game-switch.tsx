import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/cn'

export type SwitchState = 'on' | 'off' | 'mixed'

/**
 * "In the game": a question's (or a whole group's) switch. Off keeps it in the quiz, but new games
 * leave it out. A group with some questions off shows `detail` ("3 of 5 on"); switching it turns all
 * its questions on.
 */
export function InGameSwitch({ state, detail, onChange }: { state: SwitchState; detail?: string | undefined; onChange: (on: boolean) => void }) {
  const { t } = useTranslation()
  const id = useId()
  const off = state === 'off'
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border-2 py-1 pr-1.5 pl-3 transition-colors duration-300',
        off ? 'border-dashed border-muted-foreground/40 bg-muted text-muted-foreground' : 'border-success/35 bg-success/10',
      )}
    >
      {off ? <EyeOffIcon className="size-4 shrink-0" aria-hidden="true" /> : <EyeIcon className="size-4 shrink-0 text-success" aria-hidden="true" />}
      <span className="leading-tight">
        <span className="block text-sm font-extrabold">{t('editor.inGame.label')}</span>
        {detail && <span className="block text-xs font-semibold text-muted-foreground">{detail}</span>}
      </span>
      <Switch id={id} size="sm" checked={!off} onCheckedChange={(on) => onChange(state === 'mixed' ? true : on)} />
    </label>
  )
}

/** Above a switched-off question's (or group's) form: what being off means, and a way back on. */
export function OffNotice({ kind, onSwitchOn }: { kind: 'question' | 'group'; onSwitchOn: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex animate-fade-up flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed border-muted-foreground/40 bg-muted/70 p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-muted-foreground">
        <EyeOffIcon className="size-5" aria-hidden="true" />
      </span>
      <p className="min-w-0 flex-1 basis-52 leading-snug">
        <span className="block font-extrabold">{t(`editor.inGame.${kind}Off`)}</span>
        <span className="block text-sm text-muted-foreground">{t(`editor.inGame.${kind}OffHelp`)}</span>
      </p>
      <Button variant="secondary" size="sm" onClick={onSwitchOn}>
        <EyeIcon aria-hidden="true" />
        {t('editor.inGame.switchOn')}
      </Button>
    </div>
  )
}

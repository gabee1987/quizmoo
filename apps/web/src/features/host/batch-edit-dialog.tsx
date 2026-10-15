import type { GameSettings } from '@quizmoo/shared'
import { CheckIcon } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SelectField } from '../../components/select-field'
import { POINTS, TIME_LIMITS } from '../editor/question-form'
import { GameSettingsForm, gameOnlySettings, settingsError, settingsSections, type SettingsSection } from './game-settings-form'

export interface BatchPatch {
  settings: Partial<GameSettings>
  questions: { timeLimitSec?: number; points?: number }
}

type Group = SettingsSection | 'questions'
const groups: Group[] = ['look', 'scoring', 'flow', 'questions']

/**
 * Sets the same values on several quizzes. Only the groups that are ticked change; everything else
 * keeps each quiz's own value. The settings start from the first selected quiz.
 */
export function BatchEditDialog({
  count,
  initialSettings,
  pending,
  onSave,
  onCancel,
}: {
  count: number
  initialSettings: GameSettings
  pending: boolean
  onSave: (patch: BatchPatch) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [enabled, setEnabled] = useState<Set<Group>>(new Set())
  const [settings, setSettings] = useState(initialSettings)
  const [timeLimitSec, setTimeLimitSec] = useState(20)
  const [points, setPoints] = useState(1000)
  const invalid = enabled.size === 0 || (enabled.has('flow') && settingsError(settings) !== null)

  const toggle = (group: Group, on: boolean) =>
    setEnabled((current) => {
      const next = new Set(current)
      if (on) next.add(group)
      else next.delete(group)
      return next
    })

  function submit(e: FormEvent) {
    e.preventDefault()
    if (invalid) return
    const patch: BatchPatch = { settings: {}, questions: {} }
    for (const group of enabled) {
      if (group === 'questions') patch.questions = { timeLimitSec, points }
      else {
        // A quiz's saved team names (from before teams were set per game) stay as they are.
        const keys = settingsSections[group].filter((key) => !(gameOnlySettings as readonly string[]).includes(key))
        for (const key of keys) Object.assign(patch.settings, { [key]: settings[key] })
      }
    }
    onSave(patch)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <form className="flex flex-col gap-5" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{t('host.batch.editTitle', { count })}</DialogTitle>
            <DialogDescription>{t('host.batch.editHelp')}</DialogDescription>
          </DialogHeader>

          {groups.map((group) => (
            <GroupSection
              key={group}
              label={t(`host.batch.groups.${group}`)}
              description={t(`host.batch.groups.${group}Help`)}
              checked={enabled.has(group)}
              onChange={(on) => toggle(group, on)}
            >
              {group === 'questions' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    label={t('editor.timeLimit')}
                    value={timeLimitSec}
                    options={TIME_LIMITS.map((s) => ({ value: s, label: t('editor.seconds', { count: s }) }))}
                    onChange={setTimeLimitSec}
                  />
                  <SelectField
                    label={t('editor.points')}
                    value={points}
                    options={POINTS.map((p) => ({ value: p, label: t('editor.pointsValue', { count: p }) }))}
                    onChange={setPoints}
                  />
                </div>
              ) : (
                <GameSettingsForm value={settings} onChange={setSettings} sections={[group]} />
              )}
            </GroupSection>
          ))}

          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" className="flex-1" disabled={pending || invalid}>
              <CheckIcon aria-hidden="true" />
              {t('host.batch.apply', { count })}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** A ticked group shows its fields; an unticked one is left alone on every quiz. */
function GroupSection({
  label,
  description,
  checked,
  onChange,
  children,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  const id = useId()
  return (
    <section className={`rounded-2xl border-2 transition-colors ${checked ? 'border-primary' : ''}`}>
      <div className="flex items-start gap-3 p-4">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(state) => onChange(state === true)}
          aria-describedby={`${id}-help`}
          className="mt-0.5"
        />
        <div className="flex-1">
          <label htmlFor={id} className="block cursor-pointer font-bold">
            {label}
          </label>
          <p id={`${id}-help`} className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {checked && <div className="animate-fade-up px-4 pb-4">{children}</div>}
    </section>
  )
}

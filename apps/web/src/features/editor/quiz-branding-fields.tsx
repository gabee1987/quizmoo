import type { QuizBranding } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { Collapse } from '@/components/collapse'
import { TextField } from '@/components/text-field'
import { SwitchRow } from '../host/game-settings-form'
import { ImageField } from './image-field'

/**
 * The quiz's own branding in the editor's settings: on or off for its games, and a logo and event
 * name that replace the ones from My settings (left empty, those are used).
 */
export function QuizBrandingFields({ value, onChange }: { value: QuizBranding; onChange: (value: QuizBranding) => void }) {
  const { t } = useTranslation()
  const set = (patch: Partial<QuizBranding>) => onChange({ ...value, ...patch })
  return (
    // The settings tab it sits in names it.
    <div className="flex flex-col gap-2">
      <SwitchRow
        label={t('editor.branding.show')}
        description={value.show ? t('editor.branding.showHelp') : t('editor.branding.offHelp')}
        checked={value.show}
        onChange={(show) => set({ show })}
      />
      <Collapse open={value.show} innerClassName="flex flex-col gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <p className="font-semibold">{t('editor.branding.logo')}</p>
          <ImageField
            showLabel={false}
            imageId={value.logoImageId ?? undefined}
            label={t('editor.branding.logo')}
            onChange={(logoImageId) => set({ logoImageId: logoImageId ?? null })}
          />
          <p className="text-sm text-muted-foreground">{t('editor.branding.logoHelp')}</p>
        </div>
        <div className="flex flex-col gap-1">
          <TextField
            label={t('editor.branding.eventName')}
            value={value.eventName}
            maxLength={60}
            placeholder={t('settings.branding.eventNamePlaceholder')}
            autoComplete="off"
            onChange={(e) => set({ eventName: e.target.value })}
          />
          <p className="text-sm text-muted-foreground">{t('editor.branding.eventNameHelp')}</p>
        </div>
      </Collapse>
    </div>
  )
}

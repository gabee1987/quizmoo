import type { BrandingChoice } from '@quizmoo/shared'
import { Link } from '@tanstack/react-router'
import { ImagePlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Collapse } from '@/components/collapse'
import { TextField } from '@/components/text-field'
import { SwitchRow } from './game-settings-form'

/**
 * The new game dialog's branding: the event name for this game and where the logo and the name
 * show. The logo itself is set in the quiz's settings or on My settings.
 */
export function BrandingFields({
  value,
  logoImageId,
  offInQuiz,
  onChange,
}: {
  value: BrandingChoice
  /** The quiz's logo, else the one from My settings. */
  logoImageId: string | null
  /** The quiz's settings turn branding off; it can still be turned on for this game. */
  offInQuiz: boolean
  onChange: (value: BrandingChoice) => void
}) {
  const { t } = useTranslation()
  const set = (patch: Partial<BrandingChoice>) => onChange({ ...value, ...patch })
  const nothing = !logoImageId && !value.eventName.trim()
  const showHelp = nothing ? 'nothing' : offInQuiz && !value.show ? 'offInQuiz' : 'showHelp'
  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border p-4">
      <legend className="px-1 text-lg font-extrabold">{t('host.create.branding.title')}</legend>
      <div className="flex flex-wrap items-end gap-3">
        {logoImageId ? (
          <span className="flex rounded-xl border bg-white p-1.5">
            <img src={`/api/images/${logoImageId}`} alt={t('branding.logo')} className="h-12 max-w-36 object-contain" />
          </span>
        ) : (
          <Link
            to="/host/settings"
            search={{ tab: 'branding' }}
            className="flex min-h-12 items-center gap-2 rounded-xl border-2 border-dashed border-input px-3 text-sm font-semibold text-muted-foreground outline-none hover:border-ring hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
          >
            <ImagePlusIcon className="size-5" aria-hidden="true" />
            {t('host.create.branding.addLogo')}
          </Link>
        )}
        <TextField
          className="min-w-48 flex-1"
          label={t('host.create.branding.eventName')}
          value={value.eventName}
          maxLength={60}
          placeholder={t('settings.branding.eventNamePlaceholder')}
          autoComplete="off"
          onChange={(e) => set({ eventName: e.target.value })}
        />
      </div>
      <div className="flex flex-col">
        <SwitchRow
          label={t('host.create.branding.show')}
          description={t(`host.create.branding.${showHelp}`)}
          checked={value.show}
          onChange={(show) => set({ show })}
        />
        <Collapse open={value.show}>
          <SwitchRow
            label={t('host.create.branding.onPhones')}
            description={t('host.create.branding.onPhonesHelp')}
            checked={value.onPhones}
            onChange={(onPhones) => set({ onPhones })}
          />
        </Collapse>
      </div>
    </fieldset>
  )
}

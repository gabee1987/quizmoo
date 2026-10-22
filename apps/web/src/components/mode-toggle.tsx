import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { modes, setMode, useMode } from '@/lib/mode'

const icons = { light: SunIcon, dark: MoonIcon, system: MonitorIcon } as const

/**
 * Light, dark or system colour mode for this device; each press moves to the next one.
 * A plain button rather than a menu: it is on every screen, phones included, and stays out of the entry bundle's way.
 */
export function ModeToggle() {
  const { t } = useTranslation()
  const { mode } = useMode()
  const Icon = icons[mode]
  const next = modes[(modes.indexOf(mode) + 1) % modes.length]!
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`${t('app.mode')}: ${t(`app.modes.${mode}`)}`}
      title={`${t('app.mode')}: ${t(`app.modes.${mode}`)}`}
      onClick={() => setMode(next)}
    >
      <Icon aria-hidden="true" />
    </Button>
  )
}

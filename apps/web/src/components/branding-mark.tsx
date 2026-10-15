import type { BrandingPublic } from '@quizmoo/shared'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'

const sizes = {
  /** The phones' lobby: small, above the player's card. */
  phone: { root: 'flex-col gap-2', tile: 'rounded-xl p-1.5', logo: 'max-h-14 max-w-48', name: 'text-base font-extrabold' },
  /** The projector's lobby, next to the QR code. */
  lobby: { root: 'gap-5', tile: 'rounded-2xl p-3', logo: 'max-h-32 max-w-[26rem]', name: 'text-5xl font-black' },
  /** Above the podium, out of the way of the pillars. */
  podium: { root: 'justify-center gap-4', tile: 'rounded-2xl p-2', logo: 'max-h-20 max-w-72', name: 'text-3xl font-extrabold' },
}

/**
 * The host's logo and the event name. The logo sits on a white tile in both colour modes (like
 * the QR code), since logos are made for a light background.
 */
export function BrandingMark({ branding, size, className }: { branding: BrandingPublic; size: keyof typeof sizes; className?: string }) {
  const { t } = useTranslation()
  if (!branding.logoImageId && !branding.eventName) return null
  const s = sizes[size]
  return (
    <div className={cn('flex flex-wrap items-center', s.root, className)}>
      {branding.logoImageId && (
        <span className={cn('flex animate-pop bg-white shadow-soft', s.tile)}>
          <img src={`/api/images/${branding.logoImageId}`} alt={t('branding.logo')} className={cn('w-auto object-contain', s.logo)} />
        </span>
      )}
      {branding.eventName && <p className={cn('min-w-0 wrap-break-word', s.name)}>{branding.eventName}</p>}
    </div>
  )
}

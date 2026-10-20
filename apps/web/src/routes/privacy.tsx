import { MIN_HOST_AGE } from '@quizmoo/shared'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { LegalPage, LegalSections, type LegalSection } from '../features/legal/legal-page'
import { PLAYER_SEAT_DAYS } from '../lib/player-storage'

export const Route = createFileRoute('/privacy')({ component: PrivacyPage })

/** The GDPR Article 13 notice: what is stored, why, how long, who gets it, and your rights. */
function PrivacyPage() {
  const { t } = useTranslation()
  return (
    <LegalPage title={t('legal.privacy.title')} intro={t('legal.privacy.intro')} operator>
      {(site) => (
        <LegalSections
          sections={
            t('legal.privacy.sections', {
              returnObjects: true,
              days: site.retentionDays,
              signupDays: 7,
              sessionDays: 30,
              seatDays: PLAYER_SEAT_DAYS,
              age: MIN_HOST_AGE,
              hosting: site.hosting ?? t('legal.operator.hostingUnknown'),
            }) as LegalSection[]
          }
        />
      )}
    </LegalPage>
  )
}

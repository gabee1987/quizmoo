import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { LegalPage } from '../features/legal/legal-page'

export const Route = createFileRoute('/imprint')({ component: ImprintPage })

/** Who runs this install; a non-commercial hobby service, so no company register or tax number. */
function ImprintPage() {
  const { t } = useTranslation()
  return (
    <LegalPage title={t('legal.imprint.title')} intro={t('legal.imprint.intro')} operator>
      {() => (
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          {(t('legal.imprint.items', { returnObjects: true }) as string[]).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </LegalPage>
  )
}

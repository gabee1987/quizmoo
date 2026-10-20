import { MIN_HOST_AGE, TERMS_VERSION } from '@quizmoo/shared'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { LegalPage, LegalSections, type LegalSection } from '../features/legal/legal-page'

export const Route = createFileRoute('/terms')({ component: TermsPage })

/** The terms of use hosts accept at sign-up (and again when `TERMS_VERSION` changes). */
function TermsPage() {
  const { t } = useTranslation()
  return (
    <LegalPage title={t('legal.terms.title')} intro={t('legal.terms.intro')} operator>
      {() => (
        <>
          <p className="-mt-2 text-sm font-semibold text-muted-foreground">{t('legal.terms.version', { version: TERMS_VERSION })}</p>
          <LegalSections sections={t('legal.terms.sections', { returnObjects: true, age: MIN_HOST_AGE }) as LegalSection[]} />
        </>
      )}
    </LegalPage>
  )
}

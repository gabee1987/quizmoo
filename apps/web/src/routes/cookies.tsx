import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { LegalPage } from '../features/legal/legal-page'
import { storedItems } from '../lib/storage-inventory'

export const Route = createFileRoute('/cookies')({ component: CookiesPage })

/** Every cookie and storage entry, from the inventory a test keeps in step with the code. */
function CookiesPage() {
  const { t } = useTranslation()
  return (
    <LegalPage title={t('legal.cookies.title')} intro={t('legal.cookies.intro')}>
      {() => (
        <>
          {/* A list of cards rather than a table: four columns of prose do not fit a phone. */}
          <ul className="flex flex-col gap-3" aria-label={t('legal.cookies.title')}>
            {storedItems.map((item) => (
              <li key={item.name} className="flex flex-col gap-1.5 rounded-2xl border p-4">
                <code className="font-mono text-sm font-bold break-all">{item.name}</code>
                <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                  <span>
                    {t('legal.cookies.columns.kind')}: {t(`legal.cookies.kinds.${item.kind}`)}
                  </span>
                  <span>
                    {t('legal.cookies.columns.who')}: {t(`legal.cookies.who.${item.who}`)}
                  </span>
                </p>
                <p>{t(`legal.cookies.items.${item.id}`)}</p>
              </li>
            ))}
          </ul>
          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-extrabold">{t('legal.cookies.removeTitle')}</h2>
            <p>{t('legal.cookies.remove')}</p>
          </section>
        </>
      )}
    </LegalPage>
  )
}

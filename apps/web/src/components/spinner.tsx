import { useTranslation } from 'react-i18next'

export function Spinner() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-1 items-center justify-center" role="status" aria-label={t('common.loading')}>
      <div className="size-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  )
}

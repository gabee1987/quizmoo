import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/form-alert'
import { Spinner } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { LibraryQuestionEditor } from '@/features/bank/library-question-editor'
import { bankItemQueryOptions } from '@/features/bank/queries'
import { ApiError } from '@/lib/api'

export const Route = createFileRoute('/host/library/$questionId')({
  component: LibraryQuestionPage,
})

function LibraryQuestionPage() {
  const { t } = useTranslation()
  const { questionId } = Route.useParams()
  const item = useQuery({ ...bankItemQueryOptions(questionId), retry: false })
  if (item.isPending) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner />
      </div>
    )
  }
  if (item.isError) {
    // A quiz's link can outlive the library question it pointed to.
    const missing = item.error instanceof ApiError && item.error.status === 404
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-start gap-4">
        <FormAlert>{missing ? t('bank.page.missing') : t('errors.internal')}</FormAlert>
        <Button variant="outline" asChild>
          <Link to="/host/library">{t('bank.page.back')}</Link>
        </Button>
      </div>
    )
  }
  // Keyed, so moving between two questions starts the form afresh.
  return <LibraryQuestionEditor key={item.data.id} item={item.data} />
}

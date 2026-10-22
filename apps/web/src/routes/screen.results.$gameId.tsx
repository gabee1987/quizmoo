import type { GameResults } from '@quizmoo/shared'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Spinner } from '../components/spinner'
import { ScreenSummary } from '../features/screen/summary'
import { apiFetch, errorCode } from '../lib/api'

export const Route = createFileRoute('/screen/results/$gameId')({
  component: SummaryPage,
})

/**
 * Projector summary of a game's results. Opened from the results page, so it needs the
 * host's session in this browser: results are never public.
 */
function SummaryPage() {
  const { t } = useTranslation()
  const { gameId } = Route.useParams()
  const results = useQuery({
    queryKey: ['results', gameId],
    queryFn: () => apiFetch<GameResults>(`/api/games/${gameId}/results`),
    retry: false,
  })

  if (results.isPending) return <Spinner />
  if (results.isError) {
    return <p className="flex flex-1 items-center justify-center text-4xl font-bold">{t(errorCode(results.error))}</p>
  }
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col px-4 py-4 lg:px-12">
      <ScreenSummary results={results.data} />
    </div>
  )
}

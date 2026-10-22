import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Loader2Icon, RotateCcwIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { apiFetch } from '../../lib/api'
import { toastError } from '../../lib/toast'

/**
 * "Play again" after a finished game: a new lobby with the same quiz and settings. The old
 * game's phones get "Join the next round" and its projector follows; the host moves there too.
 */
export function PlayAgainButton({ gameId }: { gameId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const again = useMutation({
    mutationFn: () => apiFetch<{ pin: string }>(`/api/games/${gameId}/again`, { method: 'POST' }),
    onSuccess: ({ pin }) => void navigate({ to: '/host/games/$pin', params: { pin } }),
    onError: toastError,
  })
  return (
    <Button size="lg" variant="secondary" disabled={again.isPending} onClick={() => again.mutate()}>
      {again.isPending ? <Loader2Icon className="animate-spin" aria-hidden="true" /> : <RotateCcwIcon aria-hidden="true" />}
      {t('host.game.playAgain')}
    </Button>
  )
}

import type { GameHistoryItem } from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { BarChart3Icon, GamepadIcon, HistoryIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/form-alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toastError } from '@/lib/toast'
import { ConfirmDialog } from '../../components/dialog'
import { apiFetch } from '../../lib/api'

export const Route = createFileRoute('/host/games/')({
  component: GameHistory,
})

/** Joining has not opened yet: the game is waiting for its time. */
const isScheduled = (game: GameHistoryItem, now: number) =>
  game.phase === 'lobby' && game.scheduledAt !== null && Date.parse(game.scheduledAt) > now

/**
 * The host's games: scheduled ones first (soonest first), then the rest newest first. Open the
 * results, delete a finished game or call off a scheduled one. A table on laptops, cards on phones.
 */
function GameHistory() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const games = useQuery({
    queryKey: ['games'],
    queryFn: async () => (await apiFetch<{ games: GameHistoryItem[] }>('/api/games')).games,
  })
  const [deleting, setDeleting] = useState<GameHistoryItem | null>(null)
  const remove = useMutation({
    mutationFn: (game: GameHistoryItem) => apiFetch(`/api/games/${game.gameId}`, { method: 'DELETE' }),
    onSuccess: (_data, game) => {
      setDeleting(null)
      queryClient.removeQueries({ queryKey: ['results', game.gameId] })
      void queryClient.invalidateQueries({ queryKey: ['games'] })
    },
    onError: toastError,
  })
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
  const now = Date.now()
  const scheduled = (games.data ?? []).filter((game) => isScheduled(game, now))
  scheduled.sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!))
  const rows = [...scheduled, ...(games.data ?? []).filter((game) => !isScheduled(game, now))]
  /** A scheduled game shows when it starts; the others when they were created. */
  const date = (game: GameHistoryItem) => dateFormat.format(new Date(isScheduled(game, now) ? game.scheduledAt! : game.createdAt))

  const actions = (game: GameHistoryItem) => (
    <>
      {game.phase !== 'finished' && (
        <Button asChild variant="secondary" size="sm">
          <Link to="/host/games/$pin" params={{ pin: game.pin }}>
            <GamepadIcon aria-hidden="true" />
            {t('history.control')}
          </Link>
        </Button>
      )}
      {!isScheduled(game, now) && (
        <Button asChild variant="outline" size="sm">
          <Link to="/host/results/$gameId" params={{ gameId: game.gameId }}>
            <BarChart3Icon aria-hidden="true" />
            {t('history.results')}
          </Link>
        </Button>
      )}
      {(game.phase === 'finished' || isScheduled(game, now)) && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${isScheduled(game, now) ? t('history.cancel') : t('common.delete')}: ${game.quizTitle}`}
          onClick={() => setDeleting(game)}
        >
          <Trash2Icon aria-hidden="true" />
        </Button>
      )}
    </>
  )
  const status = (game: GameHistoryItem) =>
    isScheduled(game, now) ? (
      <Badge variant="outline">{t('history.scheduled')}</Badge>
    ) : (
      <Badge variant={game.phase === 'finished' ? 'secondary' : 'default'}>{t(`host.game.phase.${game.phase}`)}</Badge>
    )

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <h1 className="text-3xl font-black tracking-tight">{t('history.title')}</h1>

      {games.isPending && (
        <div className="flex flex-col gap-2" role="status" aria-label={t('common.loading')}>
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      )}
      {games.isError && <FormAlert>{t('errors.internal')}</FormAlert>}
      {games.data?.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-12 text-center text-muted-foreground">
          <HistoryIcon className="size-8 text-primary" aria-hidden="true" />
          <p className="font-semibold">{t('history.empty')}</p>
        </div>
      )}

      {games.data && games.data.length > 0 && (
        <>
          {/* Laptop */}
          <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-soft md:block">
            <table className="w-full text-left">
              <thead className="bg-muted text-sm text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-bold">{t('history.quiz')}</th>
                  <th className="px-4 py-3 font-bold">{t('history.date')}</th>
                  <th className="px-4 py-3 font-bold">{t('history.mode')}</th>
                  <th className="px-4 py-3 text-right font-bold">{t('history.playerCount')}</th>
                  <th className="px-4 py-3 font-bold">{t('history.status')}</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">{t('common.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((game) => (
                  <tr key={game.gameId} className="border-t">
                    <td className="max-w-64 px-4 py-3 font-bold wrap-break-word">{game.quizTitle}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-muted-foreground">
                      {date(game)}
                    </td>
                    <td className="px-4 py-3 text-sm">{t(`host.create.modes.${game.mode}`)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{game.playerCount}</td>
                    <td className="px-4 py-3">{status(game)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">{actions(game)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone */}
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((game) => (
              <li key={game.gameId} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-lg leading-snug font-extrabold wrap-break-word">{game.quizTitle}</p>
                  {status(game)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {date(game)}
                  {' · '}
                  {t(`host.create.modes.${game.mode}`)}
                  {' · '}
                  {t('history.players', { count: game.playerCount })}
                </p>
                <div className="flex flex-wrap gap-2">{actions(game)}</div>
              </li>
            ))}
          </ul>
        </>
      )}

      {deleting && (
        <ConfirmDialog
          title={isScheduled(deleting, now) ? t('history.cancelTitle') : t('history.deleteTitle')}
          confirmLabel={isScheduled(deleting, now) ? t('history.cancel') : t('common.delete')}
          danger
          pending={remove.isPending}
          onConfirm={() => remove.mutate(deleting)}
          onCancel={() => {
            setDeleting(null)
            remove.reset()
          }}
        >
          {t(isScheduled(deleting, now) ? 'history.cancelBody' : 'history.deleteBody', { title: deleting.quizTitle, date: date(deleting) })}
        </ConfirmDialog>
      )}
    </div>
  )
}

import { GAME_SEARCH_MIN, type GameHistoryItem, type GameHistoryPage } from '@quizmoo/shared'
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { BarChart3Icon, GamepadIcon, HistoryIcon, SearchIcon, Trash2Icon, UserIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormAlert } from '@/components/form-alert'
import { SelectField } from '@/components/select-field'
import { Spinner } from '@/components/spinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { isScheduled } from '@/features/host/dashboard'
import { hasFilters, historyPeriods, historyQuery, historySearchSchema, searchText, type HistorySearch } from '@/features/host/history'
import { gameSummaryQueryOptions } from '@/features/host/queries'
import { cn } from '@/lib/cn'
import { stagger } from '@/lib/motion'
import { toastError } from '@/lib/toast'
import { ConfirmDialog } from '../../components/dialog'
import { apiFetch } from '../../lib/api'

export const Route = createFileRoute('/host/games/')({
  validateSearch: historySearchSchema,
  component: GameHistory,
})

/** Typing waits this long before the search runs (and goes into the address). */
const SEARCH_DELAY_MS = 300

/**
 * The host's games, newest start first (scheduled games at the top), loaded a page at a time while
 * scrolling. Search by title or PIN and filter by state and period; the filters live in the address.
 * Open the results, delete a finished game or call off a scheduled one. A table on laptops, cards on phones.
 */
function GameHistory() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const filtered = hasFilters(search)
  const setSearch = (next: Partial<HistorySearch>) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true })

  const [text, setText] = useState(search.q ?? '')
  const tooShort = text.trim().length > 0 && text.trim().length < GAME_SEARCH_MIN
  useEffect(() => {
    // One or two letters would match nearly everything: no request until the third.
    const q = searchText(text)
    if (q === search.q) return
    const timer = setTimeout(() => setSearch({ q }), SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [text])

  const games = useInfiniteQuery({
    queryKey: ['games', 'history', search],
    // The signal cancels a page still loading once the search changes.
    queryFn: ({ pageParam, signal }) =>
      apiFetch<GameHistoryPage>(`/api/games?${historyQuery(search, pageParam, Date.now())}`, { signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // The list on screen stays (faded) while the next search loads, instead of blinking to a skeleton.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  const summary = useQuery(gameSummaryQueryOptions)
  const rows = games.data?.pages.flatMap((page) => page.games) ?? []
  // Rows come in one after another, counted within their page, so a page loaded while scrolling does not wait behind the ones before it.
  const entrance = new Map(games.data?.pages.flatMap((page) => page.games.map((game, i) => [game.gameId, stagger(Math.min(i, 12), 40, 120)] as const)))

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
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight">{t('history.title')}</h1>
        {summary.data && (
          <p className="text-sm text-muted-foreground">
            {t('history.keep', { count: summary.data.keep.days, days: summary.data.keep.days, max: summary.data.keep.max })}
          </p>
        )}
      </div>

      <div className="flex animate-fade-up flex-col gap-3 sm:flex-row sm:items-start" role="search">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor="history-search" className="text-sm font-semibold">
            {t('history.search')}
          </Label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="history-search"
              type="search"
              value={text}
              placeholder={t('history.searchPlaceholder')}
              autoComplete="off"
              enterKeyHint="search"
              className="pl-11"
              aria-describedby="history-search-hint"
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <p id="history-search-hint" className="text-sm text-muted-foreground" aria-live="polite">
            {tooShort ? t('history.searchMin', { count: GAME_SEARCH_MIN }) : t('history.searchHint')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <SelectField
            label={t('history.state')}
            value={search.state ?? 'all'}
            options={(['all', 'running', 'finished'] as const).map((value) => ({ value, label: t(`history.states.${value}`) }))}
            onChange={(value) => setSearch({ state: value === 'all' ? undefined : value })}
            className="sm:w-40"
          />
          <SelectField
            label={t('history.period')}
            value={search.period ?? 'any'}
            options={(['any', ...historyPeriods] as const).map((value) => ({ value, label: t(`history.periods.${value}`) }))}
            onChange={(value) => setSearch({ period: value === 'any' ? undefined : value })}
            className="sm:w-44"
          />
        </div>
      </div>

      {games.isPending && (
        <div className="flex animate-fade-up flex-col gap-2" style={stagger(1)} role="status" aria-label={t('common.loading')}>
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      )}
      {games.isError && <FormAlert>{t('errors.internal')}</FormAlert>}
      {games.isSuccess && rows.length === 0 && (
        <div
          className="flex animate-fade-up flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center text-muted-foreground"
          style={stagger(1)}
        >
          <HistoryIcon className="size-8 text-primary" aria-hidden="true" />
          <p className="font-semibold">{filtered ? t('history.noMatches') : t('history.empty')}</p>
          {filtered && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setText('')
                setSearch({ q: undefined, state: undefined, period: undefined })
              }}
            >
              <XIcon aria-hidden="true" />
              {t('history.clearFilters')}
            </Button>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div
          className={cn('flex flex-col gap-5 transition-opacity duration-200', games.isPlaceholderData && 'opacity-60')}
          aria-busy={games.isFetching || undefined}
        >
          {/* Laptop */}
          <div className="hidden animate-fade-up overflow-hidden rounded-2xl border bg-card shadow-soft md:block" style={stagger(1)}>
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
                  <tr key={game.gameId} className="animate-fade-up border-t" style={entrance.get(game.gameId)}>
                    <td className="max-w-64 px-4 py-3 wrap-break-word">
                      <p className="font-bold">{game.quizTitle}</p>
                      <MatchedPlayers names={game.matchedPlayers} />
                    </td>
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
              <li key={game.gameId} className="flex animate-fade-up flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft" style={entrance.get(game.gameId)}>
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
                <MatchedPlayers names={game.matchedPlayers} />
                <div className="flex flex-wrap gap-2">{actions(game)}</div>
              </li>
            ))}
          </ul>

          {games.hasNextPage && !games.isPlaceholderData && (
            <LoadMore loading={games.isFetchingNextPage} onLoad={() => void games.fetchNextPage()} label={t('history.loadMore')} />
          )}
        </div>
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

/** The players a search found in this game, so it is clear why the game is listed. */
function MatchedPlayers({ names }: { names: string[] | undefined }) {
  const { t } = useTranslation()
  if (!names?.length) return null
  return (
    <p className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-primary dark:text-ring">
      <UserIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 wrap-break-word">{t('history.matchedPlayers', { count: names.length, names: names.join(', ') })}</span>
    </p>
  )
}

/**
 * Loads the next page when it comes near the screen; the button does the same for the keyboard,
 * and for browsers without IntersectionObserver.
 */
function LoadMore({ loading, onLoad, label }: { loading: boolean; onLoad: () => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const load = useRef(onLoad)
  load.current = onLoad
  // Observed again after each page, so a page too short to push this out of view loads the next one too.
  useEffect(() => {
    const el = ref.current
    if (loading || !el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && load.current(), { rootMargin: '400px 0px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [loading])
  return (
    <div ref={ref} className="flex justify-center">
      <Button variant="outline" disabled={loading} onClick={onLoad}>
        {loading && <Spinner />}
        {label}
      </Button>
    </div>
  )
}

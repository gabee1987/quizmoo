import type { GameResults } from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeftIcon, DownloadIcon, ListChecksIcon, MonitorIcon, ShieldIcon, Trash2Icon, UsersIcon } from 'lucide-react'
import { FormAlert } from '@/components/form-alert'
import { Button } from '@/components/ui/button'
import { toastError } from '@/lib/toast'
import { ConfirmDialog } from '../../components/dialog'
import { Spinner } from '../../components/spinner'
import { PlayerTable, TeamTable } from '../../features/results/player-table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QuestionStats } from '../../features/results/question-stats'
import { ResultsHero } from '../../features/results/results-hero'
import { QuestionHighlights } from '../../features/results/results-summary'
import { questionRuns } from '../../features/results/summary'
import { WinnerCard } from '../../features/results/winner-card'
import { apiFetch, errorCode } from '../../lib/api'

export const Route = createFileRoute('/host/results/$gameId')({
  component: ResultsPage,
})

type Audience = 'screen' | 'players'

/** Held final results, released from here as from the host control (projector podium, players' phones). */
function ReleaseButtons({ gameId, pending }: { gameId: string; pending: GameResults['pendingRelease'] }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const release = useMutation({
    mutationFn: (audience: Audience) =>
      apiFetch(`/api/games/${gameId}/release`, { method: 'POST', body: JSON.stringify({ audience }) }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['results', gameId] }),
    onError: toastError,
  })
  if (!pending.screen && !pending.players) return null
  const hint =
    pending.screen && pending.players
      ? 'host.game.resultsPendingHint'
      : pending.players
        ? 'host.game.playersWaitingHint'
        : 'host.game.podiumPendingHint'
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-warning px-4 py-3 text-warning-foreground">
      <p className="font-semibold">{t(hint)}</p>
      <div className="flex flex-wrap gap-2">
        {pending.screen && (
          <Button disabled={release.isPending} onClick={() => release.mutate('screen')}>
            {t('host.game.showPodium')}
          </Button>
        )}
        {pending.players && (
          <Button disabled={release.isPending} onClick={() => release.mutate('players')}>
            {t('host.game.releaseToPlayers')}
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * A game's results: the header card (quiz, PIN, figures, actions), who won and the easiest and hardest
 * question, then the players, the teams and the questions in tabs.
 */
function ResultsPage() {
  const { t, i18n } = useTranslation()
  const { gameId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const results = useQuery({
    queryKey: ['results', gameId],
    queryFn: () => apiFetch<GameResults>(`/api/games/${gameId}/results`),
    retry: false,
  })
  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/games/${gameId}`, { method: 'DELETE' }),
    // Leave the page before dropping its data: a mounted results query would fetch the deleted game again.
    onSuccess: async () => {
      await navigate({ to: '/host/games' })
      queryClient.removeQueries({ queryKey: ['results', gameId] })
      void queryClient.invalidateQueries({ queryKey: ['games'] })
    },
    onError: toastError,
  })

  if (results.isPending) return <Spinner />
  if (results.isError) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <FormAlert>{t(errorCode(results.error))}</FormAlert>
        <Button asChild variant="secondary" className="self-start">
          <Link to="/host/games">{t('results.backToGames')}</Link>
        </Button>
      </div>
    )
  }

  const data = results.data
  const lang = i18n.language.startsWith('en') ? 'en' : 'hu'
  const teamMode = data.mode === 'team'
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(data.startedAt ?? data.createdAt)
  // Counts only from `sm`: on phones the tabs hold the icon and the label.
  const count = (n: number) => <span className="rounded-full bg-current/15 px-2 py-0.5 text-xs tabular-nums max-sm:hidden">{n}</span>

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link to="/host/games">
          <ArrowLeftIcon aria-hidden="true" />
          {t('results.backToGames')}
        </Link>
      </Button>

      <ResultsHero
        results={data}
        actions={
          <>
            <Button asChild>
              <a href={`/api/games/${gameId}/results.csv?lang=${lang}`} download>
                <DownloadIcon aria-hidden="true" />
                {t('results.exportCsv')}
              </a>
            </Button>
            <Button asChild variant="secondary">
              <a href={`/screen/results/${gameId}`} target="_blank" rel="noreferrer">
                <MonitorIcon aria-hidden="true" />
                {t('results.showOnScreen')}
              </a>
            </Button>
            {data.phase === 'finished' && (
              <Button variant="outline" className="text-destructive sm:ml-auto" onClick={() => setConfirming(true)}>
                <Trash2Icon aria-hidden="true" />
                {t('results.delete')}
              </Button>
            )}
          </>
        }
      />

      {data.phase !== 'finished' && (
        <p className="rounded-2xl bg-warning px-4 py-3 font-semibold text-warning-foreground">{t('results.running')}</p>
      )}
      <ReleaseButtons gameId={gameId} pending={data.pendingRelease} />

      {/* Who won and what was easy or hard first; the full tables below. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <WinnerCard results={data} />
        <QuestionHighlights results={data} />
      </div>

      <Tabs defaultValue="players" className="gap-4">
        <TabsList variant="bold" aria-label={t('results.details')}>
          <TabsTrigger value="players">
            <UsersIcon aria-hidden="true" />
            {t('results.players')}
            {count(data.players.length)}
          </TabsTrigger>
          {teamMode && (
            <TabsTrigger value="teams">
              <ShieldIcon aria-hidden="true" />
              {t('results.teams')}
              {count(data.teams.length)}
            </TabsTrigger>
          )}
          <TabsTrigger value="questions">
            <ListChecksIcon aria-hidden="true" />
            {t('results.questions')}
            {count(data.questions.length)}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="players">
          <PlayerTable players={data.players} teams={teamMode ? data.teams : []} hideHeading />
        </TabsContent>
        {teamMode && (
          <TabsContent value="teams">
            <TeamTable teams={data.teams} hideHeading />
          </TabsContent>
        )}
        <TabsContent value="questions">
          {data.questions.length === 0 ? (
            <p className="text-muted-foreground">{t('results.noQuestions')}</p>
          ) : (
            // One list per run of a group's questions, under the group's number and title.
            <div className="flex flex-col gap-6">
              {questionRuns(data).map((run) => {
                const list = (
                  <ol className="grid gap-3 xl:grid-cols-2">
                    {run.questions.map((question) => (
                      <QuestionStats key={question.question.id} question={question} playerCount={data.players.length} teams={data.teams} />
                    ))}
                  </ol>
                )
                if (!run.group) return <div key={run.questions[0]!.question.id}>{list}</div>
                const first = run.questions[0]!.index + 1
                const last = run.questions.at(-1)!.index + 1
                return (
                  <section key={run.group.id} aria-labelledby={`results-group-${run.group.id}`} className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
                      <span className="text-sm font-bold text-muted-foreground">{t('play.roundShort', { index: run.group.number })}</span>
                      <h3 id={`results-group-${run.group.id}`} className="text-lg font-extrabold">
                        {run.group.title}
                      </h3>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {first === last ? t('editor.questionN', { n: first }) : t('play.questionRange', { first, last })}
                      </span>
                    </div>
                    {list}
                  </section>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {confirming && (
        <ConfirmDialog
          title={t('history.deleteTitle')}
          confirmLabel={t('common.delete')}
          danger
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
          onCancel={() => {
            setConfirming(false)
            remove.reset()
          }}
        >
          {t('history.deleteBody', { title: data.quizTitle, date })}
        </ConfirmDialog>
      )}
    </div>
  )
}

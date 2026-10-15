import { nicknameLanguages, type NicknameLanguage } from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { RotateCcwIcon, SaveIcon } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FormAlert } from '@/components/form-alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '../../components/dialog'
import { ApiError, apiFetch, errorCode } from '../../lib/api'
import { toastError } from '../../lib/toast'

interface NicknameList {
  names: string[]
  /** False while the built-in list is in use. */
  custom: boolean
}

export const Route = createFileRoute('/host/nicknames')({
  component: NicknamesPage,
})

/** Admin only (the API enforces it): the names "Surprise me" offers on the join page, per language. */
function NicknamesPage() {
  const { t, i18n } = useTranslation()
  const lists = useQuery({
    queryKey: ['nicknames'],
    queryFn: async () => (await apiFetch<{ lists: Record<NicknameLanguage, NicknameList> }>('/api/nicknames')).lists,
    retry: false,
  })

  if (lists.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <FormAlert>{t(errorCode(lists.error))}</FormAlert>
        <Button asChild variant="secondary">
          <Link to="/host/quizzes">{t('host.game.backToQuizzes')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight">{t('nicknames.title')}</h1>
        <p className="text-muted-foreground">{t('nicknames.help')}</p>
      </div>
      {lists.isPending ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        <Tabs defaultValue={i18n.language.startsWith('en') ? 'en' : 'hu'} className="gap-4">
          <TabsList>
            {nicknameLanguages.map((language) => (
              <TabsTrigger key={language} value={language}>
                {t(`nicknames.languages.${language}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          {nicknameLanguages.map((language) => (
            <TabsContent key={language} value={language}>
              {/* Keyed by the stored list, so the text resets after a save or a restore. */}
              <ListEditor key={lists.data[language].names.join('\n')} language={language} list={lists.data[language]} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}

/** Lines as the server receives them: trimmed, blank ones dropped. */
const toNames = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

function ListEditor({ language, list }: { language: NicknameLanguage; list: NicknameList }) {
  const { t } = useTranslation()
  const id = useId()
  const queryClient = useQueryClient()
  const [text, setText] = useState(list.names.join('\n'))
  const [restoring, setRestoring] = useState(false)
  const [problems, setProblems] = useState<{ name: string; error: string }[]>([])
  const names = toNames(text)
  const changed = names.join('\n') !== list.names.join('\n')
  const tooLong = names.filter((name) => name.length > 24)

  const done = (key: string) => {
    void queryClient.invalidateQueries({ queryKey: ['nicknames'] })
    toast.success(t(key))
  }
  const save = useMutation({
    mutationFn: () => apiFetch(`/api/nicknames/${language}`, { method: 'PUT', body: JSON.stringify({ names }) }),
    onMutate: () => setProblems([]),
    onSuccess: () => done('nicknames.saved'),
    onError: (error) => {
      // Issues point at the names sent: "names.3" is the fourth line that is not blank.
      const issues = error instanceof ApiError ? error.issues : []
      const found = issues.flatMap(({ path, code }) => {
        const name = names[Number(path.split('.')[1])]
        if (name === undefined) return []
        return [{ name, error: code === 'too_big' ? 'nicknames.tooLong' : 'errors.nameNotAllowed' }]
      })
      if (found.length > 0) setProblems(found)
      else toastError(error)
    },
  })
  const restore = useMutation({
    mutationFn: () => apiFetch(`/api/nicknames/${language}`, { method: 'DELETE' }),
    onSuccess: () => {
      setRestoring(false)
      done('nicknames.restored')
    },
    onError: toastError,
  })

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className="font-semibold">
          {t('nicknames.label')}
        </Label>
        <div className="flex items-center gap-2">
          <Badge variant={list.custom ? 'default' : 'secondary'}>{list.custom ? t('nicknames.custom') : t('nicknames.builtIn')}</Badge>
          <span className="text-sm font-semibold text-muted-foreground tabular-nums">{t('nicknames.count', { count: names.length })}</span>
        </div>
      </div>
      <Textarea
        id={id}
        value={text}
        rows={14}
        spellCheck={false}
        aria-describedby={`${id}-hint`}
        aria-invalid={problems.length > 0 || tooLong.length > 0 ? true : undefined}
        onChange={(e) => {
          setText(e.target.value)
          setProblems([])
        }}
      />
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
        {t('nicknames.hint')}
      </p>
      {(problems.length > 0 || tooLong.length > 0) && (
        <FormAlert>
          <ul className="flex flex-col gap-1">
            {[...tooLong.map((name) => ({ name, error: 'nicknames.tooLong' })), ...problems.filter((p) => p.name.length <= 24)].map((p) => (
              <li key={p.name}>
                <span className="font-bold">„{p.name}”</span>: {t(p.error)}
              </li>
            ))}
          </ul>
        </FormAlert>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!changed || names.length === 0 || tooLong.length > 0 || save.isPending} onClick={() => save.mutate()}>
          <SaveIcon aria-hidden="true" />
          {t('nicknames.save')}
        </Button>
        {list.custom && (
          <Button variant="outline" onClick={() => setRestoring(true)}>
            <RotateCcwIcon aria-hidden="true" />
            {t('nicknames.restore')}
          </Button>
        )}
      </div>
      {restoring && (
        <ConfirmDialog
          title={t('nicknames.restoreTitle')}
          confirmLabel={t('nicknames.restore')}
          pending={restore.isPending}
          onConfirm={() => restore.mutate()}
          onCancel={() => setRestoring(false)}
        >
          {t('nicknames.restoreBody')}
        </ConfirmDialog>
      )}
    </div>
  )
}

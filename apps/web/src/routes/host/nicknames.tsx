import { nicknameLanguages, type NicknameLanguage } from '@quizmoo/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useBlocker } from '@tanstack/react-router'
import { PlusIcon, RotateCcwIcon, SearchIcon } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/dialog'
import { FormAlert } from '@/components/form-alert'
import { UnsavedBar } from '@/components/unsaved-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApiError, apiFetch, errorCode } from '@/lib/api'
import { cn } from '@/lib/cn'
import { useFlip } from '@/lib/flip'
import { toastError } from '@/lib/toast'
import { newId } from '../../features/editor/draft'
import { MAX_NAMES, MAX_NAME_LENGTH, addNames, changed, matches, problemOf, type NameEntry } from '../../features/nicknames/draft'
import { NameRow } from '../../features/nicknames/name-row'

interface SavedList {
  names: string[]
  /** The avatar each name gets, null when none fits. */
  avatars: (string | null)[]
  /** False while the built-in list is in use. */
  custom: boolean
}
type Lists = Record<NicknameLanguage, SavedList>
type Drafts = Record<NicknameLanguage, NameEntry[]>

export const Route = createFileRoute('/host/nicknames')({
  component: NicknamesPage,
})

/** Admin only (the API enforces it): the names "Surprise me" offers on the join page, per language. */
function NicknamesPage() {
  const { t } = useTranslation()
  const lists = useQuery({
    queryKey: ['nicknames'],
    queryFn: async () => (await apiFetch<{ lists: Lists }>('/api/nicknames')).lists,
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight">{t('nicknames.title')}</h1>
        <p className="text-muted-foreground">{t('nicknames.help')}</p>
      </div>
      {lists.isPending ? <Skeleton className="h-96 rounded-2xl" /> : <NamesEditor saved={lists.data} />}
    </div>
  )
}

const toDrafts = (lists: Lists): Drafts =>
  Object.fromEntries(
    nicknameLanguages.map((language) => [
      language,
      lists[language].names.map((name, i) => ({ key: newId(), name, avatar: lists[language].avatars[i] ?? null, allowed: true })),
    ]),
  ) as Drafts

/** Both languages' lists as one draft, saved together from the unsaved changes bar. */
function NamesEditor({ saved }: { saved: Lists }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState(() => toDrafts(saved))
  // A save or a restore brings new lists from the server: start a fresh draft from them.
  const [base, setBase] = useState(saved)
  if (JSON.stringify(saved) !== JSON.stringify(base)) {
    setBase(saved)
    setDrafts(toDrafts(saved))
  }
  const [language, setLanguage] = useState<NicknameLanguage>(i18n.language.startsWith('en') ? 'en' : 'hu')
  const [restoring, setRestoring] = useState<NicknameLanguage | null>(null)

  const dirty = nicknameLanguages.filter((l) => changed(drafts[l], saved[l].names))
  const problem = nicknameLanguages.some((l) => drafts[l].length === 0)
    ? 'nicknames.problems.empty'
    : nicknameLanguages.some((l) => drafts[l].some((entry) => problemOf(entry, drafts[l])))
      ? 'nicknames.problems.bar'
      : null

  const update = (lang: NicknameLanguage, change: (entries: NameEntry[]) => NameEntry[]) =>
    setDrafts((d) => ({ ...d, [lang]: change(d[lang]) }))

  /** Asks the server for the avatar of each new or renamed name and whether the join filter allows it. */
  async function check(lang: NicknameLanguage, entries: NameEntry[]) {
    if (entries.length === 0) return
    const fill = (results: { avatar: string | null; allowed: boolean }[]) =>
      update(lang, (list) =>
        list.map((entry) => {
          const i = entries.findIndex((e) => e.key === entry.key && e.name === entry.name)
          return i < 0 ? entry : { ...entry, avatar: results[i]!.avatar, allowed: results[i]!.allowed }
        }),
      )
    try {
      const { results } = await apiFetch<{ results: { avatar: string | null; allowed: boolean }[] }>('/api/nicknames/check', {
        method: 'POST',
        body: JSON.stringify({ names: entries.map((e) => e.name) }),
      })
      fill(results)
    } catch (error) {
      // Saving checks the names again, so the rows just stop waiting.
      fill(entries.map(() => ({ avatar: null, allowed: true })))
      toastError(error)
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      for (const lang of dirty) {
        const names = drafts[lang].map((entry) => entry.name)
        try {
          await apiFetch(`/api/nicknames/${lang}`, { method: 'PUT', body: JSON.stringify({ names }) })
        } catch (error) {
          // Issues point at the names sent ("names.3"): mark those rows and show that language.
          const refused = new Set(
            (error instanceof ApiError ? error.issues : []).map(({ path }) => Number(path.split('.')[1])).filter(Number.isInteger),
          )
          if (refused.size === 0) throw error
          update(lang, (list) => list.map((entry, i) => (refused.has(i) ? { ...entry, allowed: false } : entry)))
          setLanguage(lang)
          throw new ApiError(400, 'nicknames.problems.bar')
        }
      }
    },
    onSuccess: () => {
      toast.success(t('nicknames.saved'))
      void queryClient.invalidateQueries({ queryKey: ['nicknames'] })
    },
    onError: toastError,
  })
  const restore = useMutation({
    mutationFn: (lang: NicknameLanguage) => apiFetch(`/api/nicknames/${lang}`, { method: 'DELETE' }),
    onSuccess: () => {
      setRestoring(null)
      toast.success(t('nicknames.restored'))
      void queryClient.invalidateQueries({ queryKey: ['nicknames'] })
    },
    onError: toastError,
  })

  const blocker = useBlocker({ shouldBlockFn: () => dirty.length > 0, enableBeforeUnload: () => dirty.length > 0, withResolver: true })

  return (
    <>
      <Tabs value={language} onValueChange={(value) => setLanguage(value as NicknameLanguage)} className="gap-0">
        <section className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft">
          <div className="border-b bg-muted/60 p-2">
            <TabsList className="h-auto! w-full gap-1 rounded-xl bg-transparent p-0">
              {nicknameLanguages.map((lang) => (
                <TabsTrigger
                  key={lang}
                  value={lang}
                  className={cn(
                    'min-h-11 gap-2 rounded-xl text-base font-extrabold data-[state=inactive]:text-foreground!',
                    'transition-[color,background-color,box-shadow,transform] duration-300 ease-spring hover:bg-card/60',
                    'data-[state=active]:border-transparent! data-[state=active]:bg-primary! data-[state=active]:text-primary-foreground!',
                    'data-[state=active]:shadow-[0_3px_0_0_var(--primary-edge)]! data-[state=active]:-translate-y-px',
                  )}
                >
                  {t(`nicknames.languages.${lang}`)}
                  <span className="text-sm font-bold tabular-nums">{drafts[lang].length}</span>
                  {dirty.includes(lang) && (
                    <span className="size-2 rounded-full bg-warning" title={t('settings.unsaved')}>
                      <span className="sr-only">({t('settings.unsaved')})</span>
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {nicknameLanguages.map((lang) => (
            // origin-top: the panel's squash and stretch scales with its height, and a list of a few
            // hundred names would fling its top far above the card from a centre origin.
            <TabsContent key={lang} value={lang} className="origin-top p-4 sm:p-5">
              <LanguageNames
                entries={drafts[lang]}
                custom={saved[lang].custom}
                onEntries={(change) => update(lang, change)}
                onCheck={(entries) => void check(lang, entries)}
                onRestore={() => setRestoring(lang)}
              />
            </TabsContent>
          ))}
        </section>
      </Tabs>

      <UnsavedBar
        dirty={dirty.length > 0}
        problem={problem}
        saving={save.isPending}
        onSave={() => save.mutate()}
        onDiscard={() => setDrafts(toDrafts(saved))}
      />

      {restoring && (
        <ConfirmDialog
          title={t('nicknames.restoreTitle', { language: t(`nicknames.languages.${restoring}`) })}
          confirmLabel={t('nicknames.restore')}
          pending={restore.isPending}
          onConfirm={() => restore.mutate(restoring)}
          onCancel={() => setRestoring(null)}
        >
          {t('nicknames.restoreBody')}
        </ConfirmDialog>
      )}
      {blocker.status === 'blocked' && (
        <ConfirmDialog
          title={t('settings.leaveTitle')}
          confirmLabel={t('editor.leave')}
          danger
          onConfirm={blocker.proceed}
          onCancel={blocker.reset}
        >
          {t('settings.leaveBody')}
        </ConfirmDialog>
      )}
    </>
  )
}

/** One language's names: add (one or a pasted list), search, and the rows. */
function LanguageNames({
  entries,
  custom,
  onEntries,
  onCheck,
  onRestore,
}: {
  entries: NameEntry[]
  custom: boolean
  onEntries: (change: (entries: NameEntry[]) => NameEntry[]) => void
  onCheck: (entries: NameEntry[]) => void
  onRestore: () => void
}) {
  const { t } = useTranslation()
  const addId = useId()
  const searchId = useId()
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [note, setNote] = useState<string | null>(null)
  // Rows added in this visit pop in; the others are just there.
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set())
  const list = useRef<HTMLUListElement>(null)
  const flip = useFlip(list)
  const full = entries.length >= MAX_NAMES
  const shown = query.trim() ? entries.filter((entry) => matches(entry.name, query)) : entries

  function add(value: string) {
    const result = addNames(entries, value, newId)
    const fresh = result.entries.slice(0, result.added.length)
    flip()
    onEntries(() => result.entries)
    setAdded((keys) => new Set([...keys, ...fresh.map((e) => e.key)]))
    onCheck(fresh)
    setText('')
    setQuery('')
    const parts = [
      result.added.length > 0 && t('nicknames.note.added', { count: result.added.length }),
      result.duplicates > 0 && t('nicknames.note.duplicates', { count: result.duplicates }),
      result.noRoom > 0 && t('nicknames.note.noRoom', { count: result.noRoom, max: MAX_NAMES }),
    ].filter(Boolean)
    setNote(parts.join(' '))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={custom ? 'default' : 'secondary'}>{custom ? t('nicknames.custom') : t('nicknames.builtIn')}</Badge>
        <span className="text-sm font-semibold text-muted-foreground tabular-nums">
          {t('nicknames.count', { count: entries.length, max: MAX_NAMES })}
        </span>
        {custom && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onRestore}>
            <RotateCcwIcon aria-hidden="true" />
            {t('nicknames.restore')}
          </Button>
        )}
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          if (text.trim()) add(text)
        }}
      >
        <label htmlFor={addId} className="font-semibold">
          {t('nicknames.addLabel')}
        </label>
        <div className="flex gap-2">
          <Input
            id={addId}
            value={text}
            disabled={full}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${addId}-hint`}
            placeholder={full ? t('nicknames.full', { max: MAX_NAMES }) : t('nicknames.addPlaceholder')}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              // A one-line field would drop the line breaks of a pasted list: add the lines instead.
              const pasted = e.clipboardData.getData('text')
              if (!/\r?\n/.test(pasted.trim())) return
              e.preventDefault()
              add(pasted)
            }}
          />
          <Button type="submit" variant="secondary" disabled={full || !text.trim()}>
            <PlusIcon aria-hidden="true" />
            <span className="max-sm:sr-only">{t('nicknames.add')}</span>
          </Button>
        </div>
        <p id={`${addId}-hint`} className="text-sm text-muted-foreground">
          {t('nicknames.addHint', { max: MAX_NAME_LENGTH })}
        </p>
        <p role="status" className="min-h-5 text-sm font-semibold text-success empty:min-h-0">
          {note}
        </p>
      </form>

      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          {t('nicknames.search')}
        </label>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id={searchId}
          type="search"
          value={query}
          autoComplete="off"
          placeholder={t('nicknames.search')}
          className="pl-9"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {query.trim() && (
        <p className="-mt-2 text-sm font-semibold text-muted-foreground" role="status">
          {t('nicknames.found', { count: shown.length, total: entries.length })}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
          {entries.length === 0 ? t('nicknames.empty') : t('nicknames.noMatch')}
        </p>
      ) : (
        <ul ref={list} className="grid grid-cols-1 items-start gap-2 sm:grid-cols-2" aria-label={t('nicknames.listLabel')}>
          {shown.map((entry) => (
            <NameRow
              key={entry.key}
              entry={entry}
              problem={problemOf(entry, entries)}
              entering={added.has(entry.key)}
              onRename={(name) => {
                const renamed = { ...entry, name, avatar: undefined, allowed: undefined }
                onEntries((all) => all.map((e) => (e.key === entry.key ? renamed : e)))
                onCheck([renamed])
              }}
              onRemove={() => {
                flip()
                onEntries((all) => all.filter((e) => e.key !== entry.key))
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

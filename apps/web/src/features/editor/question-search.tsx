import type { QuestionGroup } from '@quizmoo/shared'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { LayersIcon, SearchIcon, SearchXIcon, XIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { tagStyle } from '@/lib/tags'
import { listItems, searchLayout, type Layout } from './draft'
import { QuestionRow } from './question-list'

/** The search box above the editor's question list; Escape clears it. */
export function SearchField({ value, onChange, className }: { value: string; onChange: (value: string) => void; className?: string }) {
  const { t } = useTranslation()
  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault()
            onChange('')
          }
        }}
        placeholder={t('editor.search.placeholder')}
        aria-label={t('editor.search.label')}
        autoComplete="off"
        enterKeyHint="search"
        className={cn('h-11 rounded-lg pr-9 pl-9 text-sm [&::-webkit-search-cancel-button]:hidden', className)}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('editor.search.clear')}
          className="absolute top-1/2 right-1 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

/**
 * The questions and groups matching the search, in list order, as plain rows: clicking one selects it,
 * the eye switches it. No dragging while a search narrows the list.
 */
export function SearchResults({
  layout,
  query,
  selectedId,
  invalidIds,
  onSelect,
  onSwitch,
}: {
  layout: Layout
  query: string
  selectedId: string | null
  invalidIds: ReadonlySet<string>
  onSelect: (id: string) => void
  onSwitch: (id: string, on: boolean) => void
}) {
  const { t } = useTranslation()
  const found = useMemo(() => searchLayout(layout, query), [layout, query])
  const rows = useMemo(() => {
    const questions = new Set(found.questions.map((q) => q.id))
    const groups = new Set(found.groups.map((g) => g.id))
    return listItems(layout).filter((i) => (i.kind === 'question' ? questions.has(i.question.id) : i.kind === 'group' && groups.has(i.group.id)))
  }, [layout, found])
  const groupsById = useMemo(() => new Map(layout.groups.map((g) => [g.id, g])), [layout.groups])

  if (rows.length === 0) {
    return (
      <p className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
        <SearchXIcon className="size-6" aria-hidden="true" />
        {t('editor.search.none', { query: query.trim() })}
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      <p className="px-1 text-xs font-bold text-muted-foreground" role="status">
        {t('editor.search.count', { count: rows.length })}
      </p>
      <ol className="flex flex-col gap-1.5" aria-label={t('editor.search.results')}>
        {rows.map((item) =>
          item.kind === 'question' ? (
            <li key={item.question.id}>
              <QuestionRow
                question={item.question}
                index={layout.questions.indexOf(item.question)}
                selected={item.question.id === selectedId}
                invalid={invalidIds.has(item.question.id)}
                group={item.question.groupId ? groupsById.get(item.question.groupId) : undefined}
                onSelect={() => onSelect(item.question.id)}
                onSwitch={(on) => onSwitch(item.question.id, on)}
              />
            </li>
          ) : item.kind === 'group' ? (
            <li key={item.group.id}>
              <GroupResult
                group={item.group}
                index={layout.groups.indexOf(item.group)}
                selected={item.group.id === selectedId}
                onSelect={() => onSelect(item.group.id)}
              />
            </li>
          ) : null,
        )}
      </ol>
    </div>
  )
}

function GroupResult({ group, index, selected, onSelect }: { group: QuestionGroup; index: number; selected: boolean; onSelect: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      style={tagStyle(group.color)}
      className={cn(
        'flex min-h-14 w-full items-center gap-2.5 rounded-xl border-2 px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring',
        selected
          ? 'border-primary bg-[color-mix(in_srgb,var(--primary)_14%,var(--card))] shadow-[inset_5px_0_0_0_var(--primary)]'
          : 'border-(--tag)/40 bg-(--tag)/10 hover:border-(--tag)/70',
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-(--tag)/25">
        <LayersIcon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-extrabold text-foreground/75">{t('editor.groupN', { n: index + 1 })}</span>
        <span className="line-clamp-2 text-sm leading-snug font-black wrap-break-word">{group.title}</span>
      </span>
    </button>
  )
}

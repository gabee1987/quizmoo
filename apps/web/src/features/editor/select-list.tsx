import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { LayersIcon } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/cn'
import { tagStyle } from '@/lib/tags'
import { listItems, type Layout } from './draft'
import { QuestionRow } from './question-list'

/**
 * The editor's select mode: the questions in list order with a checkbox each, rounds as headers whose
 * checkbox ticks all their questions. Clicking a row ticks it too. No dragging while selecting.
 */
export function SelectList({
  layout,
  picked,
  invalidIds,
  onToggle,
}: {
  layout: Layout
  picked: ReadonlySet<string>
  invalidIds: ReadonlySet<string>
  /** Ticks (`on`) or unticks these questions. */
  onToggle: (ids: string[], on: boolean) => void
}) {
  const { t } = useTranslation()
  const items = useMemo(() => listItems(layout), [layout])
  const members = useMemo(() => {
    const members = new Map<string, string[]>()
    for (const q of layout.questions) if (q.groupId) members.set(q.groupId, [...(members.get(q.groupId) ?? []), q.id])
    return members
  }, [layout.questions])

  return (
    <ol className="flex flex-col gap-1.5" aria-label={t('editor.select.list')}>
      {items.map((item) => {
        if (item.kind === 'end') return null
        if (item.kind === 'group') {
          const ids = members.get(item.group.id) ?? []
          const count = ids.filter((id) => picked.has(id)).length
          const n = layout.groups.indexOf(item.group) + 1
          const state = ids.length > 0 && count === ids.length ? true : count > 0 ? 'indeterminate' : false
          return (
            <li key={item.group.id} className="pt-1.5 first:pt-0">
              <label
                style={tagStyle(item.group.color)}
                className={cn(
                  'flex min-h-12 items-center gap-2 rounded-xl border-2 border-(--tag)/40 bg-(--tag)/10 px-2 py-1.5',
                  ids.length > 0 ? 'cursor-pointer hover:border-(--tag)/70' : 'opacity-60',
                )}
              >
                <Checkbox
                  checked={state}
                  disabled={ids.length === 0}
                  onCheckedChange={() => onToggle(ids, state !== true)}
                  aria-label={t('editor.select.groupN', { n, title: item.group.title })}
                />
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-(--tag)/25" aria-hidden="true">
                  <LayersIcon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold text-foreground/75">
                    {t('editor.groupN', { n })} · {t('editor.questionCount', { count: ids.length })}
                  </span>
                  <span className="line-clamp-2 text-sm leading-snug font-black wrap-break-word">{item.group.title}</span>
                </span>
              </label>
            </li>
          )
        }
        const { question } = item
        const index = layout.questions.indexOf(question)
        const on = picked.has(question.id)
        const group = question.groupId ? layout.groups.find((g) => g.id === question.groupId) : undefined
        return (
          <li key={question.id} style={tagStyle(group?.color)} className={cn(group && 'ml-2 border-l-2 border-(--tag)/50 pl-2')}>
            <QuestionRow
              question={question}
              index={index}
              selected={on}
              invalid={invalidIds.has(question.id)}
              group={undefined}
              onSelect={() => onToggle([question.id], !on)}
              handle={
                <span className="flex w-9 shrink-0 items-center justify-center self-stretch">
                  <Checkbox
                    checked={on}
                    onCheckedChange={(checked) => onToggle([question.id], checked === true)}
                    aria-label={t('editor.select.questionN', { n: index + 1 })}
                  />
                </span>
              }
            />
          </li>
        )
      })}
    </ol>
  )
}

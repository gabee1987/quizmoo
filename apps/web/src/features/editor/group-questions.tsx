import type { Question } from '@quizmoo/shared'
import { DndContext, DragOverlay, closestCenter, type UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCallback, useState, type KeyboardEventHandler, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDownIcon, ArrowUpIcon, EyeOffIcon, GripVerticalIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { dragMove, useSortableAccessibility, useSortableSensors } from '@/lib/sortable'
import { tagStyle } from '@/lib/tags'
import { typeIcons } from './type-picker'

/**
 * The "Questions" tab of a group: its questions in order, to drag (or move with the arrows) into a new
 * order inside the group, and to open one for editing.
 */
export function GroupQuestions({
  questions,
  numberOf,
  invalidIds,
  onOpen,
  onMove,
  onAdd,
}: {
  questions: readonly Question[]
  /** The question's place in the whole quiz, from 0. */
  numberOf: (id: string) => number
  invalidIds: ReadonlySet<string>
  onOpen: (id: string) => void
  /** Moves the question at `from` to `to`, both indexes within the group. */
  onMove: (from: number, to: number) => void
  /** Null when the quiz has as many questions as it may. */
  onAdd: (() => void) | null
}) {
  const { t } = useTranslation()
  const sensors = useSortableSensors()
  const ids = questions.map((q) => q.id)
  const name = useCallback((id: UniqueIdentifier) => t('editor.questionN', { n: numberOf(String(id)) + 1 }), [numberOf, t])
  const accessibility = useSortableAccessibility(ids, name)
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = questions.find((q) => q.id === activeId)

  return (
    <div className="flex flex-col gap-3">
      {questions.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed p-4 text-center text-sm text-muted-foreground">{t('editor.groupNoQuestions')}</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={accessibility}
          onDragStart={({ active }) => setActiveId(String(active.id))}
          onDragCancel={() => setActiveId(null)}
          onDragEnd={(event) => {
            setActiveId(null)
            const moved = dragMove(ids, event)
            if (moved) onMove(moved.from, moved.to)
          }}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-2" aria-label={t('editor.groupTabs.questions', { count: questions.length })}>
              {questions.map((question, i) => (
                <Row
                  key={question.id}
                  question={question}
                  number={numberOf(question.id)}
                  invalid={invalidIds.has(question.id)}
                  first={i === 0}
                  last={i === questions.length - 1}
                  onOpen={() => onOpen(question.id)}
                  onStep={(by) => onMove(i, i + by)}
                />
              ))}
            </ol>
          </SortableContext>
          <DragOverlay>
            {active && <Card question={active} number={numberOf(active.id)} invalid={invalidIds.has(active.id)} className="rotate-1 shadow-lg ring-2 ring-primary" />}
          </DragOverlay>
        </DndContext>
      )}
      {onAdd && (
        <Button variant="secondary" className="self-start" onClick={onAdd}>
          <PlusIcon aria-hidden="true" />
          {t('editor.addQuestionToGroup')}
        </Button>
      )}
    </div>
  )
}

function Row({
  question,
  number,
  invalid,
  first,
  last,
  onOpen,
  onStep,
}: {
  question: Question
  number: number
  invalid: boolean
  first: boolean
  last: boolean
  onOpen: () => void
  onStep: (by: -1 | 1) => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: question.id })
  const { onKeyDown, ...pointerListeners } = listeners ?? {}
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('touch-manipulation', isDragging && 'opacity-30')}
      {...pointerListeners}
    >
      <Card
        question={question}
        number={number}
        invalid={invalid}
        onOpen={onOpen}
        handle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            onKeyDown={onKeyDown as KeyboardEventHandler | undefined}
            aria-label={t('editor.dragQuestion', { n: number + 1 })}
            className="flex h-12 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring active:cursor-grabbing"
          >
            <GripVerticalIcon className="size-4" aria-hidden="true" />
          </button>
        }
        actions={
          <>
            <Button variant="ghost" size="icon-sm" aria-label={t('editor.moveUp')} title={t('editor.moveUp')} disabled={first} onClick={() => onStep(-1)}>
              <ArrowUpIcon aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={t('editor.moveDown')} title={t('editor.moveDown')} disabled={last} onClick={() => onStep(1)}>
              <ArrowDownIcon aria-hidden="true" />
            </Button>
          </>
        }
      />
    </li>
  )
}

function Card({
  question,
  number,
  invalid,
  onOpen,
  handle,
  actions,
  className,
}: {
  question: Question
  number: number
  invalid: boolean
  onOpen?: () => void
  handle?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  const Icon = typeIcons[question.type]
  return (
    <div
      style={tagStyle(question.color)}
      className={cn(
        'relative flex items-center gap-1 overflow-hidden rounded-xl border-2 pr-2 pl-1 hover:border-ring',
        question.off ? 'border-dashed border-muted-foreground/35 bg-transparent' : 'bg-card',
        className,
      )}
    >
      {question.color && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-(--tag)" />}
      {handle ?? (
        <span className="flex h-12 w-8 shrink-0 items-center justify-center text-muted-foreground">
          <GripVerticalIcon className="size-4" aria-hidden="true" />
        </span>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-lg py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        <span className="relative grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
          {invalid && (
            <span className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-card bg-destructive">
              <span className="sr-only">{t('editor.needsFixing')}</span>
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-muted-foreground tabular-nums">
            {number + 1} · {t(`questionTypes.${question.type}`)} · {t('editor.seconds', { count: question.timeLimitSec })}
            {question.off && (
              <>
                {' · '}
                <EyeOffIcon className="inline size-3 align-[-0.1em]" aria-hidden="true" /> {t('editor.inGame.offBadge')}
              </>
            )}
          </span>
          <span className={cn('line-clamp-2 leading-snug font-bold wrap-break-word', question.off && 'text-muted-foreground')}>
            {question.text || <span className="text-muted-foreground italic">{t('editor.untitledQuestion')}</span>}
          </span>
        </span>
        {question.imageId && <img src={`/api/images/${question.imageId}`} alt="" className="h-10 w-14 shrink-0 rounded-md border bg-muted object-cover" />}
      </button>
      {actions}
    </div>
  )
}

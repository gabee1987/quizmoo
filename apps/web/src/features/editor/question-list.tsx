import type { Question } from '@quizmoo/shared'
import { DndContext, DragOverlay, closestCenter, type UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCallback, useMemo, useRef, useState, type KeyboardEventHandler, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { GripVerticalIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useFlipOnReorder } from '@/lib/flip'
import { dragMove, useSortableAccessibility, useSortableSensors } from '@/lib/sortable'
import { typeIcons } from './type-picker'

/**
 * The quiz's questions as a sortable list: drag a row with the mouse, press and hold it on a
 * touch screen, or focus its handle and use Space, the arrows and Space. Clicking a row selects it.
 */
export function QuestionList({
  questions,
  selectedId,
  invalidIds,
  onSelect,
  onMove,
}: {
  questions: Question[]
  selectedId: string | null
  /** Questions to mark with a red dot. */
  invalidIds: ReadonlySet<string>
  onSelect: (id: string) => void
  onMove: (from: number, to: number) => void
}) {
  const { t } = useTranslation()
  const sensors = useSortableSensors()
  const ids = useMemo(() => questions.map((q) => q.id), [questions])
  const name = useCallback((id: UniqueIdentifier) => t('editor.questionN', { n: ids.indexOf(String(id)) + 1 }), [ids, t])
  const accessibility = useSortableAccessibility(ids, name)
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeIndex = activeId ? ids.indexOf(activeId) : -1
  // Moves from the toolbar or the shortcuts slide the rows into place; a drag animates itself.
  const listRef = useRef<HTMLOListElement>(null)
  const dragged = useRef(false)
  useFlipOnReorder(listRef, ids.join(), selectedId, dragged)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={accessibility}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={(event) => {
        setActiveId(null)
        const moved = dragMove(ids, event)
        if (moved) {
          dragged.current = true
          onMove(moved.from, moved.to)
        }
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol ref={listRef} className="flex flex-col gap-1.5" aria-label={t('editor.questionCount', { count: questions.length })}>
          {questions.map((question, index) => (
            <SortableRow
              key={question.id}
              question={question}
              index={index}
              selected={question.id === selectedId}
              invalid={invalidIds.has(question.id)}
              onSelect={() => onSelect(question.id)}
            />
          ))}
        </ol>
      </SortableContext>
      <DragOverlay>
        {activeIndex >= 0 && (
          <RowBody
            question={questions[activeIndex]!}
            index={activeIndex}
            selected={questions[activeIndex]!.id === selectedId}
            invalid={invalidIds.has(questions[activeIndex]!.id)}
            className="rotate-1 shadow-lg ring-2 ring-primary"
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}

function SortableRow({
  question,
  index,
  selected,
  invalid,
  onSelect,
}: {
  question: Question
  index: number
  selected: boolean
  invalid: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  })
  // Mouse and touch drag the whole row; the keyboard drags from the handle, so Space on the row's
  // select button still selects.
  const { onKeyDown, ...pointerListeners } = listeners ?? {}
  return (
    <li
      ref={setNodeRef}
      data-flip-id={question.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('touch-manipulation', isDragging && 'opacity-30')}
      {...pointerListeners}
    >
      <RowBody
        question={question}
        index={index}
        selected={selected}
        invalid={invalid}
        onSelect={onSelect}
        handle={
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            onKeyDown={onKeyDown as KeyboardEventHandler | undefined}
            aria-label={t('editor.dragQuestion', { n: index + 1 })}
            className="flex h-12 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring active:cursor-grabbing"
          >
            <GripVerticalIcon className="size-4" aria-hidden="true" />
          </button>
        }
      />
    </li>
  )
}

/** A row's look, shared by the list and the drag overlay. */
function RowBody({
  question,
  index,
  selected,
  invalid,
  onSelect,
  handle,
  className,
}: {
  question: Question
  index: number
  selected: boolean
  invalid: boolean
  onSelect?: () => void
  handle?: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  const Icon = typeIcons[question.type]
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-xl border-2 bg-card pr-2 transition-colors',
        selected ? 'border-primary bg-secondary' : 'border-transparent hover:border-border',
        className,
      )}
    >
      {handle ?? (
        <span className="flex h-12 w-7 shrink-0 items-center justify-center text-muted-foreground">
          <GripVerticalIcon className="size-4" aria-hidden="true" />
        </span>
      )}
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        <span
          className={cn(
            'relative grid size-9 shrink-0 place-items-center rounded-lg',
            selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {invalid && (
            <span className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-card bg-destructive">
              <span className="sr-only">{t('editor.needsFixing')}</span>
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-muted-foreground tabular-nums">
            {index + 1} · {t(`questionTypes.${question.type}`)}
          </span>
          <span className="line-clamp-2 text-sm leading-snug font-bold wrap-break-word">
            {question.text || <span className="text-muted-foreground italic">{t('editor.untitledQuestion')}</span>}
          </span>
        </span>
        {question.imageId && (
          <img src={`/api/images/${question.imageId}`} alt="" className="h-9 w-12 shrink-0 rounded-md border bg-muted object-cover" />
        )}
      </button>
    </div>
  )
}

import { DndContext, closestCenter, type UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Answer, Option } from '@quizmoo/shared'
import { ChevronDownIcon, ChevronUpIcon, GripVerticalIcon, Loader2Icon } from 'lucide-react'
import { useCallback, useRef, useState, type KeyboardEventHandler } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { useFlip } from '@/lib/flip'
import { dragMove, useInstantSortableSensors, useSortableAccessibility } from '@/lib/sortable'
import { stagger } from '../../lib/motion'
import { move } from '../editor/draft'
import type { QuestionProps } from './types'

/**
 * "Put in order": the items arrive shuffled; the player drags them (or uses the arrows) into
 * order and sends. On the projector the same list is shown read-only.
 */
export function OrderAnswer({ question, mode, disabled, pending, large, initial, onSubmit }: QuestionProps<'order'>) {
  const { t } = useTranslation()
  const [items, setItems] = useState<Option[]>(() => initialOrder(question.options, initial))
  // The editor's preview edits the items live; in a game they never change, so a player's order stays.
  const signature = question.options.map((o) => `${o.id}:${o.text}`).join('|')
  const [shownSignature, setShownSignature] = useState(signature)
  if (signature !== shownSignature) {
    setShownSignature(signature)
    setItems(question.options)
  }
  const sensors = useInstantSortableSensors()
  const ids = items.map((o) => o.id)
  const name = useCallback((id: UniqueIdentifier) => items.find((o) => o.id === id)?.text ?? String(id), [items])
  const accessibility = useSortableAccessibility(ids, name)
  const answering = mode === 'answer'
  const locked = !answering || disabled
  // The arrows slide the two items past each other; a drag animates itself.
  const listRef = useRef<HTMLOListElement>(null)
  const flip = useFlip(listRef)

  const list = (
    <ol ref={listRef} className={cn('flex flex-col', large ? 'gap-4' : 'gap-2.5')}>
      {items.map((item, index) => (
        <OrderItem
          key={item.id}
          item={item}
          index={index}
          count={items.length}
          large={large ?? false}
          locked={locked ?? false}
          onMove={(to) => {
            flip(item.id)
            setItems((current) => move(current, index, to))
          }}
        />
      ))}
    </ol>
  )

  return (
    <div className="flex flex-1 flex-col gap-3">
      {answering && <p className="text-center text-sm text-muted-foreground">{t('play.orderHint')}</p>}
      {locked ? (
        list
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          accessibility={accessibility}
          onDragEnd={(event) => {
            const moved = dragMove(ids, event)
            if (moved) setItems((current) => move(current, moved.from, moved.to))
          }}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {list}
          </SortableContext>
        </DndContext>
      )}
      {answering && (
        <Button size="lg" disabled={disabled} onClick={() => onSubmit?.({ type: 'order', optionIds: ids })}>
          {pending && <Loader2Icon className="animate-spin" aria-hidden="true" />}
          {t('play.confirm')}
        </Button>
      )}
    </div>
  )
}

/** The options in the order the player sent before, if any. */
function initialOrder(options: Option[], initial: Answer | null | undefined): Option[] {
  if (initial?.type !== 'order') return options
  return initial.optionIds.flatMap((id) => options.filter((o) => o.id === id))
}

function OrderItem({
  item,
  index,
  count,
  large,
  locked,
  onMove,
}: {
  item: Option
  index: number
  count: number
  large: boolean
  locked: boolean
  onMove: (to: number) => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: locked,
  })
  // The whole item starts a pointer drag; the handle stays the keyboard's (and screen reader's) control,
  // so no button sits inside another interactive element.
  const { onKeyDown, ...pointerListeners } = listeners ?? {}
  // The entrance pop runs once. A dropped item is moved in the DOM, which would restart a CSS animation
  // and make the list look reloaded, so the class goes once it has played.
  const [entered, setEntered] = useState(false)
  const arrow =
    'flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-25'
  return (
    // The pop runs on the wrapper: the sortable transform on the item would cancel it.
    <li
      data-flip-id={item.id}
      className={cn(!entered && 'animate-pop')}
      style={entered ? undefined : stagger(index, 70, 150)}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setEntered(true)
      }}
    >
      <div
        ref={setNodeRef}
        {...(locked ? {} : pointerListeners)}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        className={cn(
          'flex items-center gap-2 rounded-2xl border-2 bg-card font-bold shadow-soft',
          large ? 'gap-4 px-5 py-4 text-3xl' : 'p-2 text-lg',
          !locked && 'cursor-grab touch-none select-none active:cursor-grabbing',
          isDragging && 'relative z-10 scale-[1.02] border-primary shadow-lg',
        )}
      >
        {!locked && (
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            onKeyDown={onKeyDown as KeyboardEventHandler<HTMLButtonElement> | undefined}
            aria-label={t('play.dragItem', { item: item.text })}
            className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-muted-foreground outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring active:cursor-grabbing"
          >
            <GripVerticalIcon className="size-5" aria-hidden="true" />
          </button>
        )}
        <span
          className={cn(
            'grid shrink-0 place-items-center rounded-xl bg-secondary font-black text-secondary-foreground tabular-nums',
            large ? 'size-14' : 'size-9 text-base',
          )}
        >
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 wrap-break-word">{item.text}</span>
        {!locked && (
          <span className="flex shrink-0">
            <button
              type="button"
              className={arrow}
              disabled={index === 0}
              aria-label={t('play.moveUp', { item: item.text })}
              onClick={() => onMove(index - 1)}
            >
              <ChevronUpIcon className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={arrow}
              disabled={index === count - 1}
              aria-label={t('play.moveDown', { item: item.text })}
              onClick={() => onMove(index + 1)}
            >
              <ChevronDownIcon className="size-5" aria-hidden="true" />
            </button>
          </span>
        )}
      </div>
    </li>
  )
}

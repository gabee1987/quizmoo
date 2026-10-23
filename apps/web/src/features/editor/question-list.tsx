import type { Question, QuestionGroup, TagColor } from '@quizmoo/shared'
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  closestCenter,
  useDroppable,
  type CollisionDetection,
  type DragOverEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEventHandler, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ChevronDownIcon, ChevronsDownUpIcon, ChevronsUpDownIcon, GripVerticalIcon, LayersIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { useFlipOnReorder } from '@/lib/flip'
import { useSortableAccessibility, useSortableSensors } from '@/lib/sortable'
import { tagColor, tagStyle } from '@/lib/tags'
import { endId, itemId, listItems, placeQuestion, type Layout } from './draft'
import { typeIcons } from './type-picker'

type Side = 'before' | 'after'
interface Target {
  targetId: string
  side: Side
}

const TRASH = 'trash'
/** How far left of where it started the pointer must go before the trash takes the item. */
const TRASH_PULL = 12
/** The trash panel's width in px (`w-13`). */
const TRASH_WIDTH = 52
/** How a group's rows grow and shrink when it opens or closes. */
const GROW = 'grid-template-rows 300ms cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * A group is one card in its colour: its header is the top, its end row the rounded bottom, and its
 * questions' rows carry the sides between them. Closed, the rows shrink to nothing and the bottom
 * slides up to the header.
 */
const frame = (selected: boolean) => cn('bg-(--frame)/10', selected ? 'border-(--frame)' : 'border-(--frame)/40')
const frameStyle = (group: QuestionGroup) => ({ '--frame': tagColor(group.color) }) as CSSProperties

/**
 * The quiz's questions as a sortable list. Each group is one rounded card in its colour: closed, its
 * header and a badge with how many questions it holds; opening it grows the card down around its
 * questions. Drag a question or a group with the mouse, press and hold it on a touch screen, or focus
 * its handle and use Space, the arrows and Space: the rows move aside and the dragged row waits as a
 * dashed ghost card where it will land, inside a group's card when it lands in the group (a closed group
 * takes it too). Only the pointer's height counts, so the whole width of a row or a group takes the
 * drop. While a group is dragged every group shows closed, so it moves past whole groups. Pulling a row
 * to the left drops it on the trash panel. Clicking a row selects it; a header's arrow opens or closes
 * its group, and the button above the list closes or opens them all.
 */
export function QuestionList({
  layout,
  selectedId,
  invalidIds,
  onSelect,
  onPlace,
  onPlaceGroup,
  onTrash,
}: {
  layout: Layout
  selectedId: string | null
  /** Questions and groups to mark with a red dot. */
  invalidIds: ReadonlySet<string>
  onSelect: (id: string) => void
  /** The question `id` was dropped before or after the row `targetId` (a question, a header or a group's end). */
  onPlace: (id: string, targetId: string, side: Side) => void
  /** The group `id` was dropped before or after the row `targetId` (a question outside the groups or a header). */
  onPlaceGroup: (id: string, targetId: string, side: Side) => void
  /** A question or group was dropped on the trash. */
  onTrash: (id: string) => void
}) {
  const { t } = useTranslation()
  const sensors = useSortableSensors()
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [target, setTarget] = useState<Target | null>(null)
  const [overTrash, setOverTrash] = useState(false)
  // The pointer's x when the drag started; null for a keyboard drag (no trash).
  const startX = useRef<number | null>(null)
  const [trashRect, setTrashRect] = useState<{ top: number; left: number; height: number } | null>(null)
  const numbers = useMemo(() => {
    const numbers = new Map<string, number>()
    layout.questions.forEach((q, i) => numbers.set(q.id, i))
    layout.groups.forEach((g, i) => numbers.set(g.id, i))
    return numbers
  }, [layout])
  const groupsById = useMemo(() => new Map(layout.groups.map((g) => [g.id, g])), [layout.groups])
  const draggingGroup = activeId !== null && groupsById.has(activeId)
  const items = useMemo(() => listItems(layout), [layout])
  // A question selected elsewhere (the problems menu, a move into a closed group) opens its group.
  const selectedGroup = layout.questions.find((q) => q.id === selectedId)?.groupId
  useEffect(() => {
    if (selectedGroup) setCollapsed((c) => (c.has(selectedGroup) ? new Set([...c].filter((id) => id !== selectedGroup)) : c))
  }, [selectedId, selectedGroup])
  // While a group is dragged, every group is one closed card: only headers and ungrouped questions show.
  const rendered = useMemo(
    () => (draggingGroup ? items.filter((i) => i.kind === 'group' || (i.kind === 'question' && !i.question.groupId)) : items),
    [items, draggingGroup],
  )
  // A closed group's questions stay mounted (they shrink away), but they take no drop.
  const hidden = useCallback((item: (typeof items)[number]) => item.kind === 'question' && !!item.question.groupId && collapsed.has(item.question.groupId), [collapsed])
  const ids = useMemo(() => rendered.filter((i) => !hidden(i)).map(itemId), [rendered, hidden])
  const name = useCallback(
    (id: UniqueIdentifier) => {
      const key = String(id)
      if (key === TRASH) return t('editor.trash')
      if (key.endsWith(':end')) return t('editor.groupEndN', { n: (numbers.get(key.slice(0, -4)) ?? 0) + 1 })
      const n = (numbers.get(key) ?? 0) + 1
      return groupsById.has(key) ? t('editor.groupN', { n }) : t('editor.questionN', { n })
    },
    [numbers, groupsById, t],
  )
  const accessibility = useSortableAccessibility(ids, name)
  const activeQuestion = activeId ? layout.questions.find((q) => q.id === activeId) : undefined
  const activeGroup = activeId ? groupsById.get(activeId) : undefined
  // Moves from the toolbar or the shortcuts slide the rows into place; a drag animates itself. Keyed by
  // the order of every row, so opening or closing a group (its rows only grow or shrink) slides nothing.
  const listRef = useRef<HTMLOListElement>(null)
  const dragged = useRef(false)
  useFlipOnReorder(listRef, rendered.map(itemId).join(), selectedId, dragged)

  // The group a dragged question would land in (its own until it moves): the ghost waits in its card.
  const landing = useMemo(() => {
    if (!activeQuestion) return undefined
    const groupId = target
      ? placeQuestion(layout, activeQuestion.id, target.targetId, target.side).questions.find((q) => q.id === activeQuestion.id)?.groupId
      : activeQuestion.groupId
    return groupId ? groupsById.get(groupId) : undefined
  }, [activeQuestion, target, layout, groupsById])

  // The trash takes the drop once the pointer was pulled left onto it (anything left of its right edge
  // counts); otherwise the row the pointer is level with, over the whole width of the list.
  const collision: CollisionDetection = (args) => {
    const pointer = args.pointerCoordinates
    const trash = args.droppableRects.get(TRASH)
    if (pointer && trash && startX.current !== null && pointer.x < startX.current - TRASH_PULL) {
      if (pointer.x <= trash.right && pointer.y >= trash.top && pointer.y <= trash.bottom) return [{ id: TRASH }]
    }
    const rows = args.droppableContainers.filter((c) => c.id !== TRASH)
    if (!pointer) return closestCenter({ ...args, droppableContainers: rows })
    let best: { id: UniqueIdentifier; distance: number } | null = null
    for (const row of rows) {
      const rect = args.droppableRects.get(row.id)
      if (!rect) continue
      const distance = pointer.y < rect.top ? rect.top - pointer.y : pointer.y > rect.bottom ? pointer.y - rect.bottom : 0
      if (!best || distance < best.distance) best = { id: row.id, distance }
    }
    return best ? [{ id: best.id, data: { value: best.distance } }] : []
  }

  // The side follows the rows' movement: dragged down, a row lands after the row it is over; up, before it.
  const track = ({ active, over }: DragOverEvent) => {
    setOverTrash(over?.id === TRASH)
    if (!over || over.id === TRASH || over.id === active.id) return setTarget(null)
    const targetId = String(over.id)
    const side: Side = ids.indexOf(targetId) > ids.indexOf(String(active.id)) ? 'after' : 'before'
    setTarget((t) => (t?.targetId === targetId && t.side === side ? t : { targetId, side }))
  }

  const finish = () => {
    setActiveId(null)
    setTarget(null)
    setOverTrash(false)
    setTrashRect(null)
    startX.current = null
  }

  const toggle = (id: string) => setCollapsed((c) => (c.has(id) ? new Set([...c].filter((x) => x !== id)) : new Set([...c, id])))
  const allFolded = layout.groups.length > 0 && layout.groups.every((g) => collapsed.has(g.id))
  const count = (groupId: string) => layout.questions.filter((q) => q.groupId === groupId).length

  return (
    <>
      {layout.groups.length > 0 && (
        // Says what it will do, like each header's own arrow.
        <Button variant="outline" size="sm" onClick={() => setCollapsed(allFolded ? new Set() : new Set(groupsById.keys()))} className="w-full">
          {allFolded ? <ChevronsUpDownIcon aria-hidden="true" /> : <ChevronsDownUpIcon aria-hidden="true" />}
          {allFolded ? t('editor.expandAllGroups') : t('editor.collapseAllGroups')}
        </Button>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        accessibility={accessibility}
        onDragStart={({ active, activatorEvent }) => {
          setActiveId(String(active.id))
          const event = activatorEvent as MouseEvent | TouchEvent | KeyboardEvent
          startX.current = 'clientX' in event ? event.clientX : 'touches' in event ? (event.touches[0]?.clientX ?? null) : null
          if (startX.current !== null && listRef.current) setTrashRect(trashPlace(listRef.current))
        }}
        onDragOver={track}
        onDragCancel={finish}
        onDragEnd={({ active, over }) => {
          const id = String(active.id)
          const landed = target
          finish()
          if (over?.id === TRASH) return onTrash(id)
          if (!over || !landed) return
          dragged.current = true
          if (groupsById.has(id)) onPlaceGroup(id, landed.targetId, landed.side)
          else onPlace(id, landed.targetId, landed.side)
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ol ref={listRef} className="flex flex-col" aria-label={t('editor.questionCount', { count: layout.questions.length })}>
            {rendered.map((item) => {
              if (item.kind === 'group') {
                return (
                  <GroupRow
                    key={item.group.id}
                    group={item.group}
                    index={numbers.get(item.group.id)!}
                    questionCount={count(item.group.id)}
                    selected={item.group.id === selectedId}
                    invalid={invalidIds.has(item.group.id)}
                    open={!collapsed.has(item.group.id)}
                    // While groups are dragged their end rows are left out, so the header is the whole card.
                    whole={draggingGroup}
                    onToggle={() => toggle(item.group.id)}
                    onSelect={() => onSelect(item.group.id)}
                  />
                )
              }
              if (item.kind === 'end') {
                return <GroupEnd key={endId(item.group.id)} group={item.group} count={count(item.group.id)} selected={item.group.id === selectedId} />
              }
              // The dragged question waits in the card of the group it would land in.
              const own = item.question.groupId ? groupsById.get(item.question.groupId) : undefined
              const isActive = item.question.id === activeId
              const card = isActive ? landing : own
              return (
                <SortableRow
                  key={item.question.id}
                  question={item.question}
                  frameGroup={card}
                  frameSelected={!!card && card.id === selectedId}
                  ghostColor={isActive ? (landing?.color ?? null) : undefined}
                  hidden={hidden(item)}
                  index={numbers.get(item.question.id)!}
                  selected={item.question.id === selectedId}
                  invalid={invalidIds.has(item.question.id)}
                  onSelect={() => onSelect(item.question.id)}
                />
              )
            })}
          </ol>
        </SortableContext>
        {/* In the page's top layer, so the dragged row passes over the trash and every panel. */}
        {createPortal(
          <DragOverlay zIndex={1001}>
            {activeQuestion && (
              <RowBody
                question={activeQuestion}
                index={numbers.get(activeQuestion.id)!}
                selected={activeQuestion.id === selectedId}
                invalid={invalidIds.has(activeQuestion.id)}
                className={cn('rotate-1 bg-card shadow-lg ring-2 ring-primary transition-opacity', overTrash && 'opacity-60 ring-destructive')}
              />
            )}
            {activeGroup && (
              <GroupBody
                group={activeGroup}
                index={numbers.get(activeGroup.id)!}
                questionCount={count(activeGroup.id)}
                showCount
                selected={activeGroup.id === selectedId}
                invalid={invalidIds.has(activeGroup.id)}
                open={false}
                className={cn('rotate-1 bg-card shadow-lg ring-2 ring-primary transition-opacity', overTrash && 'opacity-60 ring-destructive')}
              />
            )}
          </DragOverlay>,
          document.body,
        )}
        {trashRect && createPortal(<Trash rect={trashRect} over={overTrash} />, document.body)}
      </DndContext>
    </>
  )
}

/**
 * The trash panel's place: floating just left of the panel the list scrolls in, as tall as its visible
 * part. Nothing moves for it: where the window has no room on that side, it floats over the panel's
 * left edge instead.
 */
function trashPlace(list: HTMLElement) {
  let panel: HTMLElement = list
  for (let node = list.parentElement; node && node !== document.body; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY
    if (overflow === 'auto' || overflow === 'scroll') {
      panel = node
      break
    }
  }
  const area = panel.getBoundingClientRect()
  const top = Math.max(area.top, 8)
  return { top, left: Math.max(8, area.left - TRASH_WIDTH - 8), height: Math.min(area.bottom, window.innerHeight - 8) - top }
}

/** Drop target for deleting: its own panel left of the list while a row is dragged with a pointer. */
function Trash({ rect, over }: { rect: { top: number; left: number; height: number }; over: boolean }) {
  const { t } = useTranslation()
  const { setNodeRef } = useDroppable({ id: TRASH })
  return (
    <div
      ref={setNodeRef}
      style={rect}
      className={cn(
        'fixed z-60 flex w-13 animate-slide-in flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-1.5 shadow-soft backdrop-blur',
        'transition-[background-color,border-color,color,scale,box-shadow] duration-300 ease-spring',
        over
          ? 'scale-105 border-solid border-destructive bg-destructive text-destructive-foreground shadow-[0_0_0_6px_color-mix(in_srgb,var(--destructive)_25%,transparent)]'
          : 'border-destructive/50 bg-card/95 text-destructive',
      )}
    >
      {/* Keyed by `over`, so the lid wiggles each time an item comes over it. */}
      <span
        key={String(over)}
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-full transition-colors',
          over ? 'animate-wiggle bg-destructive-foreground/20' : 'bg-destructive/12',
        )}
      >
        <Trash2Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="rotate-180 text-xs font-extrabold tracking-wide whitespace-nowrap [writing-mode:vertical-rl]">
        {over ? t('editor.releaseToDelete') : t('editor.dropToDelete')}
      </span>
    </div>
  )
}

/** How many questions a group's card holds, on the middle of its bottom edge (the top of the parent). */
function CountBadge({ count }: { count: number }) {
  const { t } = useTranslation()
  return (
    <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-(--frame)/45 bg-card px-2 text-[0.6875rem] leading-4 font-extrabold whitespace-nowrap text-foreground/80 tabular-nums">
      {t('editor.questionCount', { count })}
    </span>
  )
}

/**
 * A group's header, the top of its card: dragged like a question (with all its questions), its arrow
 * opens or closes the group. `whole` (while a group is dragged) draws the closed card in one piece.
 */
function GroupRow({
  group,
  index,
  questionCount,
  selected,
  invalid,
  open,
  whole,
  onToggle,
  onSelect,
}: {
  group: QuestionGroup
  index: number
  questionCount: number
  selected: boolean
  invalid: boolean
  open: boolean
  whole: boolean
  onToggle: () => void
  onSelect: () => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: group.id })
  const { onKeyDown, ...pointerListeners } = listeners ?? {}
  return (
    <li
      ref={setNodeRef}
      data-row={group.id}
      data-flip-id={group.id}
      style={{ transform: CSS.Translate.toString(transform), transition, ...frameStyle(group) }}
      // Spacing is padding outside the card, so the rows touch and move aside by exactly a row. Above the
      // rows after it, where its contents slide when the group closes.
      className={cn('relative z-1 touch-manipulation pt-1.5 first:pt-0', whole && 'pb-3')}
      {...pointerListeners}
    >
      <div className="relative">
        <GroupBody
          group={group}
          index={index}
          questionCount={questionCount}
          selected={selected}
          invalid={invalid}
          open={open && !whole}
          shape={whole ? 'whole' : 'top'}
          ghost={isDragging}
          onToggle={onToggle}
          onSelect={onSelect}
          handle={
            <button
              ref={setActivatorNodeRef}
              type="button"
              {...attributes}
              onKeyDown={onKeyDown as KeyboardEventHandler | undefined}
              aria-label={t('editor.dragGroup', { n: index + 1 })}
              className="flex h-12 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring active:cursor-grabbing"
            >
              <GripVerticalIcon className="size-4" aria-hidden="true" />
            </button>
          }
        />
        {whole && !isDragging && (
          <span className="absolute inset-x-0 top-full">
            <CountBadge count={questionCount} />
          </span>
        )}
      </div>
    </li>
  )
}

/**
 * A group's card, shared by the list and the drag overlay: tinted with the group's colour, `whole`
 * when closed, or its `top` while open (its questions' rows carry the rest).
 */
function GroupBody({
  group,
  index,
  questionCount,
  showCount = false,
  selected,
  invalid,
  open,
  shape = 'whole',
  ghost = false,
  onToggle,
  onSelect,
  handle,
  className,
}: {
  group: QuestionGroup
  index: number
  questionCount: number
  /** Also says how many questions it holds (the drag overlay; in the list the card's badge does). */
  showCount?: boolean
  selected: boolean
  invalid: boolean
  open: boolean
  shape?: 'whole' | 'top'
  /** The dragged group's place: a dashed ghost card. */
  ghost?: boolean
  onToggle?: () => void
  onSelect?: () => void
  handle?: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <div
      style={{ ...tagStyle(group.color), ...frameStyle(group) }}
      className={cn(
        'flex items-center gap-1 border-2 pr-1 transition-colors',
        // Closed, the contents slide down to the middle of the whole card (this top and the 24 px bottom
        // below), in step with the rows shrinking away.
        '*:transition-transform *:duration-300 *:ease-[cubic-bezier(0.22,1,0.36,1)]',
        shape === 'whole' ? 'rounded-2xl' : ['rounded-t-2xl border-b-0', !open && '*:translate-y-2.75'],
        ghost ? 'border-dashed border-(--tag) bg-(--tag)/10 *:invisible' : frame(selected),
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
        // As the card's top, the bottom piece below adds the rest of its height.
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
          shape === 'whole' ? 'min-h-14 py-1.5' : 'min-h-12',
        )}
      >
        <span className="relative grid size-9 shrink-0 place-items-center rounded-lg bg-(--tag)/25 text-foreground">
          <LayersIcon className="size-4" aria-hidden="true" />
          {invalid && (
            <span className="absolute -top-1 -right-1 size-3 rounded-full border-2 border-card bg-destructive">
              <span className="sr-only">{t('editor.needsFixing')}</span>
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-extrabold text-foreground/75 tabular-nums">
            {t('editor.groupN', { n: index + 1 })}
            {/* In the list the card's badge shows the count; screen readers get it here. */}
            {showCount ? (
              <> · {t('editor.questionCount', { count: questionCount })}</>
            ) : (
              <span className="sr-only"> · {t('editor.questionCount', { count: questionCount })}</span>
            )}
          </span>
          <span className="line-clamp-2 text-sm leading-snug font-black wrap-break-word">{group.title}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? t('editor.collapseGroup', { n: index + 1 }) : t('editor.expandGroup', { n: index + 1 })}
        // Round, so its hover sits well inside the card's rounded corner.
        className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring"
      >
        <ChevronDownIcon className={cn('size-4 transition-transform duration-300 ease-spring', !open && '-rotate-90')} aria-hidden="true" />
      </button>
    </div>
  )
}

/**
 * The bottom of a group's card, with the count badge on its edge: the drop target for "below the group,
 * outside it", and for "the group's last question" from below. It is always there, so opening or
 * closing the group only slides it down or up.
 */
function GroupEnd({ group, count, selected }: { group: QuestionGroup; count: number; selected: boolean }) {
  const { setNodeRef, transform, transition } = useSortable({ id: endId(group.id), disabled: { draggable: true, droppable: false } })
  return (
    <li
      ref={setNodeRef}
      data-row={endId(group.id)}
      data-flip-id={endId(group.id)}
      aria-hidden="true"
      style={{ transform: CSS.Translate.toString(transform), transition, ...frameStyle(group) }}
      // The padding below leaves room for the badge.
      className="pb-3"
    >
      {/* As tall as the corner radius (`rounded-2xl` is 24 px), or the browser shrinks the corners. */}
      <div className={cn('relative h-6 rounded-b-2xl border-2 border-t-0 transition-colors', frame(selected))}>
        <span className="absolute inset-x-0 top-full">
          <CountBadge count={count} />
        </span>
      </div>
    </li>
  )
}

function SortableRow({
  question,
  frameGroup,
  frameSelected,
  ghostColor,
  hidden,
  index,
  selected,
  invalid,
  onSelect,
}: {
  question: Question
  /** The group whose card the row sits in, and whether that group is selected (its card's border shows it). */
  frameGroup: QuestionGroup | undefined
  frameSelected: boolean
  /** Set while it is the dragged row: a dashed ghost in this colour (null: the theme's) shows where it lands. */
  ghostColor: TagColor | null | undefined
  /** In a closed group: shrunk to nothing (animated), out of reach and no drop target. */
  hidden: boolean
  index: number
  selected: boolean
  invalid: boolean
  onSelect: () => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id: question.id, disabled: hidden })
  // Mouse and touch drag the whole row; the keyboard drags from the handle, so Space on the row's
  // select button still selects.
  const { onKeyDown, ...pointerListeners } = listeners ?? {}
  return (
    <li
      ref={setNodeRef}
      data-row={question.id}
      data-flip-id={question.id}
      // Opening or closing a group grows or shrinks its rows, so its card opens down smoothly. Both
      // transitions inline: dnd-kit's own (for moving aside) would otherwise replace the growing one.
      style={{
        transform: CSS.Translate.toString(transform),
        transition: [transition, GROW].filter(Boolean).join(', '),
        ...(frameGroup && frameStyle(frameGroup)),
      }}
      inert={hidden}
      className={cn('grid touch-manipulation', hidden ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')}
      {...pointerListeners}
    >
      {/* Inside a group's card the row keeps the card's sides, so the card stays whole; the question is
          centred in it, a little narrower than outside. */}
      <div className="flex min-h-0 flex-col justify-end overflow-hidden">
        <div className={cn('py-0.75', frameGroup && ['border-x-2 px-1', frame(frameSelected)])}>
          <RowBody
            question={question}
            index={index}
            selected={selected}
            invalid={invalid}
            grouped={!!frameGroup}
            ghost={ghostColor !== undefined ? { color: ghostColor ?? undefined } : undefined}
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
        </div>
      </div>
    </li>
  )
}

/** A row's look, shared by the list and the drag overlay; a stripe on the left shows its colour tag. */
function RowBody({
  question,
  index,
  selected,
  invalid,
  grouped = false,
  ghost,
  onSelect,
  handle,
  className,
}: {
  question: Question
  index: number
  selected: boolean
  invalid: boolean
  /** Inside a group's tinted card: the same card in the panel's own colour, so it stands out from the tint. */
  grouped?: boolean
  /** The dragged row's place: a dashed ghost card, in the landing group's colour. */
  ghost?: { color: TagColor | undefined } | undefined
  onSelect?: () => void
  handle?: ReactNode
  className?: string
}) {
  const { t } = useTranslation()
  const Icon = typeIcons[question.type]
  return (
    <div
      style={tagStyle(ghost ? ghost.color : question.color)}
      className={cn(
        // Every question is a soft rounded card, in a group or not, so the rows read as cards on the panel.
        'relative isolate flex items-center gap-1 overflow-hidden rounded-xl border-2 pr-2 transition-colors',
        ghost
          ? 'border-dashed border-(--tag) bg-(--tag)/12 *:invisible'
          : question.color
            ? // Coloured like a group card: a tinted border and fill, on the card colour so a group's tint does not add to it.
              ['bg-card', selected ? 'border-(--tag)' : 'border-(--tag)/40 hover:border-(--tag)/70']
            : selected
              ? 'border-primary bg-secondary'
              : grouped
                ? 'border-transparent bg-card hover:border-border'
                : 'border-transparent bg-muted/70 hover:border-border',
        className,
      )}
    >
      {question.color && !ghost && <span aria-hidden="true" className="absolute inset-0 -z-1 bg-(--tag)/10" />}
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
            question.color && !ghost ? 'bg-(--tag)/25 text-foreground' : selected ?'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
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

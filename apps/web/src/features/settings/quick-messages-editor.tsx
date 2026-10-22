import { MAX_QUICK_MESSAGES, type QuickMessage } from '@quizmoo/shared'
import { DndContext, closestCenter, type UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, LanguagesIcon, PlusIcon, RotateCcwIcon, XIcon } from 'lucide-react'
import { useCallback, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/cn'
import { useFlip } from '@/lib/flip'
import { useMotionOk } from '@/lib/motion'
import { dragMove, useSortableAccessibility, useSortableSensors } from '@/lib/sortable'
import { move, newId } from '../editor/draft'
import { DurationField } from './duration-field'
import { messageText, restoreBuiltIns } from './host-settings'

const MAX_LENGTH = 200

/**
 * The message box's quick messages as one list: the built-in ones (in the app's language until
 * their text is edited) and the host's own, each timed, reordered by dragging or with the arrows,
 * and removed here. Built-in ones that were removed can be brought back.
 */
export function QuickMessagesEditor({
  messages,
  onMessages,
}: {
  messages: QuickMessage[]
  onMessages: (messages: QuickMessage[]) => void
}) {
  const { t } = useTranslation()
  const sensors = useSortableSensors()
  const ids = useMemo(() => messages.map((m) => m.id), [messages])
  const name = useCallback(
    (id: UniqueIdentifier) => t('settings.messages.messageN', { n: ids.indexOf(String(id)) + 1 }),
    [ids, t],
  )
  const accessibility = useSortableAccessibility(ids, name)
  const [text, setText] = useState('')
  // Rows already there when the list opened stay still; added ones pop in.
  const [initialIds] = useState(() => new Set(ids))
  const inputId = useId()
  const full = messages.length >= MAX_QUICK_MESSAGES
  const restored = restoreBuiltIns(messages)
  const missingBuiltIns = restored.length - messages.length
  // The arrows slide the rows into their new places; a removed row's neighbours close the gap.
  const list = useRef<HTMLDivElement>(null)
  const flip = useFlip(list)

  const update = (index: number, message: QuickMessage) => onMessages(messages.map((m, i) => (i === index ? message : m)))

  function add(e: FormEvent) {
    e.preventDefault()
    if (!text.trim() || full) return
    onMessages([...messages, { id: newId(), text: text.trim(), durationSec: null }])
    setText('')
  }

  return (
    <div ref={list} className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-muted-foreground tabular-nums">
        {t('settings.messages.count', { n: messages.length, max: MAX_QUICK_MESSAGES })}
      </p>
      {messages.length === 0 && <p className="text-sm text-muted-foreground">{t('settings.messages.empty')}</p>}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={accessibility}
        onDragEnd={(event) => {
          const moved = dragMove(ids, event)
          if (moved) onMessages(move(messages, moved.from, moved.to))
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {messages.map((message, index) => (
            <MessageRow
              key={message.id}
              message={message}
              index={index}
              entering={!initialIds.has(message.id)}
              last={index === messages.length - 1}
              onChange={(next) => update(index, next)}
              onMove={(to) => {
                flip(message.id)
                onMessages(move(messages, index, to))
              }}
              onRemove={() => {
                flip()
                onMessages(messages.filter((m) => m.id !== message.id))
              }}
            />
          ))}
        </SortableContext>
      </DndContext>
      <form className="mt-1 flex gap-2" onSubmit={add}>
        <label htmlFor={inputId} className="sr-only">
          {t('settings.messages.new')}
        </label>
        <Input
          id={inputId}
          value={text}
          maxLength={MAX_LENGTH}
          disabled={full}
          placeholder={full ? t('settings.messages.full', { max: MAX_QUICK_MESSAGES }) : t('settings.messages.new')}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" variant="secondary" disabled={full || !text.trim()}>
          <PlusIcon aria-hidden="true" />
          {t('settings.messages.add')}
        </Button>
      </form>
      {missingBuiltIns > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="animate-pop self-start"
          disabled={restored.length > MAX_QUICK_MESSAGES}
          onClick={() => onMessages(restored)}
        >
          <RotateCcwIcon aria-hidden="true" />
          {t('settings.messages.restore', { count: missingBuiltIns })}
        </Button>
      )}
    </div>
  )
}

function MessageRow({
  message,
  index,
  entering,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  message: QuickMessage
  index: number
  entering: boolean
  last: boolean
  onChange: (message: QuickMessage) => void
  onMove: (to: number) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const motionOk = useMotionOk()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: message.id,
  })
  // Removing plays the row out first; the list drops it when the animation ends.
  const [leaving, setLeaving] = useState(false)
  const n = index + 1
  const text = messageText(message, t)
  const builtIn = 'builtIn' in message
  const empty = !text.trim()
  const errorId = useId()
  const remove = () => (motionOk ? setLeaving(true) : onRemove())

  return (
    <div
      ref={setNodeRef}
      data-flip-id={message.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      onAnimationEnd={(e) => {
        if (leaving && e.target === e.currentTarget) onRemove()
      }}
      className={cn(
        'flex flex-col gap-2 rounded-2xl border-2 bg-card p-2',
        leaving ? 'pointer-events-none animate-pop-out' : entering && 'animate-pop',
        isDragging && 'relative z-10 shadow-lg ring-2 ring-primary',
      )}
    >
      <div className="flex items-center gap-1.5">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t('settings.messages.drag', { n })}
          className="flex h-10 w-6 shrink-0 cursor-grab touch-manipulation items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring active:cursor-grabbing"
        >
          <GripVerticalIcon className="size-4" aria-hidden="true" />
        </button>
        <Input
          value={text}
          maxLength={MAX_LENGTH}
          aria-label={t('settings.messages.messageN', { n })}
          aria-invalid={empty || undefined}
          aria-describedby={empty ? errorId : undefined}
          // Editing a built-in message makes it the host's own text, no longer translated.
          onChange={(e) =>
            onChange({ id: message.id, text: e.target.value, durationSec: message.durationSec, ...(message.important && { important: true }) })
          }
        />
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t('settings.messages.remove', { n })} onClick={remove}>
          <XIcon aria-hidden="true" />
        </Button>
      </div>
      {empty && (
        <p id={errorId} className="pl-8 text-sm font-semibold text-destructive">
          {t('settings.messages.textRequired')}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2 pl-7">
        <DurationField value={message.durationSec} onChange={(durationSec) => onChange({ ...message, durationSec })} />
        {/* Sent as important: players cannot swipe it away. */}
        <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Switch checked={message.important === true} onCheckedChange={(important) => onChange({ ...message, important })} />
          {t('settings.messages.important')}
        </label>
        {builtIn && (
          <span className="mb-2.5 flex items-center gap-1 text-xs font-bold text-muted-foreground">
            <LanguagesIcon className="size-3.5" aria-hidden="true" />
            {t('settings.messages.builtIn')}
          </span>
        )}
        <div className="ml-auto flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t('settings.messages.moveUp', { n })}
            disabled={index === 0}
            onClick={() => onMove(index - 1)}
          >
            <ArrowUpIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label={t('settings.messages.moveDown', { n })}
            disabled={last}
            onClick={() => onMove(index + 1)}
          >
            <ArrowDownIcon aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}

import { MAX_QUICK_MESSAGES, builtInMessages, type BuiltInMessage, type QuickMessage } from '@quizmoo/shared'
import { DndContext, closestCenter, type UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, PlusIcon, XIcon } from 'lucide-react'
import { useCallback, useId, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { SelectField } from '@/components/select-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/cn'
import { dragMove, useSortableAccessibility, useSortableSensors } from '@/lib/sortable'
import { move, newId } from '../editor/draft'
import { MESSAGE_DURATIONS } from './host-settings'

const MAX_LENGTH = 200

/**
 * The message box's quick messages: the built-in ones (each can be hidden) and the host's own,
 * written, timed, reordered by dragging or with the arrows, and removed here.
 */
export function QuickMessagesEditor({
  messages,
  hidden,
  onMessages,
  onHidden,
}: {
  messages: QuickMessage[]
  hidden: BuiltInMessage[]
  onMessages: (messages: QuickMessage[]) => void
  onHidden: (hidden: BuiltInMessage[]) => void
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
  const inputId = useId()
  const full = messages.length >= MAX_QUICK_MESSAGES

  const update = (index: number, message: QuickMessage) => onMessages(messages.map((m, i) => (i === index ? message : m)))

  function add(e: FormEvent) {
    e.preventDefault()
    if (!text.trim() || full) return
    onMessages([...messages, { id: newId(), text: text.trim(), durationSec: null }])
    setText('')
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col">
        <legend className="mb-1 font-semibold">{t('settings.messages.builtIn')}</legend>
        {builtInMessages.map((message) => (
          <BuiltInRow
            key={message}
            label={t(`host.game.message.presets.${message}`)}
            shown={!hidden.includes(message)}
            onShown={(shown) => onHidden(shown ? hidden.filter((m) => m !== message) : [...hidden, message])}
          />
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">
          {t('settings.messages.own')}{' '}
          <span className="font-normal text-muted-foreground tabular-nums">
            {messages.length} / {MAX_QUICK_MESSAGES}
          </span>
        </legend>
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
                last={index === messages.length - 1}
                onChange={(next) => update(index, next)}
                onMove={(to) => onMessages(move(messages, index, to))}
                onRemove={() => onMessages(messages.filter((_, i) => i !== index))}
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
            placeholder={full ? t('settings.messages.full') : t('settings.messages.new')}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={full || !text.trim()}>
            <PlusIcon aria-hidden="true" />
            {t('settings.messages.add')}
          </Button>
        </form>
      </fieldset>
    </div>
  )
}

function BuiltInRow({ label, shown, onShown }: { label: string; shown: boolean; onShown: (shown: boolean) => void }) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 border-b py-1.5 last:border-b-0">
      <label htmlFor={id} className={cn('cursor-pointer font-semibold', !shown && 'text-muted-foreground line-through')}>
        {label}
      </label>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span aria-hidden="true">{shown ? t('settings.messages.shown') : t('settings.messages.hidden')}</span>
        <Switch id={id} checked={shown} onCheckedChange={onShown} />
      </div>
    </div>
  )
}

function MessageRow({
  message,
  index,
  last,
  onChange,
  onMove,
  onRemove,
}: {
  message: QuickMessage
  index: number
  last: boolean
  onChange: (message: QuickMessage) => void
  onMove: (to: number) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: message.id,
  })
  const n = index + 1
  const empty = !message.text.trim()
  const errorId = useId()
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex flex-col gap-2 rounded-2xl border-2 bg-card p-2',
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
          value={message.text}
          maxLength={MAX_LENGTH}
          aria-label={t('settings.messages.messageN', { n })}
          aria-invalid={empty || undefined}
          aria-describedby={empty ? errorId : undefined}
          onChange={(e) => onChange({ ...message, text: e.target.value })}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('settings.messages.remove', { n })}
          onClick={onRemove}
        >
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

type Choice = 'stays' | 'custom' | (typeof MESSAGE_DURATIONS)[number] & number

/** Until cleared, 10, 30 or 60 s, or any other number of seconds from 5 to 600. */
function DurationField({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  const { t } = useTranslation()
  const preset = value === null || (MESSAGE_DURATIONS as readonly (number | null)[]).includes(value)
  const [custom, setCustom] = useState(!preset)
  const [seconds, setSeconds] = useState(String(value ?? 45))
  const inputId = useId()
  const choice: Choice = custom ? 'custom' : value === null ? 'stays' : (value as Choice)
  const options: { value: Choice; label: string }[] = [
    { value: 'stays', label: t('host.game.message.stays') },
    ...MESSAGE_DURATIONS.filter((d) => d !== null).map((d) => ({ value: d as Choice, label: t('host.game.message.seconds', { count: d }) })),
    { value: 'custom', label: t('settings.messages.custom') },
  ]

  function commit(raw: string) {
    const parsed = Math.round(Number(raw))
    const clamped = Number.isFinite(parsed) ? Math.min(600, Math.max(5, parsed)) : 30
    setSeconds(String(clamped))
    onChange(clamped)
  }

  return (
    <div className="flex items-end gap-2">
      <SelectField
        className="w-44"
        label={t('host.game.message.duration')}
        value={choice}
        options={options}
        onChange={(next) => {
          setCustom(next === 'custom')
          if (next === 'custom') commit(seconds)
          else onChange(next === 'stays' ? null : next)
        }}
      />
      {custom && (
        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-sm font-semibold">
            {t('settings.messages.customSeconds')}
          </label>
          <Input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={5}
            max={600}
            className="w-24"
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
          />
        </div>
      )}
    </div>
  )
}

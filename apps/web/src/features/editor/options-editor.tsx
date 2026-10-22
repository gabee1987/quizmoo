import type { AnswerSymbols, Option } from '@quizmoo/shared'
import { DndContext, closestCenter, type UniqueIdentifier } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckIcon, GripVerticalIcon, PlusIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { dragMove, useSortableAccessibility, useSortableSensors } from '@/lib/sortable'
import { OptionSymbol } from '../../components/icons'
import { optionFill, optionVars } from '../../components/option-colours'
import { move, newId, withImage } from './draft'
import { ImageField } from './image-field'
import type { FieldErrors } from './validate'

const MIN_OPTIONS = 2
const MAX_OPTIONS = 6

/**
 * Option rows for single, multiple, poll and ordering questions, reordered by dragging the handle.
 * Each row shows the colour and symbol the option gets in the game at that position.
 * The correct marker is a toggle: one of them (single), any of them (multiple) or none (poll).
 * Enter in an option jumps to the next one, and in the last one adds a new option.
 */
export function OptionsEditor({
  options,
  marker,
  correctIds,
  onOptions,
  onCorrect,
  errors,
  path,
  symbols,
}: {
  options: Option[]
  /** `order`: the list order is the correct order; rows show their position instead of a correct toggle. */
  marker: 'one' | 'many' | 'none' | 'order'
  correctIds: string[]
  onOptions: (options: Option[]) => void
  onCorrect: (ids: string[]) => void
  errors: FieldErrors
  /** Error path of this question, e.g. "questions.2". */
  path: string
  symbols: AnswerSymbols
}) {
  const { t } = useTranslation()
  const sensors = useSortableSensors()
  const ids = useMemo(() => options.map((o) => o.id), [options])
  const name = useCallback((id: UniqueIdentifier) => t('editor.optionText', { n: ids.indexOf(String(id)) + 1 }), [ids, t])
  const accessibility = useSortableAccessibility(ids, name)
  const inputs = useRef(new Map<string, HTMLInputElement>())
  const focusNext = useRef<string | null>(null)

  useEffect(() => {
    if (!focusNext.current) return
    inputs.current.get(focusNext.current)?.focus()
    focusNext.current = null
  }, [options])

  const update = (index: number, option: Option) => onOptions(options.map((o, i) => (i === index ? option : o)))
  const add = () => {
    const option = { id: newId(), text: '' }
    focusNext.current = option.id
    onOptions([...options, option])
  }
  const remove = (index: number) => {
    const removed = options[index]!
    onOptions(options.filter((_, i) => i !== index))
    if (correctIds.includes(removed.id)) onCorrect(correctIds.filter((id) => id !== removed.id))
  }
  const toggleCorrect = (id: string) => {
    if (marker === 'one') onCorrect([id])
    else onCorrect(correctIds.includes(id) ? correctIds.filter((x) => x !== id) : [...correctIds, id])
  }
  const onEnter = (index: number) => {
    const next = options[index + 1]
    if (next) inputs.current.get(next.id)?.focus()
    else if (options.length < MAX_OPTIONS) add()
  }
  const correctError = errors[`${path}.correctOptionId`] ?? errors[`${path}.correctOptionIds`]
  const listError = errors[`${path}.options`]

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-semibold">
        {marker === 'order'
          ? t('editor.optionsInOrder')
          : marker === 'none'
            ? t('editor.options')
            : marker === 'one'
              ? t('editor.optionsMarkOne')
              : t('editor.optionsMarkAll')}
      </legend>
      {marker === 'order' && <p className="-mt-1 mb-1 text-sm text-muted-foreground">{t('editor.orderHint')}</p>}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={accessibility}
        onDragEnd={(event) => {
          const moved = dragMove(ids, event)
          if (moved) onOptions(move(options, moved.from, moved.to))
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {options.map((option, index) => (
            <OptionRow
              key={option.id}
              option={option}
              index={index}
              symbols={symbols}
              marker={marker}
              correct={correctIds.includes(option.id)}
              textError={errors[`${path}.options.${index}.text`]}
              field={`${path}.options.${index}.text`}
              markerField={index === 0 ? `${path}.correct-marker` : undefined}
              canRemove={options.length > MIN_OPTIONS}
              inputRef={(el) => {
                if (el) inputs.current.set(option.id, el)
                else inputs.current.delete(option.id)
              }}
              onChange={(next) => update(index, next)}
              onToggleCorrect={() => toggleCorrect(option.id)}
              onRemove={() => remove(index)}
              onEnter={() => onEnter(index)}
            />
          ))}
        </SortableContext>
      </DndContext>
      {(correctError || listError) && <p className="text-sm font-semibold text-destructive">{t(correctError ?? listError!)}</p>}
      {options.length < MAX_OPTIONS && (
        <Button type="button" variant="outline" data-field={`${path}.options`} onClick={add}>
          <PlusIcon aria-hidden="true" />
          {t('editor.addOption')}
        </Button>
      )}
    </fieldset>
  )
}

function OptionRow({
  option,
  index,
  symbols,
  marker,
  correct,
  textError,
  field,
  markerField,
  canRemove,
  inputRef,
  onChange,
  onToggleCorrect,
  onRemove,
  onEnter,
}: {
  option: Option
  index: number
  symbols: AnswerSymbols
  marker: 'one' | 'many' | 'none' | 'order'
  correct: boolean
  textError: string | undefined
  field: string
  markerField: string | undefined
  canRemove: boolean
  inputRef: (el: HTMLInputElement | null) => void
  onChange: (option: Option) => void
  onToggleCorrect: () => void
  onRemove: () => void
  onEnter: () => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: option.id,
  })
  const n = index + 1
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex flex-col gap-2 rounded-2xl border-2 p-2 transition-colors',
        correct ? 'border-success bg-success/10' : 'bg-card',
        isDragging && 'relative z-10 shadow-lg ring-2 ring-primary',
      )}
    >
      <div className="flex items-center gap-1.5">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={t('editor.dragOption', { n })}
          className="flex h-10 w-6 shrink-0 cursor-grab touch-manipulation items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring active:cursor-grabbing"
        >
          <GripVerticalIcon className="size-4" aria-hidden="true" />
        </button>
        {marker === 'order' ? (
          // Its place in the correct order.
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-lg font-black text-secondary-foreground tabular-nums">
            {n}
          </span>
        ) : (
          <span style={optionVars(index)} className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', optionFill)}>
            <OptionSymbol symbols={symbols} index={index} className="size-5" />
          </span>
        )}
        <Input
          ref={inputRef}
          value={option.text}
          maxLength={200}
          data-field={field}
          enterKeyHint="next"
          onChange={(e) => onChange({ ...option, text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
            e.preventDefault()
            onEnter()
          }}
          aria-label={t('editor.optionText', { n })}
          placeholder={t('editor.optionText', { n })}
          aria-invalid={textError ? true : undefined}
          className="min-w-0 flex-1"
        />
        {(marker === 'one' || marker === 'many') && (
          <button
            type="button"
            aria-pressed={correct}
            aria-label={t('editor.correctOption', { n })}
            data-field={markerField}
            onClick={onToggleCorrect}
            className={cn(
              'flex h-12 shrink-0 items-center gap-1.5 rounded-xl border-2 px-2.5 text-sm font-bold transition-[transform,background-color,border-color] outline-none focus-visible:ring-[3px] focus-visible:ring-ring active:scale-95 sm:px-3',
              correct
                ? 'border-success bg-success text-success-foreground'
                : 'border-input bg-card text-muted-foreground hover:border-success hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'grid size-6 place-items-center rounded-full border-2',
                correct ? 'border-success-foreground' : 'border-current',
              )}
            >
              {correct && <CheckIcon className="size-4 animate-pop" strokeWidth={3} aria-hidden="true" />}
            </span>
            <span className="hidden sm:inline">{t('editor.correct')}</span>
          </button>
        )}
        <button
          type="button"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring disabled:opacity-30"
          disabled={!canRemove}
          aria-label={t('editor.removeOption', { n })}
          onClick={onRemove}
        >
          <XIcon className="size-5" aria-hidden="true" />
        </button>
      </div>
      {/* Ordering items are text only: the phone's sortable list has no room for pictures. */}
      {marker !== 'order' && (
        <div className="pl-19">
          <ImageField
            compact
            label={t('editor.optionImage', { n })}
            imageId={option.imageId}
            onChange={(imageId) => onChange(withImage(option, imageId))}
          />
        </div>
      )}
      {textError && <p className="pl-19 text-sm font-semibold text-destructive">{t(textError)}</p>}
    </div>
  )
}

import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Sensors for every sortable list: a mouse drag starts after 4 px (so clicks still click),
 * a touch drag after a 250 ms press that moves less than 5 px (so a swipe still scrolls),
 * and the keyboard drags with Space, the arrows and Space again.
 */
export function useSortableSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}

/**
 * Sensors for a short list dragged by the whole item (a player's ordering answer): mouse and touch
 * drags start after a few pixels of movement, no press-and-hold. The items must be `touch-none`,
 * so a swipe on them drags instead of scrolling the page.
 */
export function useInstantSortableSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}

/** Translated screen reader texts for a sortable list of `ids`; `name(id)` says what an item is ("Question 3"). */
export function useSortableAccessibility(
  ids: readonly UniqueIdentifier[],
  name: (id: UniqueIdentifier) => string,
): { announcements: Announcements; screenReaderInstructions: ScreenReaderInstructions } {
  const { t } = useTranslation()
  return useMemo(() => {
    const position = (id: UniqueIdentifier | undefined) => ({ position: ids.indexOf(id ?? '') + 1, count: ids.length })
    return {
      screenReaderInstructions: { draggable: t('editor.dnd.instructions') },
      announcements: {
        onDragStart: ({ active }) => t('editor.dnd.pickedUp', { item: name(active.id), ...position(active.id) }),
        onDragOver: ({ active, over }) =>
          over
            ? t('editor.dnd.movedOver', { item: name(active.id), ...position(over.id) })
            : t('editor.dnd.outside', { item: name(active.id) }),
        onDragEnd: ({ active, over }) =>
          over
            ? t('editor.dnd.dropped', { item: name(active.id), ...position(over.id) })
            : t('editor.dnd.cancelled', { item: name(active.id) }),
        onDragCancel: ({ active }) => t('editor.dnd.cancelled', { item: name(active.id) }),
      },
    }
  }, [ids, name, t])
}

/** The from/to indexes of a finished drag, or null when nothing moved. */
export function dragMove(ids: readonly UniqueIdentifier[], { active, over }: Pick<DragEndEvent, 'active' | 'over'>) {
  if (!over || active.id === over.id) return null
  const from = ids.indexOf(active.id)
  const to = ids.indexOf(over.id)
  return from < 0 || to < 0 ? null : { from, to }
}

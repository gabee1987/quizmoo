import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'
import { motionOk } from './motion'

/**
 * Animates a list reorder made with buttons or keys (dragging animates itself): `capture(movedId)`
 * measures every `[data-flip-id]` element in the container just before the order changes; after the
 * next render each one slides from where it was to its new place, the moved one lifted above the
 * others. Web Animations with `composite: 'add'`, so it stacks on dnd-kit's own transforms.
 */
export function useFlip(container: RefObject<HTMLElement | null>) {
  const before = useRef<{ rects: Map<string, DOMRect>; moved: string | null } | null>(null)

  const capture = useCallback(
    (movedId: string | null = null) => {
      if (!container.current || !motionOk()) return
      const rects = new Map<string, DOMRect>()
      for (const element of container.current.querySelectorAll<HTMLElement>('[data-flip-id]')) {
        rects.set(element.dataset.flipId!, element.getBoundingClientRect())
      }
      before.current = { rects, moved: movedId }
    },
    [container],
  )

  useLayoutEffect(() => {
    const captured = before.current
    if (!captured || !container.current) return
    before.current = null
    for (const element of container.current.querySelectorAll<HTMLElement>('[data-flip-id]')) {
      const id = element.dataset.flipId!
      const old = captured.rects.get(id)
      if (!old) continue
      const now = element.getBoundingClientRect()
      slide(element, old.left - now.left, old.top - now.top, id === captured.moved)
    }
  })

  return capture
}

/**
 * The same slide for a list reordered from outside (the editor's toolbar and shortcuts move the
 * selected question): positions are kept after each reorder, relative to the container so scrolling
 * does not matter, and a change of `order` slides the items. When the container's height changes
 * meanwhile (rows growing or shrinking), the positions are measured again. `skip` is set by a drag,
 * which animates itself.
 */
export function useFlipOnReorder(container: RefObject<HTMLElement | null>, order: string, movedId: string | null, skip: RefObject<boolean>) {
  const last = useRef<{ order: string; tops: Map<string, number> } | null>(null)

  // Rows that grow or shrink (a group opening) change the list's height: measure again, so the next
  // reorder slides from where the rows really are.
  useLayoutEffect(() => {
    const root = container.current
    if (!root) return
    const observer = new ResizeObserver(() => {
      if (last.current) last.current = { order: last.current.order, tops: measure(root) }
    })
    observer.observe(root)
    return () => observer.disconnect()
  }, [container])

  useLayoutEffect(() => {
    const root = container.current
    // Rows keep their height between reorders (the editor renders on every keystroke): measure only when the order changes.
    if (!root || last.current?.order === order) return
    const elements = [...root.querySelectorAll<HTMLElement>('[data-flip-id]')]
    const top = (element: HTMLElement) => offsetTop(root, element)
    const previous = last.current
    if (previous && !skip.current && motionOk()) {
      for (const element of elements) {
        const old = previous.tops.get(element.dataset.flipId!)
        if (old !== undefined) slide(element, 0, old - top(element), element.dataset.flipId === movedId)
      }
    }
    skip.current = false
    last.current = { order, tops: new Map(elements.map((element) => [element.dataset.flipId!, top(element)])) }
  })
}

/** Every item's top in the container, from the layout: running slides and drag transforms do not count. */
function measure(root: HTMLElement) {
  return new Map([...root.querySelectorAll<HTMLElement>('[data-flip-id]')].map((element) => [element.dataset.flipId!, offsetTop(root, element)]))
}

function offsetTop(root: HTMLElement, element: HTMLElement) {
  return element.offsetParent === root ? element.offsetTop : element.offsetTop - root.offsetTop
}

/** Slides an element from (dx, dy) back to its place, springy; a moved one is lifted above its neighbours. */
function slide(element: HTMLElement, dx: number, dy: number, moved: boolean) {
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
  if (moved) {
    element.style.zIndex = '10'
    element.style.position ||= 'relative'
  }
  const halfway = `translate(${dx * 0.5}px, ${dy * 0.5}px)`
  const animation = element.animate(
    [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: moved ? `${halfway} scale(1.03)` : halfway, offset: 0.5 }, { transform: 'none' }],
    { duration: 520, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)', composite: 'add' },
  )
  if (moved) animation.onfinish = animation.oncancel = () => (element.style.zIndex = '')
}

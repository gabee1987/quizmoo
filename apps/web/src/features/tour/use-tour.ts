import { hostTourIds, type HostTourId } from '@quizmoo/shared'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { apiFetch } from '@/lib/api'
import { stepsOnScreen, tours, type TourId, type TourStep } from './tours'

/**
 * The tutorial tours. One runs at a time: `startTour` sets it, the layer (`TourLayer`) shows it, and
 * ending it in any way marks it seen. A host's seen tours are kept on the account (`/api/me/tours`),
 * the players' lobby tour in this browser (`quizmoo.tours`). The value `off` there switches the
 * tours that start by themselves off on this device (the e2e specs use it); replaying still works.
 */

export interface ActiveTour {
  id: TourId
  /** The steps on screen when the tour started. */
  steps: TourStep[]
  index: number
  /** Where focus goes back when the tour ends. */
  returnFocus: HTMLElement | null
  /** Counts the tours started, so a replay of the same tour starts afresh. */
  run: number
}

let runs = 0

const STORAGE_KEY = 'quizmoo.tours'

let active: ActiveTour | null = null
/** The tours of the pages open now, newest last: "Show this page's tour" replays the last one. */
let pageTours: TourId[] = []
let onEnd: ((id: TourId) => void) | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useActiveTour = () => useSyncExternalStore(subscribe, () => active)
export const usePageTourId = () => useSyncExternalStore(subscribe, () => pageTours.at(-1) ?? null)

export const isHostTour = (id: TourId): id is HostTourId => (hostTourIds as readonly string[]).includes(id)

/**
 * The element a step points at: the first one with the key that is on screen (laptop and phone
 * versions of a control share a key), and not inside something hidden from everyone.
 */
export function findAnchor(key: string): HTMLElement | null {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[data-tour~="${key}"]`))) {
    const box = el.getBoundingClientRect()
    if (box.width < 1 || box.height < 1) continue
    if (!el.checkVisibility({ visibilityProperty: true })) continue
    if (el.closest('[inert], [aria-hidden="true"]')) continue
    return el
  }
  return null
}
const onScreen = (key: string) => findAnchor(key) !== null

/**
 * An open dialog, sheet, menu or list the tour's own elements are not in: the tour waits (or hides)
 * until it closes, so a bubble never sits behind it or points under it.
 */
export function tourBlocked(steps: TourStep[]): boolean {
  const anchors = steps.flatMap((step) => (step.anchor ? [findAnchor(step.anchor)] : [])).filter((el) => el !== null)
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')).some(
    (layer) =>
      !layer.closest('[data-tour-layer]') &&
      layer.getBoundingClientRect().width > 0 &&
      !anchors.some((anchor) => layer.contains(anchor)),
  )
}

/** Starts a tour with the steps on screen now. False when its page is not ready (none of its elements). */
export function startTour(id: TourId): boolean {
  const steps = stepsOnScreen(tours[id].steps, onScreen)
  if (!steps || steps.length === 0) return false
  if (active) endTour()
  runs += 1
  active = { id, steps, index: 0, returnFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null, run: runs }
  emit()
  return true
}

/**
 * "Show this page's tour": starts it as soon as the page is usable again. The menu it was chosen from
 * hides the rest of the page (`aria-hidden`) until it has closed, so the first tries can fail.
 */
export function replayTour(id: TourId) {
  let tries = 0
  const attempt = () => {
    if (!startTour(id) && ++tries < 20) window.setTimeout(attempt, 100)
  }
  attempt()
}

export function goToStep(index: number) {
  if (!active || index === active.index) return
  active = { ...active, index }
  emit()
}

export function endTour() {
  if (!active) return
  const { id, returnFocus } = active
  active = null
  emit()
  onEnd?.(id)
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
}

/** The tours ended in this browser: the players' ones, and `off` for every tour that starts by itself. */
function readDevice(): string[] | 'off' {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'off') return 'off'
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function rememberOnDevice(id: TourId) {
  const seen = readDevice()
  if (seen === 'off' || seen.includes(id)) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen, id]))
  } catch {
    // Private mode: the tour shows again next time, nothing worse.
  }
}

export const toursQueryOptions = {
  queryKey: ['tours'],
  queryFn: () => apiFetch<{ seen: HostTourId[] }>('/api/me/tours'),
  staleTime: Infinity,
}

function markSeen(queryClient: QueryClient, id: TourId) {
  if (!isHostTour(id)) return rememberOnDevice(id)
  queryClient.setQueryData<{ seen: HostTourId[] }>(['tours'], (old) => ({ seen: [...new Set([...(old?.seen ?? []), id])] }))
  // A failed save only means the tour may show once more.
  apiFetch(`/api/me/tours/${id}`, { method: 'PUT' }).catch(() => {})
}

/** "Show all tours again" (My settings). */
export async function resetTours(queryClient: QueryClient) {
  await apiFetch('/api/me/tours', { method: 'DELETE' })
  queryClient.setQueryData(['tours'], { seen: [] })
}

/** Connects ending a tour to saving it; mounted once with the layer. */
export function useTourSaving() {
  const queryClient = useQueryClient()
  useEffect(() => {
    onEnd = (id) => markSeen(queryClient, id)
    return () => {
      onEnd = null
    }
  }, [queryClient])
}

/** `usePageTour` for a page that shows its tour only in one of its states (the running game). */
export function PageTour({ id, ready = true }: { id: TourId; ready?: boolean }) {
  usePageTour(id, ready)
  return null
}

/**
 * A page's tour: offered by "Show this page's tour" while the page is open, and started by itself
 * once `ready` (the page's data is there), a moment after the page settled, if it was never seen.
 * Leaving the page ends it.
 */
export function usePageTour(id: TourId, ready = true) {
  const host = isHostTour(id)
  const seenOnAccount = useQuery({ ...toursQueryOptions, enabled: host })
  const seen = host ? (seenOnAccount.data ? seenOnAccount.data.seen.includes(id as HostTourId) : undefined) : null

  useEffect(() => {
    pageTours = [...pageTours, id]
    emit()
    return () => {
      pageTours = pageTours.filter((tour, index) => tour !== id || index !== pageTours.lastIndexOf(id))
      if (active?.id === id) endTour()
      emit()
    }
  }, [id])

  useEffect(() => {
    if (!ready || seen === true || seen === undefined) return
    const device = readDevice()
    if (device === 'off' || (!host && device.includes(id))) return
    let timer: number
    const attempt = () => {
      if (active || tourBlocked(tours[id].steps) || !startTour(id)) timer = window.setTimeout(attempt, 500)
    }
    timer = window.setTimeout(attempt, 700)
    return () => window.clearTimeout(timer)
  }, [id, host, ready, seen])
}

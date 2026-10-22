import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveStatus = 'saved' | 'pending' | 'saving' | 'invalid' | 'offline' | 'error'

/** How often a save that failed for lack of a connection is tried again, besides the browser's `online` event. */
export const OFFLINE_RETRY_MS = 10_000

const browserOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

/**
 * Saves `value` `delay` ms after the last change, only while it is `valid`.
 * Saves run one after another. A save that fails because the connection is gone
 * (`isOffline(error)`) is queued: status `offline`, retried when the browser comes back
 * online and every OFFLINE_RETRY_MS. Any other failure is `error` until `retry()` or the next edit.
 * A value still waiting when the editor unmounts is saved immediately so leaving the page
 * does not lose the last edit.
 */
export function useAutosave<T>(
  value: T,
  {
    valid,
    save,
    delay = 800,
    isOffline = browserOffline,
  }: { valid: boolean; save: (value: T) => Promise<void>; delay?: number; isOffline?: (error: unknown) => boolean },
): { status: SaveStatus; retry: () => void } {
  const [status, setStatus] = useState<SaveStatus>('saved')
  const saveRef = useRef(save)
  saveRef.current = save
  const isOfflineRef = useRef(isOffline)
  isOfflineRef.current = isOffline
  const lastSaved = useRef(value)
  const waiting = useRef<{ value: T } | null>(null)
  // The newest valid value that is not known to be saved: what a retry sends.
  const unsaved = useRef<{ value: T } | null>(null)
  const queue = useRef(Promise.resolve())

  const run = useCallback((next: T) => {
    waiting.current = null
    setStatus('saving')
    queue.current = queue.current.then(async () => {
      try {
        await saveRef.current(next)
        lastSaved.current = next
        if (unsaved.current?.value === next) unsaved.current = null
        if (waiting.current === null && unsaved.current === null) setStatus('saved')
      } catch (error) {
        // A newer value is already on its way; its own result decides the status.
        if (waiting.current !== null || unsaved.current?.value !== next) return
        setStatus(isOfflineRef.current(error) ? 'offline' : 'error')
      }
    })
  }, [])

  const retry = useCallback(() => {
    if (unsaved.current && waiting.current === null) run(unsaved.current.value)
  }, [run])

  useEffect(() => {
    if (value === lastSaved.current) return
    if (!valid) {
      waiting.current = null
      setStatus('invalid')
      return
    }
    waiting.current = { value }
    unsaved.current = { value }
    setStatus('pending')
    const timer = setTimeout(() => run(value), delay)
    return () => clearTimeout(timer)
  }, [value, valid, delay, run])

  useEffect(() => {
    if (status !== 'offline') return
    window.addEventListener('online', retry)
    const timer = setInterval(retry, OFFLINE_RETRY_MS)
    return () => {
      window.removeEventListener('online', retry)
      clearInterval(timer)
    }
  }, [status, retry])

  useEffect(
    () => () => {
      if (unsaved.current) void saveRef.current(unsaved.current.value).catch(() => {})
    },
    [],
  )

  return { status, retry }
}

import { useSyncExternalStore } from 'react'

export interface ConfirmRequest {
  title: string
  body?: string
  confirmLabel: string
  danger?: boolean
}

type Pending = ConfirmRequest & { resolve: (ok: boolean) => void }

let pending: Pending | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

/**
 * Asks in the app's own confirmation dialog (`ConfirmHost`, mounted once in the root layout) instead of
 * the browser's `window.confirm`; resolves true on the confirm button, false on Cancel or Escape. A new
 * question answers the one still open with false.
 */
export function confirmAction(request: ConfirmRequest): Promise<boolean> {
  pending?.resolve(false)
  return new Promise((resolve) => {
    pending = { ...request, resolve }
    emit()
  })
}

/** Answers the open question (the host's buttons). */
export function answerConfirm(ok: boolean) {
  const current = pending
  pending = null
  emit()
  current?.resolve(ok)
}

export function useConfirmRequest(): ConfirmRequest | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => pending,
  )
}

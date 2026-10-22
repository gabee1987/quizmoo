import i18next from 'i18next'
import { toast } from 'sonner'
import { getGameStore, subscribeGameStore, type ConnectionStatus } from './socket'

/**
 * Turns connection changes of a game session into toasts: "Reconnected" once the connection is
 * back after a drop. The first connect of a session shows nothing, and the bar covers the time
 * while disconnected. Returns the unsubscribe for useEffect.
 */
export function installSocketToasts(notify: (key: string) => void = defaultNotify): () => void {
  let previous: ConnectionStatus = getGameStore().status
  let connectedBefore = previous === 'connected'
  return subscribeGameStore(() => {
    const { status } = getGameStore()
    if (status === previous) return
    if (status === 'idle' || status === 'closed') connectedBefore = false
    else if (status === 'connected') {
      if (connectedBefore && (previous === 'reconnecting' || previous === 'offline')) {
        notify('connection.reconnected')
      }
      connectedBefore = true
    }
    previous = status
  })
}

function defaultNotify(key: string) {
  // The key as id: a flapping connection replaces the toast instead of stacking them.
  toast.success(i18next.t(key), { id: key, duration: 2000 })
}

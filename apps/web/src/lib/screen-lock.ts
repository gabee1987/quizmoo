import type { QueryClient } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { apiFetch } from './api'
import { meQueryOptions } from './auth'

// Screen lock: the server decides (every host page answers 423 while locked); this only makes the
// browser notice at once. Other tabs of this browser hear it on a BroadcastChannel; other devices
// when they next ask the server (a request, or coming back to the tab).

// Not a storage key (nothing is stored), so not `quizmoo.*` like those.
const channelName = 'quizmoo-screen-lock'

/** Asks the server again whether the screens are locked, here and in this browser's other tabs. */
export function screenLockChanged(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey })
  try {
    const channel = new BroadcastChannel(channelName)
    channel.postMessage('changed')
    channel.close()
  } catch {
    // No BroadcastChannel: the other tabs notice when they are next used.
  }
}

/** In the root layout: follows locking and unlocking done in this browser's other tabs. */
export function useScreenLockSync() {
  const queryClient = useQueryClient()
  useEffect(() => {
    let channel: BroadcastChannel
    try {
      channel = new BroadcastChannel(channelName)
    } catch {
      return
    }
    channel.onmessage = () => void queryClient.invalidateQueries({ queryKey: meQueryOptions.queryKey })
    return () => channel.close()
  }, [queryClient])
}

/** The lock code or the account password; the server unlocks every game of the host. */
export function unlockScreens(secret: string): Promise<void> {
  return apiFetch<void>('/api/me/unlock', { method: 'POST', body: JSON.stringify({ secret }) })
}

/** The default lock code for new games (My settings). Only whether there is one is ever sent back. */
export const lockCodeQueryOptions = {
  queryKey: ['lockCode'],
  queryFn: async () => (await apiFetch<{ hasLockCode: boolean }>('/api/me/settings')).hasLockCode,
} as const

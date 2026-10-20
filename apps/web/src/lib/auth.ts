import { queryOptions } from '@tanstack/react-query'
import { apiFetch } from './api'

export interface User {
  id: string
  username: string
  role: 'admin' | 'editor'
  /** Created by an admin with an initial password: must change it before anything else. */
  mustChangePassword: boolean
  /** Has not accepted the terms of use in force: must before anything else (after a password change). */
  mustAcceptTerms: boolean
  /** Screen lock: the host locked their screens; every host page shows the lock screen. Only from `/api/auth/me`. */
  screenLocked?: boolean
}

export const meQueryOptions = queryOptions({
  queryKey: ['me'],
  queryFn: async () => (await apiFetch<{ user: User }>('/api/auth/me')).user,
  retry: false,
  staleTime: 5 * 60 * 1000,
  // Back to a tab: asks again, so a tab left open when the screens were locked shows the lock screen.
  refetchOnWindowFocus: 'always',
})

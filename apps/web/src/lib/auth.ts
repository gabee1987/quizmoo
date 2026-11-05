import { queryOptions, useQuery } from '@tanstack/react-query'
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

/**
 * Where "home" is on the public pages: the host's home for a logged-in host, the join page for
 * everyone else. Asks `/api/auth/session`, which answers 200 either way: `/api/auth/me` answers a
 * logged-out visitor with 401, which the browser logs as an error on every public page.
 */
export function useHomePath(): '/host' | '/' {
  // The user from a login in this tab, read from the cache without asking (logging out clears it).
  const known = useQuery({ ...meQueryOptions, enabled: false }).data !== undefined
  const session = useQuery({
    queryKey: ['session'],
    queryFn: async () => (await apiFetch<{ loggedIn: boolean }>('/api/auth/session')).loggedIn,
    enabled: !known,
    retry: false,
    staleTime: 5 * 60 * 1000,
    throwOnError: false,
  }).data
  return known || session ? '/host' : '/'
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { APP_VERSION } from '@/lib/version'

const seenKey = ['seenRelease']

function useSeenRelease() {
  return useQuery({
    queryKey: seenKey,
    queryFn: async () => (await apiFetch<{ seen: string | null }>('/api/me/release')).seen,
    staleTime: Infinity,
    retry: false,
  })
}

/** True while the host has not opened this version's notes yet (on any device). */
export function useUnseenRelease(): boolean {
  const seen = useSeenRelease()
  return seen.isSuccess && seen.data !== APP_VERSION
}

/** Opening the What's new page marks this version's notes as read for the account. */
export function useMarkReleaseSeen() {
  const queryClient = useQueryClient()
  const seen = useSeenRelease()
  const mark = useMutation({
    mutationFn: () => apiFetch<void>('/api/me/release', { method: 'PUT', body: JSON.stringify({ version: APP_VERSION }) }),
    onSuccess: () => queryClient.setQueryData(seenKey, APP_VERSION),
  })
  const unseen = seen.isSuccess && seen.data !== APP_VERSION
  const { mutate, isIdle } = mark
  useEffect(() => {
    if (unseen && isIdle) mutate()
  }, [unseen, isIdle, mutate])
}

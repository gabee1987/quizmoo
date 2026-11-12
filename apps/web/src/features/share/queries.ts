import type { ShareCodeSummary, ShareCreate, SharePreview, ShareRedeem, ShareRedeemResult } from '@quizmoo/shared'
import { queryOptions } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'

/** The host's live share codes, newest first. */
export const shareCodesQueryOptions = queryOptions({
  queryKey: ['shares'],
  queryFn: async () => (await apiFetch<{ shares: ShareCodeSummary[] }>('/api/share')).shares,
})

/** What anyone with the code sees; a wrong, expired or revoked code is `errors.shareCodeNotFound`. */
export const sharePreviewQueryOptions = (code: string) =>
  queryOptions({
    queryKey: ['share', code],
    queryFn: () => apiFetch<SharePreview>(`/api/share/${encodeURIComponent(code)}`),
    // A missing code stays missing: no retries that would use up the lookup limit.
    retry: false,
    staleTime: 60_000,
  })

export const createShareCode = (body: ShareCreate) =>
  apiFetch<{ share: ShareCodeSummary; reused: boolean }>('/api/share', { method: 'POST', body: JSON.stringify(body) })

export const revokeShareCode = (id: string) => apiFetch<void>(`/api/share/${id}`, { method: 'DELETE' })

export const redeemShareCode = (code: string, body: ShareRedeem) =>
  apiFetch<ShareRedeemResult>(`/api/share/${encodeURIComponent(code)}/redeem`, { method: 'POST', body: JSON.stringify(body) })

/** The link that opens a code's preview on this install. */
export const shareLink = (code: string) => `${window.location.origin}/share/${code}`

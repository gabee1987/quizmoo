import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './api'

/** Details set by whoever runs this install (`GET /api/site`). */
export interface SiteInfo {
  operator: string | null
  contact: string | null
  feedbackUrl: string | null
  retentionDays: number
  /** Whether hosts may sign up on /register (`REGISTRATION_OPEN`). */
  registrationOpen: boolean
}

export function useSiteInfo() {
  return useQuery({ queryKey: ['site'], queryFn: () => apiFetch<SiteInfo>('/api/site'), staleTime: Infinity })
}

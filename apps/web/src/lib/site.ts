import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './api'

/** Details set by whoever runs this install (`GET /api/site`). */
export interface SiteInfo {
  operator: string | null
  contact: string | null
  /** The hosting provider and where the data lives (`HOSTING_PROVIDER`). */
  hosting: string | null
  /** The terms of use in force (`TERMS_VERSION`). */
  termsVersion: string
  feedbackUrl: string | null
  retentionDays: number
  /** Whether hosts may sign up on /register (`REGISTRATION_OPEN`). */
  registrationOpen: boolean
  /** The e-mail provider for sign-up notices and where it keeps data (`MAIL_PROVIDER`). */
  mailProvider: string | null
}

export function useSiteInfo() {
  return useQuery({ queryKey: ['site'], queryFn: () => apiFetch<SiteInfo>('/api/site'), staleTime: Infinity })
}

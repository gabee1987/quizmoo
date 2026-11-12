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
  /** Whether hosts may sign up on /register (`REGISTRATION_OPEN`, and e-mail configured). */
  registrationOpen: boolean
  /** Hosts log in with e-mail codes; false on an install without e-mail (username and password). */
  emailLogin: boolean
  /** The e-mail provider for sign-up notices and where it keeps data (`MAIL_PROVIDER`). */
  mailProvider: string | null
}

/**
 * Read again after a minute when the tab gets focus: a server restarted with other settings (e-mail
 * switched on, sign-up opened) must not leave an open tab on the old ones until it is reloaded.
 */
export function useSiteInfo() {
  return useQuery({ queryKey: ['site'], queryFn: () => apiFetch<SiteInfo>('/api/site'), staleTime: 60_000 })
}

import type { BudgetOverride, Usage } from '@quizmoo/shared'

/** One account as `GET /api/users` lists it: who it is and what it does. */
export interface UserRow {
  id: string
  username: string
  /** The login address; null for an account from before e-mail login that has not added one. */
  email: string | null
  /** The address was confirmed with a code (an address the admin typed is confirmed by the first login). */
  emailVerified: boolean
  /** From before e-mail login: asked for an address at the next login. */
  mustAddEmail: boolean
  /** Logs in with a password (admins, older accounts, installs without e-mail). */
  hasPassword: boolean
  role: 'admin' | 'editor'
  mustChangePassword: boolean
  status: 'active' | 'pending'
  createdAt: string
  lastLoginAt: string | null
  /** The account's own budget values; a missing key follows the defaults. */
  budget: BudgetOverride
  quizzes: number
  gamesPlayed: number
  playersReached: number
  /** Unfinished games: running now or scheduled. */
  gamesActive: number
  images: number
  imageBytes: number
  /** Logins that have not ended or expired (each browser that logged in and did not log out). */
  sessions: number
  /** What the account uses, in the units of its budget. */
  usage: Usage
}

export type UserAction = 'password' | 'role' | 'logout' | 'delete' | 'budget'

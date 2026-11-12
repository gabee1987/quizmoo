import type { Avatar, BudgetOverride, Permissions, Usage, UserStatus } from '@quizmoo/shared'

/** One account as `GET /api/users` lists it: who it is and what it does. */
export interface UserRow {
  id: string
  username: string
  avatar: Avatar
  /** Features the admin switched off; a missing key means allowed. */
  permissions: Permissions
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
  status: UserStatus
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

export type UserAction = 'password' | 'role' | 'logout' | 'delete' | 'suspend' | 'reactivate'

/** One quiz on an account's page (read-only for the admin). */
export interface AccountQuiz {
  id: string
  title: string
  questionCount: number
  bytes: number
  updatedAt: string
}

export const usersQueryKey = ['users'] as const
export const accountQueryKey = (id: string) => ['users', id] as const

/** One account as `GET /api/users` lists it: who it is and what it does. */
export interface UserRow {
  id: string
  username: string
  role: 'admin' | 'editor'
  mustChangePassword: boolean
  status: 'active' | 'pending'
  createdAt: string
  lastLoginAt: string | null
  quizzes: number
  gamesPlayed: number
  playersReached: number
  /** Unfinished games: running now or scheduled. */
  gamesActive: number
  images: number
  imageBytes: number
  /** Logins that have not ended or expired (each browser that logged in and did not log out). */
  sessions: number
}

export type UserAction = 'password' | 'role' | 'logout' | 'delete'

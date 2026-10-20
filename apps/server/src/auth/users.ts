import { nanoid } from 'nanoid'
import type { Db } from '../db/index.js'
import { localCredentials, users } from '../db/schema.js'
import { hashPassword } from './password.js'

/** Creates a user with a local password. Username only: no personal data. */
export async function createUser(
  db: Db,
  username: string,
  password: string,
  role: 'admin' | 'editor' = 'editor',
  { mustChangePassword = false, status = 'active' }: { mustChangePassword?: boolean; status?: 'active' | 'pending' } = {},
) {
  const id = nanoid(12)
  const passwordHash = await hashPassword(password)
  await db.transaction(async (tx) => {
    await tx.insert(users).values({ id, username, role, mustChangePassword, status })
    await tx.insert(localCredentials).values({ userId: id, passwordHash })
  })
  return { id, username, role }
}

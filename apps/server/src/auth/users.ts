import { TERMS_VERSION } from '@quizmoo/shared'
import { nanoid } from 'nanoid'
import type { Db } from '../db/index.js'
import { localCredentials, users } from '../db/schema.js'
import { hashPassword } from './password.js'

/**
 * Creates a user with a local password. Username only: no personal data. `termsVersion` is the
 * terms the person accepted while creating it (sign-up, seed); an account made for someone else
 * (by an admin) passes null, so its owner accepts them at the first login.
 */
export async function createUser(
  db: Db,
  username: string,
  password: string,
  role: 'admin' | 'editor' = 'editor',
  {
    mustChangePassword = false,
    status = 'active',
    termsVersion = TERMS_VERSION,
  }: { mustChangePassword?: boolean; status?: 'active' | 'pending'; termsVersion?: string | null } = {},
) {
  const id = nanoid(12)
  const passwordHash = await hashPassword(password)
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id,
      username,
      role,
      mustChangePassword,
      status,
      termsVersion,
      termsAcceptedAt: termsVersion ? new Date() : null,
    })
    await tx.insert(localCredentials).values({ userId: id, passwordHash })
  })
  return { id, username, role }
}

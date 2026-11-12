import { TERMS_VERSION } from '@quizmoo/shared'
import { nanoid } from 'nanoid'
import type { Db } from '../db/index.js'
import { localCredentials, users } from '../db/schema.js'
import { hashPassword } from './password.js'

/**
 * Creates a user. With `email` the account logs in with e-mail codes and has no password; with a
 * `password` (admins, installs without e-mail) it logs in with that. `termsVersion` is the terms the
 * person accepted while creating it (sign-up, seed); an account made for someone else (by an admin)
 * passes null, so its owner accepts them at the first login. `emailVerified`: the address was just
 * confirmed with a code (sign-up); an address an admin typed is confirmed by the first login.
 */
export async function createUser(
  db: Db,
  username: string,
  password: string | null,
  role: 'admin' | 'editor' = 'editor',
  {
    mustChangePassword = false,
    status = 'active',
    termsVersion = TERMS_VERSION,
    email = null,
    emailVerified = false,
  }: {
    mustChangePassword?: boolean
    status?: 'active' | 'pending'
    termsVersion?: string | null
    email?: string | null
    emailVerified?: boolean
  } = {},
) {
  const id = nanoid(12)
  const passwordHash = password === null ? null : await hashPassword(password)
  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id,
      username,
      email,
      emailVerifiedAt: email && emailVerified ? new Date() : null,
      role,
      mustChangePassword: passwordHash !== null && mustChangePassword,
      status,
      termsVersion,
      termsAcceptedAt: termsVersion ? new Date() : null,
    })
    if (passwordHash) await tx.insert(localCredentials).values({ userId: id, passwordHash })
  })
  return { id, username, role }
}

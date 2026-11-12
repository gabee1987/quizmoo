import { allowed, type FeatureKey } from '@quizmoo/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'

/** Sends `403 { error: 'errors.featureOff' }` and returns true when the admin switched `feature` off for this account. */
export function featureOff(request: FastifyRequest, reply: FastifyReply, feature: FeatureKey): boolean {
  if (allowed(request.user!, feature)) return false
  void reply.code(403).send({ error: 'errors.featureOff' })
  return true
}

/** Parses `data` or sends `400 { error: 'errors.invalidInput', issues }` and returns null. */
export function parseOr400<T extends z.ZodType>(schema: T, data: unknown, reply: FastifyReply): z.infer<T> | null {
  const result = schema.safeParse(data)
  if (result.success) return result.data
  void reply.code(400).send({
    error: 'errors.invalidInput',
    issues: result.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code })),
  })
  return null
}

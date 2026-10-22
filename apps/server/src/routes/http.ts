import type { FastifyReply } from 'fastify'
import type { z } from 'zod'

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

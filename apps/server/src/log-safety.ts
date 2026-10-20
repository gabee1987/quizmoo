/**
 * The logger's `err` serializer. Errors from the database carry their SQL, its parameters and
 * Postgres' `detail` (which quotes values: "Key (username)=(anna) already exists"). Logged as they
 * are, a failed save would write a whole game (nicknames, answers, player tokens) or a password hash
 * into the hosting provider's logs. Those parts are dropped; type, code and stack stay for debugging.
 */
export function serializeError(error: unknown): { type: string; message: string; stack: string; [key: string]: unknown } {
  if (!(error instanceof Error)) return { type: typeof error, message: String(error), stack: '' }
  const e = error as Error & Record<string, unknown>
  const fromDatabase = 'query' in e || 'params' in e || 'parameters' in e || 'detail' in e || e.name === 'DrizzleQueryError'
  const cause = e.cause instanceof Error ? (e.cause as Error & { code?: unknown }) : undefined
  return {
    // Some libraries leave `name` as "Error"; the class name says more.
    type: e.name !== 'Error' ? e.name : e.constructor.name,
    message: fromDatabase ? 'Database query failed' : e.message,
    ...(typeof e.code === 'string' || typeof e.code === 'number' ? { code: e.code } : {}),
    ...(typeof e.statusCode === 'number' ? { statusCode: e.statusCode } : {}),
    ...(cause ? { cause: { type: cause.name, ...(cause.code !== undefined ? { code: cause.code } : {}) } } : {}),
    // A database error's stack starts with its message, which holds the query and parameters.
    stack: (fromDatabase ? e.stack?.split('\n').filter((line) => line.trimStart().startsWith('at ')).join('\n') : e.stack) ?? '',
  }
}

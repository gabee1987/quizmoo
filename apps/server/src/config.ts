import { z } from 'zod'

/** Docker Compose and hosting dashboards pass unset variables as empty strings. */
const emptyAsUnset = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === '' ? undefined : v), schema)

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  APP_ORIGIN: z.string().url().default('http://localhost:3000'),
  /** Used only by the seed script to create the first admin. */
  SEED_ADMIN_USERNAME: emptyAsUnset(z.string().trim().min(1).max(40).optional()),
  SEED_ADMIN_PASSWORD: emptyAsUnset(z.string().min(10).optional()),
  /** Finished games older than this are deleted (data minimisation). */
  RESULTS_RETENTION_DAYS: z.coerce.number().int().min(0).default(90),
  /** Finished games kept per host account; finishing one more deletes the oldest. */
  MAX_GAMES_PER_HOST: z.coerce.number().int().min(1).default(200),
  /**
   * Proxies in front of the app whose X-Forwarded-For is trusted (1 on Railway). 0 without one:
   * otherwise any client could send the header and dodge the per-IP rate limits.
   */
  TRUST_PROXY: emptyAsUnset(z.coerce.number().int().min(0).max(5).default(0)),
  /** Who runs this install and how to reach them, shown on the privacy page. */
  OPERATOR_NAME: emptyAsUnset(z.string().trim().min(1).max(100).optional()),
  OPERATOR_EMAIL: emptyAsUnset(z.string().trim().email().max(200).optional()),
  /** The hosting provider and where the data lives, named on the privacy page and imprint (a processor under the GDPR). */
  HOSTING_PROVIDER: emptyAsUnset(z.string().trim().min(1).max(200).optional()),
  /** Where the host navigation's Feedback link points; no link without it. */
  FEEDBACK_URL: emptyAsUnset(z.string().url().startsWith('https://').optional()),
  /** `true` lets anyone sign up as a host on /register; the account waits for an admin's approval. */
  REGISTRATION_OPEN: emptyAsUnset(
    z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  ),
})

export type Config = z.infer<typeof envSchema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment:\n${issues}`)
  }
  const config = result.data
  // Behind a hosting provider's proxy the app is on the internet: an http:// APP_ORIGIN (a typo)
  // would quietly drop the Secure cookie flag and HSTS. Only a venue laptop (no proxy) runs on http.
  if (config.NODE_ENV === 'production' && config.TRUST_PROXY > 0 && !config.APP_ORIGIN.startsWith('https://')) {
    throw new Error('Invalid environment:\nAPP_ORIGIN: must start with https:// in production behind a proxy (TRUST_PROXY > 0)')
  }
  return config
}

import { request } from '@playwright/test'

/**
 * Once before the suite: the E2E host accepts the terms of use in force, as anyone would at their
 * first login after a terms change. Without it every spec that logs in would land on /host/terms.
 * One login only: the whole suite shares the 10-a-minute login limit.
 */
export default async function globalSetup() {
  const username = process.env.E2E_USERNAME
  const password = process.env.E2E_PASSWORD
  if (!username || !password) return
  const api = await request.newContext({ baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000' })
  try {
    const login = await api.post('/api/auth/login', { data: { username, password } })
    if (!login.ok()) throw new Error(`E2E login failed: ${login.status()}`)
    const { user } = (await login.json()) as { user: { mustAcceptTerms?: boolean } }
    if (user.mustAcceptTerms) {
      const { termsVersion } = (await (await api.get('/api/site')).json()) as { termsVersion: string }
      const accepted = await api.post('/api/auth/terms', { data: { version: termsVersion } })
      if (!accepted.ok()) throw new Error(`Accepting the terms failed: ${accepted.status()}`)
    }
    await api.post('/api/auth/logout')
  } finally {
    await api.dispose()
  }
}

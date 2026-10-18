/**
 * Smoke test after a deploy: is the app up, served correctly, and can a game be played?
 *
 *   $env:SMOKE_USERNAME="host"; $env:SMOKE_PASSWORD="..."; node scripts/smoke.mjs https://quizmoo-xyz.up.railway.app
 *
 * Checks the health check, the SPA fallback, the manifest, the service worker, the API's 404, the
 * site details and (over https) HSTS; then logs in as the given host, creates a quiz and a game,
 * attaches the host and joins one player over Socket.IO, and waits until the host sees the player.
 * The quiz and the game are always ended and deleted again. Exits 1 on any failure.
 */
import { createRequire } from 'node:module'

const { io } = createRequire(new URL('../apps/server/package.json', import.meta.url))('socket.io-client')

const base = (process.argv[2] ?? '').replace(/\/$/, '')
const username = process.env.SMOKE_USERNAME
const password = process.env.SMOKE_PASSWORD
if (!/^https?:\/\//.test(base) || !username || !password) {
  console.error('Usage: SMOKE_USERNAME and SMOKE_PASSWORD set to a host account, then node scripts/smoke.mjs <url>')
  process.exit(2)
}

const failures = []
async function check(name, run) {
  try {
    const note = await run()
    console.log(`ok    ${name}${note ? ` (${note})` : ''}`)
  } catch (error) {
    failures.push(name)
    console.log(`FAIL  ${name}: ${error.message}`)
  }
}
function expect(condition, message) {
  if (!condition) throw new Error(message)
}
const withTimeout = (promise, ms, what) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out: ${what}`)), ms).unref())])

let cookie = ''
async function api(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : undefined
}

// ---- Serving -----------------------------------------------------------------------

await check('health check', async () => {
  const res = await fetch(`${base}/api/health`)
  const body = await res.json()
  expect(res.status === 200 && body.ok === true, `status ${res.status}, ${JSON.stringify(body)}`)
  return `${body.activeGames} games running`
})
await check('SPA fallback on a deep link', async () => {
  const res = await fetch(`${base}/play/123456`)
  expect(res.status === 200 && (await res.text()).includes('<div id="root"'), `status ${res.status}, not the app page`)
})
await check('web app manifest', async () => {
  const res = await fetch(`${base}/manifest.webmanifest`)
  expect(res.status === 200 && typeof (await res.json()).name === 'string', `status ${res.status}`)
})
await check('service worker', async () => {
  const res = await fetch(`${base}/sw.js`)
  expect(res.status === 200 && /javascript/.test(res.headers.get('content-type') ?? ''), `status ${res.status}, ${res.headers.get('content-type')}`)
})
await check('unknown API path', async () => {
  const res = await fetch(`${base}/api/nope`)
  expect(res.status === 404 && (await res.json()).error === 'notFound', `status ${res.status}`)
})
await check('site details for the privacy page', async () => {
  const site = await api('GET', '/api/site')
  expect(typeof site.retentionDays === 'number', JSON.stringify(site))
  return [site.operator ? `operator ${site.operator}` : 'no operator set', site.feedbackUrl ? 'feedback link set' : 'no feedback link'].join(', ')
})
if (base.startsWith('https://')) {
  await check('HSTS over https', async () => {
    const res = await fetch(`${base}/api/health`)
    expect(res.headers.get('strict-transport-security'), 'no Strict-Transport-Security header (is APP_ORIGIN https?)')
  })
}

// ---- A game round trip ---------------------------------------------------------------

let quizId = null
let pin = null
let gameId = null
const sockets = []
const connect = (headers) => {
  const socket = io(base, { transports: ['websocket'], reconnection: false, ...(headers ? { extraHeaders: headers } : {}) })
  sockets.push(socket)
  return withTimeout(new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket))
    socket.once('connect_error', reject)
  }), 10_000, 'socket connect')
}

try {
  await check('host login', () => api('POST', '/api/auth/login', { username, password }).then(() => undefined))
  await check('quiz and game created', async () => {
    const { quiz } = await api('POST', '/api/quizzes', {
      title: `Smoke ${new Date().toISOString()}`,
      questions: [{ type: 'single', text: 'Smoke?', options: [{ id: 'a', text: 'Yes' }, { id: 'b', text: 'No' }], correctOptionId: 'a' }],
    })
    quizId = quiz.id
    ;({ pin } = await api('POST', '/api/games', { quizId }))
    ;({ gameId } = await api('GET', `/api/games/${pin}`))
    return `PIN ${pin}`
  })
  await check('host and player over Socket.IO', async () => {
    expect(pin, 'no game')
    const host = await connect({ cookie })
    const seesPlayer = new Promise((resolve) => host.on('game:host', (s) => s.players.length === 1 && resolve(s.players[0].name)))
    const attached = await withTimeout(host.emitWithAck('host:attach', { pin }), 5000, 'host:attach')
    expect(attached.ok, `host:attach: ${attached.error}`)
    const player = await connect()
    const joined = await withTimeout(player.emitWithAck('player:join', { pin, name: 'Smoke tester' }), 5000, 'player:join')
    expect(joined.token, `player:join: ${joined.error}`)
    return `host sees ${await withTimeout(seesPlayer, 5000, 'player in the host snapshot')}`
  })
} finally {
  // Ended before deleting: the API refuses to delete a running game.
  const host = sockets[0]
  if (host?.connected) await withTimeout(host.emitWithAck('host:command', { type: 'end' }), 5000, 'end game').catch(() => {})
  for (const socket of sockets) socket.close()
  await check('clean up', async () => {
    if (gameId) await api('DELETE', `/api/games/${gameId}`)
    if (quizId) await api('DELETE', `/api/quizzes/${quizId}`)
  })
}

console.log(failures.length === 0 ? '\nSmoke test passed' : `\nSmoke test FAILED: ${failures.join(', ')}`)
process.exit(failures.length === 0 ? 0 : 1)

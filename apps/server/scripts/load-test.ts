/**
 * Load test: one host and N simulated players play a full game over Socket.IO.
 *
 *   $env:LOAD_TEST_USERNAME="admin"; $env:LOAD_TEST_PASSWORD="..."
 *   pnpm --filter @quizmoo/server exec tsx scripts/load-test.ts --players 60
 *
 * Options: --url (default http://localhost:3000), --players 60, --questions 5, --seconds 12,
 * --flap 0.2 (share of players that drop and reconnect during each question), --keep (keep the
 * quiz and game afterwards). The host account needs no other setup: the script creates its own
 * quiz and deletes it (and the game) at the end.
 *
 * Players answer after a random delay; flapping players disconnect mid-question and reconnect
 * with their token. The script survives a server restart in the middle: every client reconnects
 * and re-joins, and host commands are retried until the server is back.
 *
 * Asserts: every player is in the final standings and connected; every player answered every
 * question during which they did not drop; command fan-out (host command to the last connected
 * player's snapshot) stays under --max-fanout ms (default 200); no player ever receives a
 * snapshot with a lower `seq` than the one before; after two host messages in a row every
 * player shows the second. Exits 1 on failure.
 */
import { parseArgs } from 'node:util'
import type { ClientToServerEvents, HostCommand, HostSnapshot, PlayerSnapshot, ServerToClientEvents } from '@quizmoo/shared'
import { io, type Socket } from 'socket.io-client'

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>

const { values: args } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:3000' },
    players: { type: 'string', default: '60' },
    questions: { type: 'string', default: '5' },
    seconds: { type: 'string', default: '12' },
    flap: { type: 'string', default: '0.2' },
    'max-fanout': { type: 'string', default: '200' },
    keep: { type: 'boolean', default: false },
  },
})
const url = args.url!.replace(/\/$/, '')
const playerCount = Number(args.players)
const questionCount = Number(args.questions)
const seconds = Number(args.seconds)
const flapShare = Number(args.flap)
const maxFanout = Number(args['max-fanout'])
const username = process.env.LOAD_TEST_USERNAME
const password = process.env.LOAD_TEST_PASSWORD
if (!username || !password) {
  console.error('Set LOAD_TEST_USERNAME and LOAD_TEST_PASSWORD to a host account.')
  process.exit(2)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const random = (min: number, max: number) => min + Math.random() * (max - min)
const percentile = (values: number[], p: number) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!)
}

// ---- HTTP setup ----------------------------------------------------------------

let cookie = ''
async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : null,
  })
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`)
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]!
  return (res.status === 204 ? undefined : await res.json()) as T
}

await api('POST', '/api/auth/login', { username, password })
const questions = Array.from({ length: questionCount }, (_, i) => ({
  id: `load-q${i + 1}`,
  type: 'single' as const,
  text: `Load test question ${i + 1}`,
  timeLimitSec: seconds,
  points: 1000,
  options: ['a', 'b', 'c', 'd'].map((id) => ({ id, text: `Option ${id.toUpperCase()}` })),
  correctOptionId: 'a',
}))
const { quiz } = await api<{ quiz: { id: string } }>('POST', '/api/quizzes', { title: 'Load test', questions })
const { pin } = await api<{ pin: string }>('POST', '/api/games', { quizId: quiz.id })
const { gameId } = await api<{ gameId: string }>('GET', `/api/games/${pin}`)
console.log(`Game ${pin}: ${playerCount} players, ${questionCount} questions of ${seconds} s, ${flapShare * 100}% flapping`)

// ---- Clients ---------------------------------------------------------------------

const connect = (headers?: Record<string, string>): AppSocket =>
  io(url, {
    transports: ['websocket'],
    reconnectionDelay: 300,
    reconnectionDelayMax: 2000,
    ...(headers ? { extraHeaders: headers } : {}),
  })

let reconnects = 0
const seqRegressions: string[] = []

class Host {
  readonly socket = connect({ cookie })
  snapshot: HostSnapshot | null = null

  constructor() {
    this.socket.on('connect', () => void this.socket.emitWithAck('host:attach', { pin }))
    this.socket.on('game:host', (s) => (this.snapshot = s))
  }

  /** Retries until the server takes it (it may be restarting). */
  async command(command: HostCommand): Promise<number> {
    for (;;) {
      if (this.socket.connected) {
        const sentAt = performance.now()
        const res = await this.socket.timeout(5000).emitWithAck('host:command', command).catch(() => null)
        if (res && 'ok' in res) return sentAt
        if (res && 'error' in res && res.error !== 'errors.gameNotFound' && res.error !== 'errors.unauthorized') {
          throw new Error(`host ${command.type}: ${res.error}`)
        }
      }
      await sleep(250)
    }
  }

  async until(predicate: (s: HostSnapshot) => boolean, what: string, timeoutMs = (seconds + 60) * 1000) {
    const deadline = Date.now() + timeoutMs
    while (!this.snapshot || !predicate(this.snapshot)) {
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`)
      await sleep(25)
    }
    return this.snapshot
  }
}

class Player {
  readonly socket = connect()
  token: string | undefined
  snapshot: PlayerSnapshot | null = null
  /** Arrival time of the first snapshot per "phase:questionIndex". */
  readonly arrivals = new Map<string, number>()
  readonly answered = new Set<string>()
  readonly flapped = new Set<string>()
  readonly answerMs: number[] = []
  private scheduled: string | null = null
  private answering = false

  constructor(readonly name: string) {
    this.socket.on('connect', () => void this.join())
    this.socket.io.on('reconnect', () => reconnects++)
    this.socket.on('game:player', (s) => this.onSnapshot(s))
  }

  private async join() {
    const res = await this.socket.emitWithAck('player:join', { pin, name: this.name, ...(this.token ? { token: this.token } : {}) })
    if ('token' in res) this.token = res.token
    else console.error(`${this.name} join failed: ${res.error}`)
  }

  private onSnapshot(s: PlayerSnapshot) {
    // Snapshots must never go back in time, across reconnects too (equal is the direct emit on rejoin).
    if (this.snapshot && s.seq < this.snapshot.seq) seqRegressions.push(`${this.name}: ${this.snapshot.seq} then ${s.seq}`)
    this.snapshot = s
    const key = `${s.phase}:${s.questionIndex}`
    if (!this.arrivals.has(key)) this.arrivals.set(key, performance.now())
    const question = s.phase === 'question' ? s.question : null
    if (!question || this.answered.has(question.id) || this.scheduled === question.id) return
    this.scheduled = question.id
    setTimeout(() => void this.answer(question.id), random(300, Math.min(4000, seconds * 500)))
    if (!this.flapped.has(question.id) && Math.random() < flapShare) this.flap(question.id)
  }

  /** Drops the connection mid-question and comes back with the same token. */
  private flap(questionId: string) {
    this.flapped.add(questionId)
    setTimeout(() => {
      this.socket.disconnect()
      setTimeout(() => {
        reconnects++
        this.socket.connect()
      }, random(500, 2000))
    }, random(0, 3000))
  }

  private async answer(questionId: string) {
    const s = this.snapshot
    if (this.answered.has(questionId) || this.answering || s?.phase !== 'question' || s.question?.id !== questionId) return
    if (!this.socket.connected) {
      // Try again once reconnected: the join brings a fresh snapshot.
      this.scheduled = null
      return
    }
    this.answering = true
    const optionId = Math.random() < 0.7 ? 'a' : ['b', 'c', 'd'][Math.floor(Math.random() * 3)]!
    const sentAt = performance.now()
    const res = await this.socket
      .timeout(5000)
      .emitWithAck('player:answer', { questionId, answer: { type: 'single', optionId } })
      .catch(() => null)
    this.answering = false
    if (res && 'ok' in res) {
      this.answerMs.push(performance.now() - sentAt)
      this.answered.add(questionId)
    } else if (res && 'error' in res && res.error === 'errors.alreadyAnswered') {
      this.answered.add(questionId)
    } else {
      this.scheduled = null
    }
  }
}

// ---- The game ------------------------------------------------------------------------

const failures: string[] = []
const host = new Host()
const players = Array.from({ length: playerCount }, (_, i) => new Player(`Load ${String(i + 1).padStart(2, '0')}`))
await host.until((s) => s.players.length === playerCount, `${playerCount} players in the lobby`, 30_000)
console.log(`All ${playerCount} players joined`)

/** Command fan-out: from the host command to each connected player's first snapshot of `key`. */
async function fanout(sentAt: number, key: string): Promise<number[]> {
  const connected = players.filter((p) => p.socket.connected)
  const deadline = Date.now() + 10_000
  while (connected.some((p) => !p.arrivals.has(key)) && Date.now() < deadline) await sleep(10)
  return connected.flatMap((p) => (p.arrivals.has(key) ? [p.arrivals.get(key)! - sentAt] : []))
}

/** Two host messages in a row after the first question: every player must end up with the second. */
async function announcements() {
  const latest = 'Load message 2'
  await host.command({ type: 'announce', text: 'Load message 1' })
  await host.command({ type: 'announce', text: latest })
  const deadline = Date.now() + 10_000
  const missing = () => players.filter((p) => p.snapshot?.announcement?.text !== latest)
  while (missing().length > 0 && Date.now() < deadline) await sleep(25)
  if (missing().length > 0) failures.push(`latest message missing on ${missing().map((p) => p.name).join(', ')}`)
  else console.log(`Both messages sent; all ${playerCount} players show the latest`)
}

const rows: Record<string, string | number>[] = []
let sentAt = await host.command({ type: 'start' })
for (let index = 0; index < questionCount; index++) {
  const opened = await fanout(sentAt, `question:${index}`)
  const reveal = await host.until((s) => s.phase !== 'question' && s.questionIndex === index, `the end of question ${index + 1}`)
  const questionId = questions[index]!.id
  rows.push({
    question: index + 1,
    answered: players.filter((p) => p.answered.has(questionId)).length,
    flapped: players.filter((p) => p.flapped.has(questionId)).length,
    'answer ack p50': percentile(players.flatMap((p) => p.answerMs), 50),
    'answer ack p95': percentile(players.flatMap((p) => p.answerMs), 95),
    'fan-out p50': percentile(opened, 50),
    'fan-out max': percentile(opened, 100),
  })
  for (const p of players) p.answerMs.length = 0
  if (Math.max(0, ...opened) > maxFanout) failures.push(`question ${index + 1}: fan-out ${Math.round(Math.max(...opened))} ms > ${maxFanout} ms`)
  if (index === 0) await announcements()
  if (reveal.phase === 'reveal' || reveal.phase === 'scoreboard') {
    await sleep(300)
    sentAt = await host.command({ type: 'next' })
  }
}
const finished = await fanout(sentAt, `finished:${questionCount - 1}`)
if (Math.max(0, ...finished) > maxFanout) failures.push(`finish: fan-out ${Math.round(Math.max(...finished))} ms > ${maxFanout} ms`)
const final = await host.until((s) => s.phase === 'finished', 'the finished game')
console.table(rows)

// ---- Checks ----------------------------------------------------------------------------

await sleep(3000) // let the last flapping players come back
const standings = (await host.until((s) => s.phase === 'finished', 'final standings')).players
if (standings.length !== playerCount) failures.push(`${standings.length} players in the final standings, expected ${playerCount}`)
const offline = standings.filter((p) => !p.connected)
if (offline.length > 0) failures.push(`still offline at the end: ${offline.map((p) => p.name).join(', ')}`)

const results = await api<{ players: { name: string; points: (number | null)[] }[] }>('GET', `/api/games/${gameId}/results`)
for (const player of players) {
  const row = results.players.find((r) => r.name === player.name)
  if (!row) {
    failures.push(`${player.name} missing from the results`)
    continue
  }
  questions.forEach((q, i) => {
    if (!player.flapped.has(q.id) && row.points[i] === null) failures.push(`${player.name} has no answer for question ${i + 1}`)
  })
}
const missedWhileFlapping = players
  .map((p) => {
    const row = results.players.find((r) => r.name === p.name)
    return questions.filter((q, i) => p.flapped.has(q.id) && row?.points[i] === null).length
  })
  .reduce((sum, n) => sum + n, 0)
console.log(
  `Finished: ${final.players.length} players, ${reconnects} reconnects, ${missedWhileFlapping} answers missed while disconnected, finish fan-out max ${percentile(finished, 100)} ms`,
)
if (seqRegressions.length > 0) failures.push(`snapshot seq went back: ${seqRegressions.slice(0, 5).join('; ')}`)
else console.log('Snapshot seq never went back on any player')

host.socket.close()
for (const p of players) p.socket.close()
if (!args.keep) {
  await api('DELETE', `/api/games/${gameId}`)
  await api('DELETE', `/api/quizzes/${quiz.id}`)
}

if (failures.length > 0) {
  console.error(`FAIL\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log('PASS')

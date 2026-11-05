import type { EndAward, EndFactQuestion, EndFacts, MyEndFacts, Question } from '@quizmoo/shared'
import { denseRank } from './scoring.js'
import { rankedTeams } from './team-answers.js'
import type { GameState, Player, PlayerAnswerRecord } from './types.js'

/** Questions actually asked (a game ended early stops at the current one). */
function askedQuestions(state: GameState): Question[] {
  return state.quiz.questions.slice(0, state.questionIndex + 1)
}

function recordsOf(state: GameState, question: Question): PlayerAnswerRecord[] {
  return Object.values(state.players).flatMap((p) => (p.answers[question.id] ? [p.answers[question.id]!] : []))
}

/**
 * A question with a right answer that was scored: not a poll, not text the host never graded, and not
 * skipped (a skipped question keeps no answers). The engine's streak skips the same questions.
 */
function isScored(question: Question, records: readonly PlayerAnswerRecord[]): boolean {
  return question.type !== 'poll' && records.some((r) => r.correct !== null)
}

/** The scored questions' indexes among the asked ones, computed once per state (states are never changed in place). */
const scoredCache = new WeakMap<GameState, Set<number>>()
function scoredIndexes(state: GameState): Set<number> {
  let scored = scoredCache.get(state)
  if (!scored) {
    scored = new Set(askedQuestions(state).flatMap((q, i) => (isScored(q, recordsOf(state, q)) ? [i] : [])))
    scoredCache.set(state, scored)
  }
  return scored
}

/** Every player's rank among the players after each asked question, replayed from the points per question. */
const ranksCache = new WeakMap<GameState, Map<string, number[]>>()
function ranksAfter(state: GameState): Map<string, number[]> {
  let ranks = ranksCache.get(state)
  if (ranks) return ranks
  ranks = new Map(Object.keys(state.players).map((id) => [id, []]))
  const players = Object.values(state.players)
  const totals = new Map(players.map((p) => [p.id, 0]))
  for (const question of askedQuestions(state)) {
    for (const p of players) totals.set(p.id, totals.get(p.id)! + (p.answers[question.id]?.points ?? 0))
    for (const { id, rank } of denseRank(players.map((p) => ({ id: p.id, name: p.name, score: totals.get(p.id)! })))) {
      ranks.get(id)!.push(rank)
    }
  }
  ranksCache.set(state, ranks)
  return ranks
}

/**
 * The longest run of right answers over the scored questions; a wrong or missing answer ends a
 * run, and a partly right one neither adds to it nor ends it (as the live streak does).
 */
function bestStreak(state: GameState, player: Player): number {
  const scored = scoredIndexes(state)
  let run = 0
  let best = 0
  askedQuestions(state).forEach((question, i) => {
    if (!scored.has(i)) return
    const correct = player.answers[question.id]?.correct
    if (correct === 'partial') return
    run = correct === true ? run + 1 : 0
    best = Math.max(best, run)
  })
  return best
}

/** The player's fastest right answer. */
function fastestRight(state: GameState, player: Player): { index: number; timeMs: number } | null {
  let fastest: { index: number; timeMs: number } | null = null
  askedQuestions(state).forEach((question, index) => {
    const record = player.answers[question.id]
    if (record?.correct === true && (!fastest || record.timeMs < fastest.timeMs)) fastest = { index, timeMs: record.timeMs }
  })
  return fastest
}

/**
 * The player with the highest `value`, at least `min`. Ties go to the better final rank, then the name.
 * Players come in final rank order (`denseRank`), so the first one found wins a tie.
 */
function best(
  ranked: readonly Player[],
  valueOf: (player: Player) => { value: number; questionIndex: number | null } | null,
  min: number,
): EndAward | null {
  let award: EndAward | null = null
  for (const player of ranked) {
    const found = valueOf(player)
    if (found && found.value >= min && (!award || found.value > award.value)) award = { playerId: player.id, ...found }
  }
  return award
}

function factQuestion(question: Question, index: number, share: number): EndFactQuestion {
  return { index, text: question.text, correctShare: share }
}

/** The room's figures and awards at the end of a game. */
export function endFacts(state: GameState): EndFacts {
  const players = Object.values(state.players)
  const ranked = denseRank(players)
  const asked = askedQuestions(state)
  const scored = scoredIndexes(state)
  const shares = asked.map((question) =>
    players.length > 0 ? players.filter((p) => p.answers[question.id]?.correct === true).length / players.length : 0,
  )

  let hardest: number | null = null
  let easiest: number | null = null
  if (scored.size >= 2) {
    // Strict comparisons keep the earlier question on a tie.
    for (const i of scored) {
      if (hardest === null || shares[i]! < shares[hardest]!) hardest = i
      if (easiest === null || shares[i]! > shares[easiest]!) easiest = i
    }
    // Every question went the same way: none was harder than another.
    if (shares[hardest!] === shares[easiest!]) hardest = easiest = null
  }

  // The earliest answer minus its time: the state keeps no start time of its own (as `toResults`).
  const starts = players.flatMap((p) => Object.values(p.answers).map((r) => r.at - r.timeMs))
  const ranks = ranksAfter(state)
  const firstScored = Math.min(...scored)
  const standings = state.settings.mode === 'team' ? denseRank(rankedTeams(state)) : ranked

  // Fastest: the earlier question wins a tie, then the better rank (the scan keeps the first one found).
  let fastest: EndAward | null = null
  asked.forEach((question, index) => {
    for (const player of ranked) {
      const record = player.answers[question.id]
      if (record?.correct === true && (!fastest || record.timeMs < fastest.value)) {
        fastest = { playerId: player.id, value: record.timeMs, questionIndex: index }
      }
    }
  })

  return {
    questionCount: scored.size,
    playerCount: players.length,
    averageCorrectShare: scored.size > 0 ? [...scored].reduce((sum, i) => sum + shares[i]!, 0) / scored.size : null,
    lengthMs: starts.length > 0 && state.finishedAt !== null ? Math.max(0, state.finishedAt - Math.min(...starts)) : null,
    hardest: hardest === null ? null : factQuestion(asked[hardest]!, hardest, shares[hardest]!),
    easiest: easiest === null ? null : factQuestion(asked[easiest]!, easiest, shares[easiest]!),
    awards: {
      fastest,
      // A run of one is not a streak.
      longestStreak: best(ranked, (p) => ({ value: bestStreak(state, p), questionIndex: null }), 2),
      mostCorrect: best(ranked, (p) => ({ value: asked.filter((q) => p.answers[q.id]?.correct === true).length, questionIndex: null }), 1),
      biggestClimb:
        scored.size >= 2
          ? best(
              ranked,
              (p) => {
                const after = ranks.get(p.id)!
                return { value: after[firstScored]! - after.at(-1)!, questionIndex: null }
              },
              1,
            )
          : null,
    },
    closestFinish: standings.length >= 2 ? standings[0]!.score - standings[1]!.score : null,
  }
}

/** One player's own figures at the end of a game. */
export function myEndFacts(state: GameState, player: Player): MyEndFacts {
  const asked = askedQuestions(state)
  const times = asked.map((q) => player.answers[q.id]?.timeMs ?? null)
  const given = times.filter((t) => t !== null)
  return {
    answerTimes: times,
    bestStreak: bestStreak(state, player),
    averageTimeMs: given.length > 0 ? Math.round(given.reduce((sum, t) => sum + t, 0) / given.length) : null,
    fastest: fastestRight(state, player),
    rankAfter: ranksAfter(state).get(player.id) ?? [],
  }
}

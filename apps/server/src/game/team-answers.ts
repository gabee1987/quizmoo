import type { Answer, Question, TeamAnswerMode } from '@quizmoo/shared'
import { normalise } from './normalise.js'
import type { GameState, Player, PlayerAnswerRecord, Team, TeamAnswerRecord } from './types.js'

// Team answer modes (team mode only): who leads a team, how a team's one answer comes about,
// and when a team has answered. Pure helpers over the game state.

export function teamMode(team: Team): TeamAnswerMode {
  return team.answerMode ?? 'average'
}

/** The team scores one answer per question (majority or shared), not its members' average. */
export function answersAsOne(team: Team): boolean {
  return teamMode(team) !== 'average'
}

/** Members in join order (games saved before `joinOrder` existed fall back to the id). */
export function membersOf(state: GameState, teamId: string): Player[] {
  return Object.values(state.players)
    .filter((p) => p.teamId === teamId)
    .sort((a, b) => (a.joinOrder ?? 0) - (b.joinOrder ?? 0) || a.id.localeCompare(b.id))
}

/**
 * Who should lead the team now: the captain while connected; otherwise the connected member who
 * joined first, so a dropped phone never leaves a team without one. With nobody connected the
 * captain stays. Null for a team without members.
 */
export function captainOf(state: GameState, team: Team): string | null {
  const members = membersOf(state, team.id)
  const current = members.find((m) => m.id === team.captainId)
  if (current?.connected) return current.id
  return members.find((m) => m.connected)?.id ?? current?.id ?? members[0]?.id ?? null
}

/** Votes count as the same answer when this matches: text normalised, multiple choice as a set, ordering as the whole order. */
export function voteKey(answer: Answer): string {
  switch (answer.type) {
    case 'single':
    case 'poll':
      return answer.optionId
    case 'multiple':
      return [...answer.optionIds].sort().join(',')
    case 'truefalse':
      return String(answer.value)
    case 'text':
      return normalise(answer.value)
    case 'number':
      return String(answer.value)
    case 'order':
      return answer.optionIds.join(',')
  }
}

export interface Vote {
  playerId: string
  record: PlayerAnswerRecord
}

/** The members' answers to a question, in the order they were given. */
export function votesOf(state: GameState, teamId: string, questionId: string): Vote[] {
  return membersOf(state, teamId)
    .flatMap((p) => (p.answers[questionId] ? [{ playerId: p.id, record: p.answers[questionId]! }] : []))
    .sort((a, b) => a.record.at - b.record.at)
}

/** Votes grouped by answer, most votes first; a tie keeps the answer given first in front. */
export function voteTally(votes: readonly Vote[]): { answer: Answer; votes: Vote[] }[] {
  const groups = new Map<string, { answer: Answer; votes: Vote[] }>()
  for (const vote of [...votes].sort((a, b) => a.record.at - b.record.at)) {
    const key = voteKey(vote.record.answer)
    const group = groups.get(key)
    if (group) group.votes.push(vote)
    else groups.set(key, { answer: vote.record.answer, votes: [vote] })
  }
  // Stable sort: equal counts stay in first-given order.
  return [...groups.values()].sort((a, b) => b.votes.length - a.votes.length)
}

/**
 * The team's answer from its members' votes, or null without votes. The answer most members
 * gave wins, a tie goes to the one given first. Number questions take the median vote (with an
 * even count the lower middle one), so the answer is always one a member gave. The time is the
 * median time of the votes for the winning answer.
 */
export function majorityAnswer(votes: readonly Vote[]): { answer: Answer; at: number; timeMs: number } | null {
  if (votes.length === 0) return null
  let winners: Vote[]
  if (votes[0]!.record.answer.type === 'number') {
    const value = (v: Vote) => (v.record.answer.type === 'number' ? v.record.answer.value : 0)
    const median = value(lowerMedian([...votes].sort((a, b) => value(a) - value(b)))!)
    winners = votes.filter((v) => value(v) === median)
  } else {
    winners = voteTally(votes)[0]!.votes
  }
  const first = [...winners].sort((a, b) => a.record.at - b.record.at)[0]!
  const timed = lowerMedian([...winners].sort((a, b) => a.record.timeMs - b.record.timeMs))!
  return { answer: first.record.answer, at: timed.record.at, timeMs: timed.record.timeMs }
}

function lowerMedian<T>(sorted: readonly T[]): T | undefined {
  return sorted[Math.floor((sorted.length - 1) / 2)]
}

/**
 * The team's answer to a question as it stands: the stored one (shared mode, or once revealed),
 * else the majority of the votes so far. Null for average teams and teams without an answer.
 */
export function teamAnswerNow(state: GameState, team: Team, questionId: string): TeamAnswerRecord | null {
  if (!answersAsOne(team)) return null
  const stored = team.answers?.[questionId]
  if (stored) return stored
  if (teamMode(team) !== 'majority') return null
  const majority = majorityAnswer(votesOf(state, team.id, questionId))
  return majority && { ...majority, byPlayerId: null, points: 0, correct: null }
}

/**
 * The team has its answer: shared once it is set; majority and average once someone answered
 * and every connected member has.
 */
export function teamAnswered(state: GameState, team: Team, questionId: string): boolean {
  if (teamMode(team) === 'shared') return Boolean(team.answers?.[questionId])
  const members = membersOf(state, team.id)
  return members.some((m) => m.answers[questionId]) && members.every((m) => !m.connected || m.answers[questionId])
}

/** Whether the player has an answer to the question: their own, or their team's shared one. */
export function hasAnswered(state: GameState, player: Player, questionId: string): boolean {
  if (player.answers[questionId]) return true
  const team = player.teamId ? state.teams[player.teamId] : undefined
  return Boolean(team && teamMode(team) === 'shared' && team.answers?.[questionId])
}

/**
 * Every answer that counts once in the distribution bars: a one-answer team's answer once
 * (when it is stored), everyone else's own answer (majority votes while the question runs).
 */
export function countedAnswers(state: GameState, question: Question): (PlayerAnswerRecord | TeamAnswerRecord)[] {
  const records: (PlayerAnswerRecord | TeamAnswerRecord)[] = []
  const teamsCounted = new Set<string>()
  for (const player of Object.values(state.players)) {
    const team = player.teamId ? state.teams[player.teamId] : undefined
    const teamRecord = team && answersAsOne(team) ? team.answers?.[question.id] : undefined
    if (team && teamRecord) {
      if (!teamsCounted.has(team.id)) records.push(teamRecord)
      teamsCounted.add(team.id)
      continue
    }
    const record = player.answers[question.id]
    if (record) records.push(record)
  }
  return records
}

/** A team's gain on a question: one answer's points for a one-answer team, else the rounded mean of its members' points. */
export function teamGain(team: Team, memberPoints: readonly number[]): number {
  if (memberPoints.length === 0) return 0
  if (answersAsOne(team)) return memberPoints[0]!
  return Math.round(memberPoints.reduce((sum, p) => sum + p, 0) / memberPoints.length)
}

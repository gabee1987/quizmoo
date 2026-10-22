import type { GameResults, PodiumPlace, ResultQuestion } from '@quizmoo/shared'
import { hasCorrectAnswer } from './question-stats'

/** The headline figures of a game's results, shown before the tables. */
export interface ResultsSummary {
  playerCount: number
  questionCount: number
  /** Mean share (0 to 1) of all players who were right, over questions with a right answer; null without any. */
  averageCorrect: number | null
  /** Mean answer time in ms over every answer given; null when nobody answered. */
  averageTimeMs: number | null
  /** Most players right (the earlier one on a tie); null with fewer than two questions with a right answer. */
  easiest: ResultQuestion | null
  /** Fewest players right (the earlier one on a tie); null with fewer than two questions with a right answer. */
  hardest: ResultQuestion | null
}

/** How long the game was played: first question to the end; null while it runs or when nobody answered. */
export function gameLengthMs(results: Pick<GameResults, 'startedAt' | 'finishedAt'>): number | null {
  if (results.startedAt === null || results.finishedAt === null) return null
  return Math.max(0, results.finishedAt - results.startedAt)
}

/** The podium split into the winners (rank 1, more than one on a tie) and the places after them. */
export function splitPodium(podium: readonly PodiumPlace[]): { winners: PodiumPlace[]; others: PodiumPlace[] } {
  return { winners: podium.filter((p) => p.rank === 1), others: podium.filter((p) => p.rank > 1) }
}

/** Share of all players who got `question` right. */
export function correctShare(question: ResultQuestion, playerCount: number): number {
  return playerCount > 0 ? question.correctCount / playerCount : 0
}

export function summariseResults(results: GameResults): ResultsSummary {
  const playerCount = results.players.length
  // Polls and ungraded text have no right answer: they say nothing about how hard a question was.
  const scored = results.questions.filter(hasCorrectAnswer)
  const shares = scored.map((question) => correctShare(question, playerCount))

  let answers = 0
  let totalTime = 0
  for (const question of results.questions) {
    if (question.averageTimeMs === null) continue
    answers += question.answeredCount
    totalTime += question.averageTimeMs * question.answeredCount
  }

  let easiest: ResultQuestion | null = null
  let hardest: ResultQuestion | null = null
  if (scored.length >= 2) {
    // Strict comparisons keep the earlier question on a tie.
    scored.forEach((question, i) => {
      if (!easiest || shares[i]! > correctShare(easiest, playerCount)) easiest = question
      if (!hardest || shares[i]! < correctShare(hardest, playerCount)) hardest = question
    })
  }

  return {
    playerCount,
    questionCount: results.questions.length,
    averageCorrect: shares.length > 0 ? shares.reduce((sum, share) => sum + share, 0) / shares.length : null,
    averageTimeMs: answers > 0 ? totalTime / answers : null,
    easiest,
    hardest,
  }
}

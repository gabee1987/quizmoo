import {
  fallbackAvatar,
  type Answer,
  type GameResults,
  type PodiumPlace,
  type Question,
  type ResultPlayer,
  type ResultQuestion,
} from '@quizmoo/shared'
import { resultsPendingFor } from './engine.js'
import { denseRank } from './scoring.js'
import { isRevealed, revealInfo, teamAnswers } from './snapshots.js'
import { captainOf, teamMode } from './team-answers.js'
import type { GameState } from './types.js'

/**
 * Results of a game, derived from its state. Covers the questions revealed so far,
 * so a finished game lists every question that was asked.
 */
export function toResults(state: GameState): GameResults {
  const lastRevealed = isRevealed(state) ? state.questionIndex : state.questionIndex - 1
  const asked = state.quiz.questions.slice(0, Math.max(0, lastRevealed + 1))
  const players = Object.values(state.players)

  const questions: ResultQuestion[] = asked.map((question, index) => {
    const times = players.flatMap((p) => (p.answers[question.id] ? [p.answers[question.id]!.timeMs] : []))
    return {
      ...revealInfo(state, question),
      index,
      averageTimeMs: times.length > 0 ? Math.round(times.reduce((sum, t) => sum + t, 0) / times.length) : null,
      teamAnswers: teamAnswers(state, index) ?? [],
    }
  })

  const rankedPlayers: ResultPlayer[] = denseRank(players).map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar ?? fallbackAvatar(p.id),
    teamId: p.teamId,
    score: p.score,
    rank: p.rank,
    correctCount: asked.filter((q) => p.answers[q.id]?.correct === true).length,
    points: asked.map((q) => p.answers[q.id]?.points ?? null),
  }))
  const teams = denseRank(Object.values(state.teams)).map((t) => ({
    id: t.id,
    name: t.name,
    score: t.score,
    rank: t.rank,
    // Final standings: nothing is pending, so there is no earlier rank to compare with.
    previousRank: t.rank,
    memberCount: players.filter((p) => p.teamId === t.id).length,
    answerMode: teamMode(t),
    captainId: captainOf(state, t),
    answered: false,
  }))
  const podium: PodiumPlace[] = (
    state.settings.mode === 'team' ? teams.map((t) => ({ ...t, avatar: null })) : rankedPlayers
  )
    .filter((place) => place.rank <= 3)
    .map(({ id, name, avatar, score, rank }) => ({ id, name, avatar, score, rank }))

  return {
    gameId: state.id,
    pin: state.pin,
    quizTitle: state.quiz.title,
    mode: state.settings.mode,
    phase: state.phase,
    createdAt: state.createdAt,
    finishedAt: state.finishedAt,
    podium,
    players: rankedPlayers,
    teams,
    questions,
    pendingRelease: { screen: resultsPendingFor(state, 'screen'), players: resultsPendingFor(state, 'players') },
  }
}

export type CsvLanguage = 'hu' | 'en'

const csvHeaders: Record<
  CsvLanguage,
  { rank: string; name: string; team: string; total: string; teamAnswer: string; true: string; false: string }
> = {
  hu: { rank: 'Helyezés', name: 'Név', team: 'Csapat', total: 'Összesen', teamAnswer: 'Csapat válasza', true: 'Igaz', false: 'Hamis' },
  en: { rank: 'Rank', name: 'Name', team: 'Team', total: 'Total', teamAnswer: 'Team answer', true: 'True', false: 'False' },
}

/**
 * Player table as CSV for Excel: UTF-8 with BOM (keeps accents), `;` separator
 * (the Hungarian Excel default), CRLF lines. One column per question with its points;
 * empty where the player did not answer. Teams that answered as one follow after an empty
 * line with their answer to each question.
 */
export function toCsv(results: GameResults, language: CsvLanguage): string {
  const headers = csvHeaders[language]
  const teamNames = new Map(results.teams.map((t) => [t.id, t.name]))
  const rows: (string | number)[][] = [
    [headers.rank, headers.name, headers.team, headers.total, ...results.questions.map((q) => `${q.index + 1}. ${q.question.text}`)],
    ...results.players.map((p) => [
      p.rank,
      p.name,
      p.teamId ? (teamNames.get(p.teamId) ?? '') : '',
      p.score,
      ...p.points.map((points) => points ?? ''),
    ]),
  ]
  const answeringTeams = results.teams.filter((t) => results.questions.some((q) => q.teamAnswers.some((a) => a.teamId === t.id)))
  if (answeringTeams.length > 0) {
    rows.push([], [headers.teamAnswer, headers.team, '', '', ...results.questions.map((q) => `${q.index + 1}. ${q.question.text}`)])
    for (const team of answeringTeams) {
      rows.push([
        '',
        team.name,
        '',
        '',
        ...results.questions.map((q) => {
          const answer = q.teamAnswers.find((a) => a.teamId === team.id)?.answer
          return answer ? answerText(q.question, answer, headers) : ''
        }),
      ])
    }
  }
  return '﻿' + rows.map((row) => row.map(csvField).join(';')).join('\r\n') + '\r\n'
}

/** An answer as the player saw it: option texts, true or false, the text or the number. */
function answerText(question: Question, answer: Answer, labels: { true: string; false: string }): string {
  const option = (id: string) => ('options' in question ? (question.options.find((o) => o.id === id)?.text ?? '') : '')
  switch (answer.type) {
    case 'single':
    case 'poll':
      return option(answer.optionId)
    case 'multiple':
      return answer.optionIds.map(option).join(', ')
    case 'order':
      return answer.optionIds.map(option).join(' > ')
    case 'truefalse':
      return answer.value ? labels.true : labels.false
    case 'text':
      return answer.value
    case 'number':
      return String(answer.value)
  }
}

function csvField(value: string | number): string {
  if (typeof value === 'number') return String(value)
  // Nicknames are typed by players: a leading = + - @ would run as an Excel formula.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[;"\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

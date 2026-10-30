import { defaultCustomPalette, type GameSettings } from '@quizmoo/shared'
import type { GameQuiz } from './types.js'

/** One question of each type with deterministic ids, 20 s and 1000 points each. */
export function fixtureQuiz(): GameQuiz {
  const base = { timeLimitSec: 20, points: 1000 }
  return {
    id: 'quiz-1',
    title: 'Fixture quiz',
    description: '',
    questions: [
      {
        ...base,
        id: 'q-single',
        type: 'single',
        text: 'Capital of Hungary?',
        options: [
          { id: 'a', text: 'Budapest' },
          { id: 'b', text: 'Debrecen' },
          { id: 'c', text: 'Szeged' },
        ],
        correctOptionId: 'a',
      },
      {
        ...base,
        id: 'q-multiple',
        type: 'multiple',
        text: 'Which are even?',
        options: [
          { id: 'a', text: '2' },
          { id: 'b', text: '3' },
          { id: 'c', text: '4' },
        ],
        correctOptionIds: ['a', 'c'],
      },
      { ...base, id: 'q-truefalse', type: 'truefalse', text: 'The Danube flows through Budapest.', correct: true },
      { ...base, id: 'q-text', type: 'text', text: 'City with the Rába river?', acceptedAnswers: ['Győr'] },
      { ...base, id: 'q-number', type: 'number', text: 'Year of the Chain Bridge opening?', correct: 1849, tolerance: 2 },
      {
        ...base,
        id: 'q-poll',
        type: 'poll',
        text: 'Favourite season?',
        options: [
          { id: 'a', text: 'Summer' },
          { id: 'b', text: 'Winter' },
        ],
      },
    ],
  }
}

export function fixtureSettings(overrides: Partial<GameSettings> = {}): GameSettings {
  return {
    mode: 'classic',
    speedBonus: true,
    streakBonus: false,
    typoTolerance: true,
    answerChanges: false,
    answerLockSec: 0,
    shuffleOptions: false,
    shuffleQuestions: false,
    groupIntroSec: 0,
    groupStandings: 'afterGroup',
    countdownSec: 0,
    betweenQuestions: { progress: true, next: true, leaders: true },
    teamNames: [],
    teamSetup: 'host',
    soloPlayers: false,
    lateJoin: false,
    teamAnswer: 'average',
    teamsChoose: false,
    revealAnswers: 'afterQuestion',
    scoreboard: 'afterQuestion',
    answerStyle: 'plain',
    answerPalette: 'vivid',
    answerSymbols: 'shapes',
    finalResults: 'immediately',
    theme: 'classic',
    customTheme: { hue: 277, accent: 330, chroma: 1 },
    customPalette: [...defaultCustomPalette],
    ...overrides,
  }
}

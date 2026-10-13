import { z } from 'zod'

// ---- Question types -------------------------------------------------------

export const questionTypes = ['single', 'multiple', 'truefalse', 'text', 'number', 'poll', 'order'] as const
export type QuestionType = (typeof questionTypes)[number]

export const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1).max(200),
  imageId: z.string().optional(),
})
export type Option = z.infer<typeof optionSchema>

const baseQuestion = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1).max(500),
  imageId: z.string().optional(),
  timeLimitSec: z.number().int().min(5).max(180).default(20),
  points: z.number().int().min(0).max(5000).default(1000),
})

export const singleChoiceQuestionSchema = baseQuestion.extend({
  type: z.literal('single'),
  options: z.array(optionSchema).min(2).max(6),
  correctOptionId: z.string().min(1),
})

export const multipleChoiceQuestionSchema = baseQuestion.extend({
  type: z.literal('multiple'),
  options: z.array(optionSchema).min(2).max(6),
  correctOptionIds: z.array(z.string().min(1)).min(1),
})

export const trueFalseQuestionSchema = baseQuestion.extend({
  type: z.literal('truefalse'),
  correct: z.boolean(),
})

export const textQuestionSchema = baseQuestion.extend({
  type: z.literal('text'),
  /** Accepted answers, compared case- and accent-insensitively. Empty list means the host grades manually. */
  acceptedAnswers: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
})

export const numberQuestionSchema = baseQuestion.extend({
  type: z.literal('number'),
  correct: z.number(),
  /** Answers within +/- tolerance count as correct. 0 means exact. */
  tolerance: z.number().min(0).default(0),
})

export const pollQuestionSchema = baseQuestion.extend({
  type: z.literal('poll'),
  options: z.array(optionSchema).min(2).max(6),
})

/** "Put in order": the options in their correct order. Players see them shuffled. */
export const orderQuestionSchema = baseQuestion.extend({
  type: z.literal('order'),
  options: z.array(optionSchema).min(2).max(6),
})

export const questionSchema = z.discriminatedUnion('type', [
  singleChoiceQuestionSchema,
  multipleChoiceQuestionSchema,
  trueFalseQuestionSchema,
  textQuestionSchema,
  numberQuestionSchema,
  pollQuestionSchema,
  orderQuestionSchema,
])
export type Question = z.infer<typeof questionSchema>

// ---- Quiz -----------------------------------------------------------------

/**
 * Cross-field rules the per-type schemas cannot express. Messages are i18n keys
 * (the editor shows them next to the field; the server only reports the path).
 */
function checkQuestions(questions: Question[], ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message })
  questions.forEach((question, i) => {
    if (!('options' in question)) return
    const ids = question.options.map((o) => o.id)
    if (new Set(ids).size !== ids.length) issue([i, 'options'], 'editor.errors.duplicateOptions')
    if (question.type === 'single' && !ids.includes(question.correctOptionId)) {
      issue([i, 'correctOptionId'], 'editor.errors.markCorrect')
    }
    if (question.type === 'multiple' && !question.correctOptionIds.every((id) => ids.includes(id))) {
      issue([i, 'correctOptionIds'], 'editor.errors.markCorrect')
    }
  })
  const questionIds = questions.map((q) => q.id)
  if (new Set(questionIds).size !== questionIds.length) issue([], 'editor.errors.duplicateQuestions')
}

// ---- Game settings --------------------------------------------------------

export const gameModes = ['classic', 'team'] as const
export type GameMode = (typeof gameModes)[number]

/**
 * How a team answers in team mode: every member answers and the team gets the average,
 * the team's answer is the members' majority vote, or one shared answer any member sets.
 */
export const teamAnswerModes = ['average', 'majority', 'shared'] as const
export type TeamAnswerMode = (typeof teamAnswerModes)[number]

/**
 * Visual themes for the phones, projector and host control. Hues only; light and dark mode stay the device's choice.
 * The first seven are playful, the last five (graphite onwards) are subdued for formal company events.
 */
export const gameThemes = [
  'classic',
  'arcade',
  'sunset',
  'mint',
  'ocean',
  'berry',
  'forest',
  'graphite',
  'navy',
  'petrol',
  'stone',
  'bordeaux',
] as const
export type GameTheme = (typeof gameThemes)[number]

/**
 * Six fixed answer colours (one per option index), independent of the theme so answers stand out from the background.
 * Muted and corporate are the low-saturation sets for formal events.
 */
export const answerPalettes = ['vivid', 'candy', 'neon', 'earth', 'muted', 'corporate'] as const
export type AnswerPalette = (typeof answerPalettes)[number]

/** What marks each answer option besides its colour. */
export const answerSymbols = ['shapes', 'letters', 'numbers', 'icons'] as const
export type AnswerSymbols = (typeof answerSymbols)[number]

export const gameSettingsSchema = z
  .object({
    mode: z.enum(gameModes).default('classic'),
    /** Faster correct answers earn more points (Kahoot style). */
    speedBonus: z.boolean().default(true),
    /** Correct answers in a row earn extra points: +100 from the second, up to +500. */
    streakBonus: z.boolean().default(false),
    /** Players may change their answer while the question runs; the last one counts, with its time. */
    answerChanges: z.boolean().default(false),
    /** Changes stop this many seconds before the end (0: until the time is up). First answers are still taken. */
    answerLockSec: z.number().int().min(0).max(60).default(0),
    /** Shuffle answer options per game. */
    shuffleOptions: z.boolean().default(false),
    /** Team names prepared by the host (team mode only). Players pick one when joining. */
    teamNames: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    /** How every team answers (team mode only); the host can change a team's mode in the lobby. */
    teamAnswer: z.enum(teamAnswerModes).default('average'),
    /** Each team's captain may pick the team's answer mode in the lobby. */
    teamsChoose: z.boolean().default(false),
    /** When correct answers, right/wrong and scores reach players and the projector: after each question or only at the end. */
    revealAnswers: z.enum(['afterQuestion', 'atEnd']).default('afterQuestion'),
    /** Scoreboard after every question, or only when the host asks for it (and at the end). */
    scoreboard: z.enum(['afterQuestion', 'onDemand']).default('afterQuestion'),
    /** Answer buttons on phones: neutral cards with a coloured symbol badge, or fully coloured like the projector. */
    answerStyle: z.enum(['plain', 'colourful']).default('colourful'),
    /** Colours of the answer options on phones (when colourful), the projector and the result bars. */
    answerPalette: z.enum(answerPalettes).default('vivid'),
    /** Symbols shown on the answer options next to the text. */
    answerSymbols: z.enum(answerSymbols).default('shapes'),
    /** Final results (podium, ranks, answer review) on phones and the projector: as soon as the game ends, or when the host releases them. */
    finalResults: z.enum(['immediately', 'onRelease']).default('immediately'),
    /** Colour theme of the game views. */
    theme: z.enum(gameThemes).default('classic'),
  })
  .superRefine(checkTeams)
export type GameSettings = z.infer<typeof gameSettingsSchema>

/** Team mode needs at least two distinct team names. Messages are i18n keys. */
function checkTeams(settings: { mode: GameMode; teamNames: string[] }, ctx: z.RefinementCtx) {
  if (settings.mode !== 'team') return
  const names = settings.teamNames.map((n) => n.toLowerCase())
  if (names.length < 2) ctx.addIssue({ code: 'custom', path: ['teamNames'], message: 'host.create.needTwoTeams' })
  else if (new Set(names).size !== names.length) {
    ctx.addIssue({ code: 'custom', path: ['teamNames'], message: 'host.create.duplicateTeams' })
  }
}

export const quizSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(''),
  questions: z.array(questionSchema).max(100).superRefine(checkQuestions),
  /** Default settings for games of this quiz; the host can change them when starting a game. */
  settings: gameSettingsSchema.prefault({}),
})
export type Quiz = z.infer<typeof quizSchema>

/** Payload accepted by the editor when creating or updating a quiz (id assigned server-side). */
export const quizInputSchema = quizSchema.omit({ id: true })
export type QuizInput = z.infer<typeof quizInputSchema>

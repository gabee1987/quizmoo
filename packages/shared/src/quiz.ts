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

/** Colour tags the host may give questions and groups to find them in the editor; no game screen shows them. */
export const tagColors = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'] as const
export const tagColorSchema = z.enum(tagColors)
export type TagColor = z.infer<typeof tagColorSchema>

const baseQuestion = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1).max(500),
  imageId: z.string().optional(),
  timeLimitSec: z.number().int().min(5).max(180).default(20),
  points: z.number().int().min(0).max(5000).default(1000),
  /** The group (round) the question belongs to; none for questions outside every group. */
  groupId: z.string().min(1).optional(),
  color: tagColorSchema.optional(),
  /** Switched off: kept in the quiz, but new games leave it out (`playableQuiz`). Missing: on. */
  off: z.boolean().optional(),
})

/** What new questions start with, set per quiz and as the host's default for new quizzes. */
export const questionDefaultsSchema = z.object({
  timeLimitSec: baseQuestion.shape.timeLimitSec,
  points: baseQuestion.shape.points,
})
export type QuestionDefaults = z.infer<typeof questionDefaultsSchema>

/**
 * The questions a game plays: switched-off ones left out, and the groups left without a question
 * with them (a group whose questions are all off is skipped, intro included).
 */
export function playableQuiz<Q extends { off?: boolean | undefined; groupId?: string | undefined }, G extends { id: string }>(
  questions: Q[],
  groups: G[],
): { questions: Q[]; groups: G[] } {
  const kept = questions.filter((q) => !q.off)
  const used = new Set(kept.map((q) => q.groupId))
  return { questions: kept, groups: groups.filter((g) => used.has(g.id)) }
}

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
 * How a team answers in team mode: the members suggest and the captain confirms the team's answer,
 * the members' majority vote counts, or every member answers and the team gets the average ("Everyone counts").
 */
export const teamAnswerModes = ['captain', 'majority', 'average'] as const
export type TeamAnswerMode = (typeof teamAnswerModes)[number]

/** A team answer mode; quizzes and games saved with the removed "one shared answer" play it as captain decides. */
export const teamAnswerModeSchema = z.preprocess((value) => (value === 'shared' ? 'captain' : value), z.enum(teamAnswerModes))

/** At most this many teams in a game, the host's and the players' together. */
export const MAX_TEAMS = 30

/** A team's name, from the host or from the player who created it. */
export const teamNameSchema = z.string().trim().min(1).max(40)

/**
 * Who makes a team game's teams: the host's list (players pick one), the players (each may create
 * one when joining), or both (the host's list plus "New team").
 */
export const teamSetups = ['host', 'players', 'both'] as const
export type TeamSetup = (typeof teamSetups)[number]

/** Players may create teams in this setup. */
export function playersCreateTeams(setup: TeamSetup): boolean {
  return setup !== 'host'
}

/**
 * Visual themes for the phones, projector and host control. Hues only; light and dark mode stay the device's choice.
 * The first seven are playful, the next five (graphite to bordeaux) are subdued for formal company events,
 * and `custom` takes the host's own colours from `customTheme`.
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
  'custom',
] as const
export type GameTheme = (typeof gameThemes)[number]

/**
 * The host's own theme (`theme: 'custom'`), in the terms every theme is built from: the main hue,
 * the accent hue (degrees on the colour wheel) and the colour strength (1 is as vivid as Classic,
 * 0 is black and white). Lightness stays the app's, so text keeps its contrast in both colour modes
 * whatever is picked.
 */
export const customThemeSchema = z.object({
  hue: z.number().int().min(0).max(359),
  accent: z.number().int().min(0).max(359),
  chroma: z.number().min(0).max(1.2),
})
export type CustomTheme = z.infer<typeof customThemeSchema>

/**
 * Six fixed answer colours (one per option index), independent of the theme so answers stand out from the background.
 * Muted and corporate are the low-saturation sets for formal events.
 */
export const answerPalettes = ['vivid', 'candy', 'neon', 'earth', 'muted', 'corporate', 'custom'] as const
export type AnswerPalette = (typeof answerPalettes)[number]

/**
 * The host's own answer colours (`answerPalette: 'custom'`): any colour per option index, as
 * `#rrggbb`. The text on each is picked by the app (white or dark, whichever reads better).
 */
export const customPaletteSchema = z
  .array(z.string().regex(/^#[0-9a-f]{6}$/i).toLowerCase())
  .length(6)
export type CustomPalette = z.infer<typeof customPaletteSchema>
/** Vivid's colours, the custom palette's starting point. */
export const defaultCustomPalette: CustomPalette = ['#db1a2b', '#1957d2', '#f9cc21', '#098926', '#f77f00', '#7a31ca']

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
    /**
     * Typed answers with small typos still count (a near miss): up to 3 characters none, 4 to 7 one,
     * 8 or more two; the digits in an answer stay exact. For the whole game, never one group.
     */
    typoTolerance: z.boolean().default(true),
    /** Players may change their answer while the question runs; the last one counts, with its time. */
    answerChanges: z.boolean().default(false),
    /** Changes stop this many seconds before the end (0: until the time is up). First answers are still taken. */
    answerLockSec: z.number().int().min(0).max(60).default(0),
    /** Shuffle answer options per game. */
    shuffleOptions: z.boolean().default(false),
    /** Shuffle the question order per game, within each group (`shuffleQuestionOrder`). */
    shuffleQuestions: z.boolean().default(false),
    /**
     * The host's teams for a game (team mode; ignored when only players create teams). Set in the new
     * game dialog; a quiz's saved names (from before teams were set per game) prefill it.
     */
    teamNames: z.array(teamNameSchema).max(MAX_TEAMS).default([]),
    /** Team mode: who makes the teams. */
    teamSetup: z.enum(teamSetups).default('host'),
    /** Team mode: a player may also play on their own, ranked with the teams. */
    soloPlayers: z.boolean().default(false),
    /** New players may join a game that has started (classic and team mode). */
    lateJoin: z.boolean().default(false),
    /** Team mode: every team's starting mode when teams choose, otherwise the mode of every team. */
    teamAnswer: teamAnswerModeSchema.default('captain'),
    /** Each team's captain may pick the team's answer mode in the lobby. */
    teamsChoose: z.boolean().default(true),
    /**
     * When correct answers, right/wrong and scores reach players and the projector: after each question,
     * after each group's last question (questions outside a group: after each question), or only at the end.
     */
    revealAnswers: z.enum(['afterQuestion', 'afterGroup', 'atEnd']).default('afterQuestion'),
    /** Scoreboard after every question, or only when the host asks for it (and at the end). */
    scoreboard: z.enum(['afterQuestion', 'onDemand']).default('afterQuestion'),
    /** A group's intro screen moves on after this many seconds; 0 waits for the host. */
    groupIntroSec: z.number().int().min(0).max(120).default(0),
    /** Standings after each group's last question, or only when the host asks for them. */
    groupStandings: z.enum(['afterGroup', 'onDemand']).default('afterGroup'),
    /** A 3-2-1 countdown on every screen before each question opens; 0 opens it at once. */
    countdownSec: z.union([z.literal(0), z.literal(3), z.literal(5)]).default(0),
    /** What the projector shows between questions (the phones the first two, compactly). Leaders never while results are held back. */
    betweenQuestions: z
      .object({
        /** How far the game (and the round) is, and the time left. */
        progress: z.boolean().default(true),
        /** The next question's number, type, time and points, never its text. */
        next: z.boolean().default(true),
        /** The top 3 so far. */
        leaders: z.boolean().default(true),
      })
      .prefault({}),
    /** Answer buttons on phones: neutral cards with a coloured symbol badge, or fully coloured like the projector. */
    answerStyle: z.enum(['plain', 'colourful']).default('colourful'),
    /** Colours of the answer options on phones (when colourful), the projector and the result bars. */
    answerPalette: z.enum(answerPalettes).default('vivid'),
    /** The colours of the custom answer palette; kept when another palette is picked, so switching back restores them. */
    customPalette: customPaletteSchema.default(() => [...defaultCustomPalette]),
    /** Symbols shown on the answer options next to the text. */
    answerSymbols: z.enum(answerSymbols).default('shapes'),
    /** Final results (podium, ranks, answer review) on phones and the projector: as soon as the game ends, or when the host releases them. */
    finalResults: z.enum(['immediately', 'onRelease']).default('immediately'),
    /** Colour theme of the game views. */
    theme: z.enum(gameThemes).default('classic'),
    /** The colours of the custom theme; kept when another theme is picked, so switching back restores them. */
    customTheme: customThemeSchema.default({ hue: 277, accent: 330, chroma: 1 }),
  })
export type GameSettings = z.infer<typeof gameSettingsSchema>

/**
 * A new game's settings: in team mode the host's team names must differ, and a game whose teams
 * only the host makes needs at least two. Quizzes and My settings hold no teams, so they skip this.
 */
export const newGameSettingsSchema = gameSettingsSchema.superRefine(checkTeams)

/** Messages are i18n keys. */
function checkTeams(settings: { mode: GameMode; teamNames: string[]; teamSetup: TeamSetup }, ctx: z.RefinementCtx) {
  if (settings.mode !== 'team') return
  const names = settings.teamNames.map((n) => n.toLowerCase())
  if (settings.teamSetup === 'host' && names.length < 2) {
    ctx.addIssue({ code: 'custom', path: ['teamNames'], message: 'host.create.needTwoTeams' })
  } else if (new Set(names).size !== names.length) {
    ctx.addIssue({ code: 'custom', path: ['teamNames'], message: 'host.create.duplicateTeams' })
  }
}

/** The event's name on the projector and the phones' lobby, under the host's logo: up to 60 characters, may be empty. */
export const eventNameSchema = z.string().trim().max(60)

/** A quiz's own branding; what it leaves empty comes from the host's My settings. */
export const quizBrandingSchema = z.object({
  /** False: this quiz's games start without branding (the new game dialog can still turn it on). */
  show: z.boolean().default(true),
  /** The quiz's logo, an image of the host's own; null uses the logo from My settings. */
  logoImageId: z.string().min(1).max(32).nullable().default(null),
  /** The event name its games start with; empty uses the last one the host used. */
  eventName: eventNameSchema.default(''),
})
export type QuizBranding = z.infer<typeof quizBrandingSchema>

export const MAX_QUESTIONS = 200
export const MAX_GROUPS = 50

const game = gameSettingsSchema.shape
/** The game settings a group may set for its own questions; a missing one is the game's (no defaults here). */
export const groupSettingsSchema = z.object({
  speedBonus: game.speedBonus.unwrap().optional(),
  streakBonus: game.streakBonus.unwrap().optional(),
  answerChanges: game.answerChanges.unwrap().optional(),
  answerLockSec: game.answerLockSec.unwrap().optional(),
  shuffleOptions: game.shuffleOptions.unwrap().optional(),
  // "Only at the end of the game" is for the whole game, never one group.
  revealAnswers: z.enum(['afterQuestion', 'afterGroup']).optional(),
  scoreboard: game.scoreboard.unwrap().optional(),
  groupIntroSec: game.groupIntroSec.unwrap().optional(),
  groupStandings: game.groupStandings.unwrap().optional(),
})
export type GroupSettings = z.infer<typeof groupSettingsSchema>

/** A group (round) of questions: an intro screen before its first question, and its own rules. */
export const questionGroupSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  info: z.string().trim().max(500).default(''),
  imageId: z.string().optional(),
  /** What new questions in the group start with; the editor can apply them to the group's questions. */
  timeLimitSec: baseQuestion.shape.timeLimitSec.unwrap().optional(),
  points: baseQuestion.shape.points.unwrap().optional(),
  color: tagColorSchema.optional(),
  /** Its questions keep their order when the quiz's questions are shuffled (in a game or in the editor). */
  keepOrder: z.boolean().optional(),
  settings: groupSettingsSchema.prefault({}),
})
export type QuestionGroup = z.infer<typeof questionGroupSchema>

/**
 * Groups and the questions in them: every group is known and holds at least one question, a group's
 * questions are together and in the order of `groups`. Ungrouped questions may come before, between and
 * after groups.
 */
function checkGroups(quiz: { questions: Question[]; groups: QuestionGroup[] }, ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message })
  const position = new Map(quiz.groups.map((group, g) => [group.id, g]))
  if (position.size !== quiz.groups.length) issue(['groups'], 'editor.errors.duplicateGroups')
  const used = new Set<string>()
  let current = -1
  let previous: string | undefined
  quiz.questions.forEach((question, i) => {
    const id = question.groupId
    const before = previous
    previous = id
    if (id === undefined || id === before) return
    const at = position.get(id)
    if (at === undefined) return issue(['questions', i, 'groupId'], 'editor.errors.unknownGroup')
    // A group starts here: it must not have started before, nor come before the last one in `groups`.
    const split = used.has(id)
    used.add(id)
    if (split || at < current) return issue(['questions', i, 'groupId'], 'editor.errors.groupOrder')
    current = at
  })
  quiz.groups.forEach((group, g) => {
    if (!used.has(group.id)) issue(['groups', g], 'editor.errors.emptyGroup')
  })
}

const quizShape = {
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(''),
  questions: z.array(questionSchema).max(MAX_QUESTIONS).superRefine(checkQuestions),
  groups: z.array(questionGroupSchema).max(MAX_GROUPS).default([]),
  /** Default settings for games of this quiz; the host can change them when starting a game. */
  settings: gameSettingsSchema.prefault({}),
  branding: quizBrandingSchema.prefault({}),
  questionDefaults: questionDefaultsSchema.prefault({}),
}

export const quizSchema = z.object({ id: z.string().min(1), ...quizShape }).superRefine(checkGroups)
export type Quiz = z.infer<typeof quizSchema>

/** Payload accepted by the editor when creating or updating a quiz (id assigned server-side). */
export const quizInputSchema = z.object(quizShape).superRefine(checkGroups)
export type QuizInput = z.infer<typeof quizInputSchema>

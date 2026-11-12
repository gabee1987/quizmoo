import {
  estimateGameSec,
  fallbackAvatar,
  isCorrect,
  isNearMiss,
  partialCredit,
  playableQuiz,
  pointsFor,
  settingsFor,
  streakBonusFor,
  type Answer,
  type GameSettings,
  type GroupPublic,
  type PlayerSnapshot,
  type Question,
  type QuestionGroup,
  type Verdict,
} from '@quizmoo/shared'

/** What the play-through needs of the draft. */
export interface PreviewQuiz {
  title: string
  questions: Question[]
  groups: QuestionGroup[]
  settings: GameSettings
}

/**
 * The editor's play-through of the quiz on the phone preview: one player, nothing saved. `index`
 * counts the questions a game plays (switched-off ones left out). Score and streak are kept as
 * they were before the question, so playing a question again (after an edit) takes its points back.
 */
export interface PreviewPlay {
  index: number
  /** Browser time the question opened; the timer counts from it but never closes the question. */
  startedAt: number
  /** The question as it was when it opened: an edit to it plays it again. */
  shown: string
  revealed: boolean
  answer: Answer | null
  timeMs: number | null
  correct: Verdict
  nearMiss: boolean
  points: number
  bonus: number
  scoreBefore: number
  streakBefore: number
}

/** The questions a game of this quiz plays, in order. */
export function playedQuestions(quiz: Pick<PreviewQuiz, 'questions' | 'groups'>): Question[] {
  return playableQuiz(quiz.questions, quiz.groups).questions
}

function open(quiz: PreviewQuiz, index: number, now: number, scoreBefore: number, streakBefore: number): PreviewPlay | null {
  const question = playedQuestions(quiz)[index]
  if (!question) return null
  return {
    index,
    startedAt: now,
    shown: JSON.stringify(question),
    revealed: false,
    answer: null,
    timeMs: null,
    correct: null,
    nearMiss: false,
    points: 0,
    bonus: 0,
    scoreBefore,
    streakBefore,
  }
}

/** Starts at the editor's question `from` (an index into all the questions), or the first played one after it; null when none is left. */
export function startPlay(quiz: PreviewQuiz, from: number, now: number): PreviewPlay | null {
  const ids = new Set(quiz.questions.slice(from).map((q) => q.id))
  const index = playedQuestions(quiz).findIndex((q) => ids.has(q.id))
  return index < 0 ? null : open(quiz, index, now, 0, 0)
}

/** The question being played; undefined once it was deleted or switched off. */
export function currentQuestion(quiz: PreviewQuiz, play: PreviewPlay): Question | undefined {
  return playedQuestions(quiz)[play.index]
}

/** The rules for the question being played: the game's settings with its group's overrides. */
export function rulesFor(quiz: PreviewQuiz, question: Question): GameSettings {
  return settingsFor(quiz.settings, quiz.groups.find((g) => g.id === question.groupId))
}

/**
 * Closes the question with the player's answer (or none) and scores it as the game would. The
 * timer does not close it: a late answer counts as given at the end of the time.
 */
export function reveal(quiz: PreviewQuiz, play: PreviewPlay, answer: Answer | null, now: number): PreviewPlay {
  const question = currentQuestion(quiz, play)
  if (!question || play.revealed) return play
  const rules = rulesFor(quiz, question)
  const limitMs = question.timeLimitSec * 1000
  const timeMs = answer ? Math.min(Math.max(now - play.startedAt, 0), limitMs) : null
  const correct = answer && question.type !== 'poll' ? isCorrect(question, answer, quiz.settings.typoTolerance === true) : null
  const bonus = correct === true && rules.streakBonus ? streakBonusFor(play.streakBefore + 1) : 0
  return {
    ...play,
    revealed: true,
    answer,
    timeMs,
    correct,
    nearMiss: correct === true && answer !== null && isNearMiss(question, answer, quiz.settings.typoTolerance === true),
    points:
      pointsFor(question.points, correct, timeMs ?? limitMs, limitMs, rules.speedBonus, answer ? partialCredit(question, answer) : 0) +
      bonus,
    bonus,
  }
}

/** Streak after the question: a correct answer extends it, a wrong or missing one resets it; polls, ungraded text and partly right answers leave it. */
function streakAfter(quiz: PreviewQuiz, play: PreviewPlay): number {
  if (!play.revealed) return play.streakBefore
  if (play.correct === true) return play.streakBefore + 1
  const question = currentQuestion(quiz, play)
  if (question?.type === 'poll') return play.streakBefore
  return play.correct === false || play.answer === null ? 0 : play.streakBefore
}

/** The total after the question (its points once it is revealed). */
export function scoreOf(play: PreviewPlay): number {
  return play.scoreBefore + (play.revealed ? play.points : 0)
}

/** The next played question, or null after the last one. */
export function nextQuestion(quiz: PreviewQuiz, play: PreviewPlay, now: number): PreviewPlay | null {
  return open(quiz, play.index + 1, now, scoreOf(play), streakAfter(quiz, play))
}

/** The same question from the start, its points taken back (after the host edited it). */
export function restartQuestion(quiz: PreviewQuiz, play: PreviewPlay, now: number): PreviewPlay | null {
  return open(quiz, play.index, now, play.scoreBefore, play.streakBefore)
}

function groupPublic(quiz: PreviewQuiz, played: Question[], question: Question): GroupPublic | null {
  const groups = quiz.groups.filter((g) => played.some((q) => q.groupId === g.id))
  const group = groups.find((g) => g.id === question.groupId)
  if (!group) return null
  const firstIndex = played.findIndex((q) => q.groupId === group.id)
  return {
    id: group.id,
    title: group.title,
    info: group.info,
    imageId: group.imageId ?? null,
    index: groups.indexOf(group),
    count: groups.length,
    firstIndex,
    questionCount: played.filter((q) => q.groupId === group.id).length,
    revealed: false,
  }
}

/**
 * The reveal as one player's phone would receive it, so the real reveal screen shows the result.
 * Results are always shown, even when the game holds them back until a round's or the game's end.
 */
export function revealSnapshot(quiz: PreviewQuiz, play: PreviewPlay, now: number): PlayerSnapshot | null {
  const played = playedQuestions(quiz)
  const question = played[play.index]
  if (!question) return null
  const rules = rulesFor(quiz, question)
  const next = played[play.index + 1]
  const groups = quiz.groups.filter((g) => played.some((q) => q.groupId === g.id))
  const score = scoreOf(play)
  const me = {
    id: 'preview',
    name: 'Preview',
    teamId: null,
    avatar: fallbackAvatar('preview'),
    streak: streakAfter(quiz, play),
    connected: true,
    disconnectedAt: null,
    left: false,
    score,
    rank: 1,
    previousRank: 1,
    correctCount: 0,
    roundPoints: play.points,
  }
  return {
    seq: 0,
    pin: 'preview',
    phase: 'reveal',
    mode: 'classic',
    quizTitle: quiz.title,
    questionIndex: play.index,
    questionCount: played.length,
    question: null,
    questionEndsAt: null,
    pausedAt: null,
    introEndsAt: null,
    countdownEndsAt: null,
    estimatedLeftSec: estimateGameSec(played, quiz.groups, quiz.settings, play.index + 1),
    nextQuestion: next
      ? {
          index: play.index + 1,
          type: next.type,
          timeLimitSec: next.timeLimitSec,
          points: next.points,
          groupTitle: quiz.groups.find((g) => g.id === next.groupId)?.title ?? null,
        }
      : null,
    group: groupPublic(quiz, played, question),
    groupCount: groups.length,
    reviewing: false,
    reviewQueue: null,
    serverNow: now,
    scheduledAt: null,
    joinLocked: false,
    reactionsMuted: false,
    answeredCount: play.answer ? 1 : 0,
    players: [me],
    teams: [],
    reveal: {
      question,
      distribution: {},
      correctCount: play.correct === true ? 1 : 0,
      partialCount: play.correct === 'partial' ? 1 : 0,
      answeredCount: play.answer ? 1 : 0,
      correctKeys: [],
      nearKeys: [],
    },
    awaitingGrading: false,
    settings: rules,
    answersHidden: false,
    resultsPending: false,
    announcement: null,
    nextPin: null,
    branding: null,
    endFacts: null,
    me,
    myAnswer: play.answer,
    myAnswerTimeMs: play.timeMs,
    teamLive: null,
    teamResult: null,
    teamFallback: false,
    lastPoints: play.points,
    lastBonus: play.bonus,
    lastCorrect: play.correct,
    lastNearMiss: play.nearMiss,
    myResults: null,
    myFacts: null,
  }
}

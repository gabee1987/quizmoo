import {
  fallbackAvatar,
  type Answer,
  type BrandingPublic,
  type CurrentAnswer,
  type GameSnapshotBase,
  type HostSnapshot,
  type PlayerPublic,
  type PlayerQuestionResult,
  type PlayerSnapshot,
  type PublicQuestion,
  type Question,
  type QuestionStat,
  type RevealInfo,
  type TeamAnswerPublic,
  type TeamLive,
  type TeamPublic,
} from '@quizmoo/shared'
import { normalise } from './normalise.js'
import { displayOrder } from './order.js'
import { answersHidden, quickMessagesOf, resultsPendingFor } from './engine.js'
import { denseRank } from './scoring.js'
import {
  answersAsOne,
  captainOf,
  countedAnswers,
  membersOf,
  needsConfirmation,
  rankedTeams,
  teamAnswerNow,
  teamAnswered,
  teamGain,
  teamMode,
  voteKey,
  voteTally,
  votesOf,
} from './team-answers.js'
import { EngineError, type GameState, type Player, type ResultsAudience, type Team } from './types.js'

/** Strips every correct-answer field. Built per type so a new field is never leaked by accident. */
export function toPublicQuestion(question: Question): PublicQuestion {
  switch (question.type) {
    case 'single': {
      const { correctOptionId: _, ...rest } = question
      return rest
    }
    case 'multiple': {
      const { correctOptionIds: _, ...rest } = question
      return rest
    }
    case 'truefalse': {
      const { correct: _, ...rest } = question
      return rest
    }
    case 'text': {
      const { acceptedAnswers: _, ...rest } = question
      return rest
    }
    case 'number': {
      const { correct: _, tolerance: _t, ...rest } = question
      return rest
    }
    case 'poll':
      return { ...question }
    case 'order':
      // The stored order is the answer: players get the items shuffled.
      return { ...question, options: displayOrder(question.id, question.options) }
  }
}

/**
 * Snapshot for the host control and the projector. `includeAnswers` adds the live
 * answer list; only the host room gets it, the public screen never does. Without it,
 * results held back are concealed as for players. The release flags are the projector's
 * (a host-attached projector hides what it may not show yet itself).
 */
/** `seq` is the realtime layer's broadcast counter, passed through as is. */
export function toHostSnapshot(state: GameState, now: number, { includeAnswers = false, seq = 0 } = {}): HostSnapshot {
  const base = baseSnapshot(state, now, 'screen', seq)
  const question = state.quiz.questions[state.questionIndex]
  return {
    ...(includeAnswers ? base : conceal(state, base)),
    // The question on the screens: a question shown again lists its own answers.
    currentAnswers: includeAnswers ? currentAnswers(state, base.questionIndex) : null,
    live: includeAnswers && state.phase === 'question' && question ? revealInfo(state, question) : null,
    playersWaiting: includeAnswers && resultsPendingFor(state, 'players'),
    teamAnswers: includeAnswers ? teamAnswers(state, base.questionIndex) : null,
    quickMessages: includeAnswers ? quickMessagesOf(state) : null,
  }
}

/**
 * The teams' one answers to a question: while it runs, what each one-answer team has so far;
 * afterwards the stored ones (a team the host switched since still lists the answer it gave).
 * Null without such teams.
 */
export function teamAnswers(state: GameState, index: number): TeamAnswerPublic[] | null {
  const question = state.quiz.questions[index]
  if (!question) return null
  const running = state.phase === 'question' && index === state.questionIndex
  const teams = Object.values(state.teams).filter((team) => answersAsOne(team) || team.answers?.[question.id])
  if (teams.length === 0) return null
  return teams.map((team) => {
    const record = running ? teamAnswerNow(state, team, question.id) : (team.answers?.[question.id] ?? null)
    return {
      teamId: team.id,
      answer: record?.answer ?? null,
      setBy: record?.byPlayerId ?? null,
      fallback: record?.fallback ?? false,
      correct: record?.correct ?? null,
      points: record?.points ?? 0,
    }
  })
}

/** The player's team's picks while a question runs, in every team mode. Never another team's. */
function teamLive(state: GameState, player: Player): TeamLive | null {
  const team = player.teamId ? state.teams[player.teamId] : undefined
  const question = state.quiz.questions[state.questionIndex]
  if (state.phase !== 'question' || !team || !question) return null
  const tally = voteTally(votesOf(state, team.id, question.id))
  const picked = new Set(tally.flatMap((g) => g.votes.map((v) => v.playerId)))
  // Captain decides shows only a confirmed answer; a team of one's own answer is its answer.
  const record = needsConfirmation(state, team) ? (team.answers?.[question.id] ?? null) : teamAnswerNow(state, team, question.id)
  return {
    answer: record?.answer ?? null,
    setBy: record?.byPlayerId ?? null,
    votes: tally.map((g) => ({ answer: g.answer, playerIds: g.votes.map((v) => v.playerId) })),
    waiting: membersOf(state, team.id)
      .filter((m) => !picked.has(m.id))
      .map((m) => m.id),
  }
}

/**
 * The player's team on the question its reveal shows: the team's answer (captain decides and majority
 * vote) and each member's own pick, kept on the team's answer when its members' records became copies.
 * A team of one, other phases and other teams get nothing. Nothing about correctness.
 */
function teamResult(state: GameState, player: Player, phase: GameSnapshotBase['phase'], index: number): TeamLive | null {
  const team = player.teamId ? state.teams[player.teamId] : undefined
  const question = state.quiz.questions[index]
  if (phase !== 'reveal' || !team || !question) return null
  const members = membersOf(state, team.id)
  if (members.length < 2) return null
  const record = team.answers?.[question.id]
  const picks =
    record?.picks ??
    members.flatMap((m) => (m.answers[question.id] ? [{ playerId: m.id, answer: m.answers[question.id]!.answer }] : []))
  const groups = new Map<string, { answer: Answer; playerIds: string[] }>()
  for (const pick of picks) {
    const key = voteKey(pick.answer)
    const group = groups.get(key)
    if (group) group.playerIds.push(pick.playerId)
    else groups.set(key, { answer: pick.answer, playerIds: [pick.playerId] })
  }
  const picked = new Set(picks.map((p) => p.playerId))
  return {
    answer: record?.answer ?? null,
    setBy: record?.byPlayerId ?? null,
    votes: [...groups.values()].sort((a, b) => b.playerIds.length - a.playerIds.length),
    waiting: members.filter((m) => !picked.has(m.id)).map((m) => m.id),
  }
}

export function toPlayerSnapshot(state: GameState, playerId: string, now: number, seq = 0): PlayerSnapshot {
  const base = conceal(state, baseSnapshot(state, now, 'players', seq))
  const me = base.players.find((p) => p.id === playerId)
  const player = state.players[playerId]
  if (!me || !player) throw new EngineError('errors.playerNotFound')
  // The question on the screens (a question shown again: the player's own result on it).
  const question = state.quiz.questions[base.questionIndex]
  const record = question ? player.answers[question.id] : undefined
  const team = player.teamId ? state.teams[player.teamId] : undefined
  const teamRecord = question ? team?.answers?.[question.id] : undefined
  return {
    ...base,
    me,
    myAnswer: record?.answer ?? null,
    myAnswerTimeMs: record?.timeMs ?? null,
    teamLive: teamLive(state, player),
    teamResult: teamResult(state, player, base.phase, base.questionIndex),
    teamFallback: base.phase === 'reveal' && Boolean(teamRecord?.fallback),
    lastPoints: base.reveal ? (record?.points ?? 0) : null,
    lastBonus: base.reveal ? (record?.bonus ?? 0) : null,
    lastCorrect: base.reveal ? (record?.correct ?? null) : null,
    myResults: state.phase === 'finished' && !base.answersHidden ? playerResults(state, player) : null,
  }
}

/**
 * While results are held back until the end, strips everything that tells who was right:
 * the reveal (correct answer, distribution), points, scores, ranks and correct counts.
 * The question itself stays visible during its reveal.
 */
function conceal(state: GameState, base: GameSnapshotBase): GameSnapshotBase {
  if (!base.answersHidden) return base
  const question = state.quiz.questions[state.questionIndex]
  return {
    ...base,
    question: base.reveal && question ? toPublicQuestion(question) : base.question,
    reveal: null,
    players: base.players.map((p) => ({ ...p, score: 0, rank: 1, previousRank: 1, correctCount: 0, roundPoints: 0, streak: 0 })),
    teams: base.teams.map((t) => ({ ...t, score: 0, rank: 1, previousRank: 1 })),
    questionStats: base.questionStats.map((q) => ({ ...q, correctCount: 0 })),
  }
}

/** Questions actually asked (a game ended early stops at the current one). */
function playerResults(state: GameState, player: Player): PlayerQuestionResult[] {
  const team = player.teamId ? state.teams[player.teamId] : undefined
  const inTeam = team !== undefined && membersOf(state, team.id).length > 1
  return state.quiz.questions.slice(0, state.questionIndex + 1).map((question) => {
    const record = player.answers[question.id]
    const teamRecord = inTeam ? team.answers?.[question.id] : undefined
    return {
      question,
      answer: record?.answer ?? null,
      correct: record?.correct ?? null,
      points: record?.points ?? 0,
      teamAnswer: Boolean(teamRecord),
      fallback: teamRecord?.fallback ?? false,
    }
  })
}

/** Distribution bucket of an answer: option id, 'true'/'false', normalised text, or the number. */
export function distributionKeys(answer: Answer): string[] {
  switch (answer.type) {
    case 'single':
    case 'poll':
      return [answer.optionId]
    case 'multiple':
      return answer.optionIds
    case 'truefalse':
      return [String(answer.value)]
    case 'text':
      return [normalise(answer.value)]
    case 'number':
      return [String(answer.value)]
    case 'order':
      // The whole order as one bucket (identical orders group together).
      return [answer.optionIds.join(',')]
  }
}

export function isRevealed(state: GameState): boolean {
  return state.phase === 'reveal' || state.phase === 'scoreboard' || state.phase === 'finished'
}

function baseSnapshot(state: GameState, now: number, audience: ResultsAudience, seq: number): GameSnapshotBase {
  // A question shown again between questions is shown as its reveal.
  const reviewing =
    state.reviewIndex !== null &&
    state.reviewIndex !== undefined &&
    (state.phase === 'reveal' || state.phase === 'scoreboard')
  const index = reviewing ? state.reviewIndex! : state.questionIndex
  const phase = reviewing ? 'reveal' : state.phase
  const question = state.quiz.questions[index] ?? null
  const inQuestion = phase === 'question' && question !== null
  const revealed = question !== null && isRevealed(state)
  const players = Object.values(state.players)

  // Nothing moves on a question shown again: no round points, so no rank arrows either.
  const roundPoints = (p: Player) => (revealed && question && !reviewing ? (p.answers[question.id]?.points ?? 0) : 0)
  // Ranks before this question's points: what the scoreboard shows as "moved up" or "moved down".
  const previousPlayerRank = rankLookup(players.map((p) => ({ id: p.id, name: p.name, score: p.score - roundPoints(p) })))
  const teams = rankedTeams(state)
  const previousTeamRank = rankLookup(
    teams.map((team) => {
      const members = players.filter((p) => p.teamId === team.id)
      // The stored gain (members may have moved since); games saved before it existed mirror addTeamGains.
      const stored = question && revealed && !reviewing ? team.gains?.[question.id] : undefined
      const gain = stored ?? teamGain(team, question?.id ?? '', members.map(roundPoints))
      return { id: team.id, name: team.name, score: team.score - gain }
    }),
  )

  const rankedPlayers: PlayerPublic[] = denseRank(players).map((p) => ({
    id: p.id,
    name: p.name,
    teamId: p.teamId,
    avatar: p.avatar ?? fallbackAvatar(p.id),
    streak: p.streak ?? 0,
    connected: p.connected,
    disconnectedAt: p.connected ? null : (p.disconnectedAt ?? null),
    score: p.score,
    rank: p.rank,
    previousRank: previousPlayerRank.get(p.id) ?? p.rank,
    correctCount: Object.values(p.answers).filter((a) => a.correct === true).length,
    roundPoints: roundPoints(p),
  }))
  const teamsPublic: TeamPublic[] = denseRank(teams).map((t) => ({
    id: t.id,
    name: t.name,
    ...soloOf(state, t),
    score: t.score,
    rank: t.rank,
    previousRank: previousTeamRank.get(t.id) ?? t.rank,
    memberCount: players.filter((p) => p.teamId === t.id).length,
    answerMode: teamMode(t),
    captainId: captainOf(state, t),
    answered: inQuestion && question ? teamAnswered(state, t, question.id) : false,
  }))

  return {
    seq,
    pin: state.pin,
    phase,
    mode: state.settings.mode,
    quizTitle: state.quiz.title,
    questionIndex: index,
    questionCount: state.quiz.questions.length,
    question: inQuestion ? toPublicQuestion(question) : null,
    questionEndsAt: inQuestion ? state.questionEndsAt : null,
    pausedAt: inQuestion ? (state.pausedAt ?? null) : null,
    reviewing,
    serverNow: now,
    answeredCount: question ? players.filter((p) => p.answers[question.id]).length : 0,
    players: rankedPlayers,
    teams: teamsPublic,
    reveal: revealed ? revealInfo(state, question) : null,
    awaitingGrading: reviewing ? false : state.awaitingGrading,
    questionStats: questionStats(state),
    settings: state.settings,
    answersHidden: answersHidden(state, audience),
    resultsPending: resultsPendingFor(state, audience),
    announcement: state.announcement ?? null,
    nextPin: state.nextPin ?? null,
    scheduledAt: state.scheduledAt ?? null,
    branding: brandingFor(state, audience),
  }
}

/** The game's branding for the projector, and for the phones only when the host chose to show it there. */
function brandingFor(state: GameState, audience: ResultsAudience): BrandingPublic | null {
  const branding = state.branding
  if (!branding || (audience === 'players' && !branding.onPhones)) return null
  return { logoImageId: branding.logoImageId, eventName: branding.eventName }
}

/** A solo player's entry carries their avatar, so the standings show them as a player. */
export function soloOf(state: GameState, team: Team): Pick<TeamPublic, 'solo' | 'avatar'> {
  if (!team.solo) return { solo: false, avatar: null }
  const player = membersOf(state, team.id)[0]
  return { solo: true, avatar: player ? (player.avatar ?? fallbackAvatar(player.id)) : null }
}

function rankLookup(items: { id: string; name: string; score: number }[]): Map<string, number> {
  return new Map(denseRank(items).map((item) => [item.id, item.rank]))
}

/** Distribution and correctness of one question over every player's recorded answer. */
export function revealInfo(state: GameState, question: Question): RevealInfo {
  const distribution: Record<string, number> = {}
  if ('options' in question) for (const option of question.options) distribution[option.id] = 0
  if (question.type === 'truefalse') Object.assign(distribution, { true: 0, false: 0 })

  // Counted per player (a team's members share its answer), so shares of all players stay right.
  const players = Object.values(state.players)
  const answeredCount = players.filter((p) => p.answers[question.id]).length
  const correctCount = players.filter((p) => p.answers[question.id]?.correct === true).length
  const correctKeys = new Set<string>(staticCorrectKeys(question))
  // The bars count a one-answer team's answer once.
  for (const record of countedAnswers(state, question)) {
    // Ordering: per item, how many players put it in its right place.
    const keys =
      question.type === 'order' && record.answer.type === 'order'
        ? record.answer.optionIds.filter((id, i) => question.options[i]?.id === id)
        : distributionKeys(record.answer)
    for (const key of keys) distribution[key] = (distribution[key] ?? 0) + 1
    // Number answers within tolerance and host-graded text are correct per answer, not per key list.
    if (record.correct === true && (question.type === 'number' || question.type === 'text')) {
      for (const key of keys) correctKeys.add(key)
    }
  }
  return { question, distribution, correctCount, answeredCount, correctKeys: [...correctKeys] }
}

function staticCorrectKeys(question: Question): string[] {
  switch (question.type) {
    case 'single':
      return [question.correctOptionId]
    case 'multiple':
      return question.correctOptionIds
    case 'truefalse':
      return [String(question.correct)]
    case 'text':
      return question.acceptedAnswers.map(normalise)
    case 'number':
    case 'poll':
    case 'order':
      return []
  }
}

/** Stats for every question revealed so far (the current one once it is revealed). */
function questionStats(state: GameState): QuestionStat[] {
  const lastRevealed = isRevealed(state) ? state.questionIndex : state.questionIndex - 1
  return state.quiz.questions.slice(0, Math.max(0, lastRevealed + 1)).map((question, index) => {
    const records = Object.values(state.players).flatMap((p) => (p.answers[question.id] ? [p.answers[question.id]!] : []))
    const totalTime = records.reduce((sum, r) => sum + r.timeMs, 0)
    return {
      questionId: question.id,
      index,
      text: question.text,
      type: question.type,
      answeredCount: records.length,
      correctCount: records.filter((r) => r.correct === true).length,
      averageTimeMs: records.length > 0 ? Math.round(totalTime / records.length) : null,
    }
  })
}

function currentAnswers(state: GameState, index: number): CurrentAnswer[] {
  const question = state.quiz.questions[index]
  if (!question) return []
  return Object.values(state.players)
    .flatMap((player) => {
      const record = player.answers[question.id]
      if (!record) return []
      return [
        {
          playerId: player.id,
          name: player.name,
          teamId: player.teamId,
          answer: record.answer,
          key: distributionKeys(record.answer).join(','),
          correct: record.correct,
          points: record.points,
          timeMs: record.timeMs,
        },
      ]
    })
    .sort((a, b) => a.timeMs - b.timeMs)
}

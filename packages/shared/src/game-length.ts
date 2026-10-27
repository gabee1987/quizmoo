import type { GameSettings, GroupSettings, Question } from './quiz.js'

/** Time around every question besides its limit: the reveal, the host talking, players getting ready. */
export const GRACE_SEC = 20
/** A round intro that waits for the host. */
export const HELD_INTRO_SEC = 15
/** A scoreboard the settings show by themselves (after every question, or a round's standings). */
export const SCOREBOARD_SEC = 10

type LengthQuestion = Pick<Question, 'timeLimitSec' | 'groupId' | 'off'>
type LengthGroup = { id: string; settings?: GroupSettings | undefined }
export type LengthSettings = Pick<
  GameSettings,
  'revealAnswers' | 'scoreboard' | 'groupIntroSec' | 'groupStandings' | 'countdownSec'
>

/**
 * Roughly how long questions `from` to the end take, in seconds: each one's time limit, the grace
 * time, the countdown, plus a round's intro before the first question of the round played and its
 * standings after the last, and a scoreboard after every question when the settings show one.
 * Switched-off questions count nothing.
 */
export function estimateGameSec(
  questions: readonly LengthQuestion[],
  groups: readonly LengthGroup[],
  settings: LengthSettings,
  from = 0,
): number {
  const played = questions.filter((q) => !q.off)
  const byId = new Map(groups.map((g) => [g.id, g]))
  let total = 0
  played.forEach((question, i) => {
    if (i < from) return
    const group = question.groupId === undefined ? undefined : byId.get(question.groupId)
    const rules = rulesFor(settings, group)
    total += question.timeLimitSec + GRACE_SEC + settings.countdownSec
    const inGroup = (q: LengthQuestion) => q.groupId === group?.id
    if (group && !played.slice(0, i).some(inGroup)) {
      total += rules.groupIntroSec > 0 ? rules.groupIntroSec : HELD_INTRO_SEC
    }
    const lastOfGroup = group !== undefined && !played.slice(i + 1).some(inGroup)
    if (rules.scoreboard === 'afterQuestion' && rules.revealAnswers === 'afterQuestion') total += SCOREBOARD_SEC
    else if (lastOfGroup && rules.groupStandings === 'afterGroup') total += SCOREBOARD_SEC
  })
  return total
}

/** The settings with a group's own (like the server's `settingsFor`): "at the end" is the game's, "after the round" needs a round. */
function rulesFor(settings: LengthSettings, group: LengthGroup | undefined): LengthSettings {
  const own = group?.settings ?? {}
  const merged: LengthSettings = {
    ...settings,
    ...(own.revealAnswers !== undefined && { revealAnswers: own.revealAnswers }),
    ...(own.scoreboard !== undefined && { scoreboard: own.scoreboard }),
    ...(own.groupIntroSec !== undefined && { groupIntroSec: own.groupIntroSec }),
    ...(own.groupStandings !== undefined && { groupStandings: own.groupStandings }),
  }
  if (settings.revealAnswers === 'atEnd') merged.revealAnswers = 'atEnd'
  else if (!group && merged.revealAnswers === 'afterGroup') merged.revealAnswers = 'afterQuestion'
  return merged
}

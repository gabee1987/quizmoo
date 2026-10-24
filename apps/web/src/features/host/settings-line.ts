import type { HostSnapshot } from '@quizmoo/shared'
import type { TFunction } from 'i18next'
import { answerChangesLabel, teamAnswerLabel } from './game-settings-form'

/**
 * The game's settings that differ from a plain game, as short labels for the host control. In a
 * group they are the current question's rules, led by a note when the group sets some of its own.
 */
export function settingsLine(host: HostSnapshot, t: TFunction): string[] {
  const group = host.phase === 'lobby' || host.phase === 'finished' ? null : host.group
  const ownRules = group !== null && host.groups.some((outline) => outline.id === group.id && outline.ownRules)
  const lobbyRounds = host.phase === 'lobby' && host.groups.length > 0
  return [
    lobbyRounds ? t('play.info.questionsInRounds', { questions: host.questionCount, count: host.groups.length }) : null,
    ownRules ? t('host.game.roundRules', { round: group.index + 1 }) : null,
    t(`host.create.modes.${host.settings.mode}`),
    host.settings.mode === 'team' ? teamAnswerLabel(host.settings, t) : null,
    host.settings.mode === 'team' && host.settings.soloPlayers ? t('host.create.soloPlayers') : null,
    host.settings.speedBonus ? t('host.create.speedBonus') : null,
    host.settings.streakBonus ? t('host.create.streakBonus') : null,
    answerChangesLabel(host.settings, t),
    host.settings.shuffleQuestions ? t('host.create.shuffleQuestions') : null,
    host.settings.shuffleOptions ? t('host.create.shuffle') : null,
    host.settings.revealAnswers === 'atEnd' ? t('host.create.revealAnswersOptions.atEnd') : null,
    host.settings.revealAnswers === 'afterGroup' && (group || lobbyRounds) ?t('host.create.revealAnswersOptions.afterGroup') : null,
    host.groups.length > 0 && host.settings.groupStandings === 'onDemand' ? t('host.game.standingsOnDemand') : null,
    host.settings.revealAnswers === 'afterQuestion' && host.settings.scoreboard === 'onDemand'
      ? t('host.create.scoreboardOptions.onDemand')
      : null,
    host.settings.answerStyle === 'colourful' ? t('host.create.answerStyleOptions.colourful') : null,
    host.settings.finalResults === 'onRelease' ? t('host.create.finalResultsOptions.onRelease') : null,
  ].filter((label): label is string => label !== null)
}

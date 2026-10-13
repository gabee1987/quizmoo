import type { HostSnapshot } from '@quizmoo/shared'
import type { TFunction } from 'i18next'
import { answerChangesLabel, teamAnswerLabel } from './game-settings-form'

/** The game's settings that differ from a plain game, as short labels for the host control. */
export function settingsLine(host: HostSnapshot, t: TFunction): string[] {
  return [
    t(`host.create.modes.${host.settings.mode}`),
    host.settings.mode === 'team' ? teamAnswerLabel(host.settings, t) : null,
    host.settings.speedBonus ? t('host.create.speedBonus') : null,
    host.settings.streakBonus ? t('host.create.streakBonus') : null,
    answerChangesLabel(host.settings, t),
    host.settings.shuffleOptions ? t('host.create.shuffle') : null,
    host.settings.revealAnswers === 'atEnd' ? t('host.create.revealAnswersOptions.atEnd') : null,
    host.settings.revealAnswers === 'afterQuestion' && host.settings.scoreboard === 'onDemand'
      ? t('host.create.scoreboardOptions.onDemand')
      : null,
    host.settings.answerStyle === 'colourful' ? t('host.create.answerStyleOptions.colourful') : null,
    host.settings.finalResults === 'onRelease' ? t('host.create.finalResultsOptions.onRelease') : null,
  ].filter((label): label is string => label !== null)
}

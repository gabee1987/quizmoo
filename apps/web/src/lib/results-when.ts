import type { GameSettings } from '@quizmoo/shared'

/** While answers are held back: when they come out, as an i18n key (the round's end or the game's). */
export function resultsWhen(settings: Pick<GameSettings, 'revealAnswers'>): string {
  return settings.revealAnswers === 'afterGroup' ? 'play.resultsAtRoundEnd' : 'play.resultsAtEnd'
}

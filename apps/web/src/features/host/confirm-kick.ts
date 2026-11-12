import type { TFunction } from 'i18next'
import { confirmAction } from '@/lib/confirm'

/** "Remove … from the game?", asked before the host removes a player (lobby tiles, rows and the player list). */
export function confirmKick(t: TFunction, name: string) {
  return confirmAction({ title: t('host.game.confirmKick', { name }), confirmLabel: t('host.game.kick'), danger: true })
}

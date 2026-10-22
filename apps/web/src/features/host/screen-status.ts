import type { HostSnapshot } from '@quizmoo/shared'
import { reviewPosition } from '../play/review-position'

export type Audience = 'phones' | 'projector'

/** What one audience sees right now: an i18n key under `host.seen` and its values. */
export interface SeenStatus {
  key: string
  values: Record<string, string | number>
}

/**
 * What the phones or the projector show at this moment, from the host's snapshot. They differ
 * only once the game is over, when the final results can be released to each separately.
 */
export function screenStatus(host: HostSnapshot, audience: Audience): SeenStatus {
  const index = host.questionIndex + 1
  const seen = (key: string, values: Record<string, string | number> = {}): SeenStatus => ({ key: `host.seen.${key}`, values })
  switch (host.phase) {
    case 'lobby':
      return seen('lobby')
    case 'intro':
      return seen('intro', { round: (host.group?.index ?? 0) + 1 })
    case 'question':
      return host.pausedAt ? seen('paused', { index }) : seen('question', { index })
    case 'reveal':
      if (host.reviewing) return seen('shownAgain', { index, position: reviewPosition(host) })
      if (host.awaitingGrading) return seen('grading', { index })
      return host.answersHidden ? seen('answerHidden', { index }) : seen('answer', { index })
    case 'scoreboard':
      return seen(host.answersHidden ? 'standingsTotals' : 'standings')
    case 'finished': {
      const waiting = audience === 'phones' ? host.playersWaiting : host.resultsPending
      return seen(waiting ? 'waitingResults' : 'podium')
    }
  }
}

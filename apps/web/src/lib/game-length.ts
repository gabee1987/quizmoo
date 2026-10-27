import { estimateGameSec, type GameLength, type LengthSettings } from '@quizmoo/shared'

/** An estimate in whole minutes, at least 1: the figure is rough, so seconds would promise too much. */
export function lengthMinutes(sec: number): number {
  return Math.max(1, Math.round(sec / 60))
}

/** Roughly how many minutes a quiz takes with these settings. */
export function quizMinutes(length: GameLength, settings: LengthSettings): number {
  return lengthMinutes(estimateGameSec(length.questions, length.groups, settings))
}

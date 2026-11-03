import { LEADERBOARD_SET_MS, type GameSettings } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { createGame, endGame, endQuestion, joinPlayer, next, releaseResults, startGame } from './engine.js'
import {
  END_PAGE_MS,
  RECAP_PAGE_MS,
  endPageMs,
  endPageStep,
  endPageTimeUp,
  endShowOf,
  setEndAuto,
  showEndPage,
} from './end-show.js'
import { fixtureQuiz, fixtureSettings } from './fixtures.js'
import { toHostSnapshot, toPlayerSnapshot } from './snapshots.js'
import type { GameState } from './types.js'

const T0 = 1_000_000

/** A game over after `asked` questions, with `players` players. */
function finished(asked: number, settings: Partial<GameSettings> = {}, players = 2): GameState {
  let state = createGame(fixtureQuiz(), fixtureSettings(settings), '123456', 'game-1', T0)
  for (let i = 1; i <= players; i++) state = joinPlayer(state, { id: `p${i}`, name: `Player ${i}`, token: `t${i}` })
  if (asked === 0) return endGame(state, T0)
  state = startGame(state, T0)
  for (let i = 1; i <= asked; i++) {
    state = endQuestion(state)
    if (i < asked) state = next(state, T0)
  }
  return endGame(state, T0)
}

const pages = (state: GameState) => `${endShowOf(state).page}${endShowOf(state).page === 'recap' ? endShowOf(state).recapIndex : ''}`

describe('end pages', () => {
  it('starts on the podium and goes round the results pages, never into the recap', () => {
    let state = finished(2)
    expect(endShowOf(state)).toEqual({ page: 'podium', recapIndex: 0, auto: false, pageEndsAt: null })
    const seen = [pages(state)]
    for (let i = 0; i < 5; i++) {
      state = endPageStep(state, 1, T0)
      seen.push(pages(state))
    }
    expect(seen).toEqual(['podium', 'leaderboard', 'awards', 'facts', 'podium', 'leaderboard'])
    expect(pages(endPageStep(showEndPage(state, 'podium', T0), -1, T0))).toBe('facts')
  })

  it('opens the recap only when shown, steps through its questions, then back to the results', () => {
    let state = showEndPage(finished(3), 'recap', T0)
    expect(pages(state)).toBe('recap0')
    state = endPageStep(state, 1, T0)
    expect(pages(state)).toBe('recap1')
    // The page already on: nothing changes.
    expect(showEndPage(state, 'recap', T0)).toBe(state)
    expect(pages(showEndPage(showEndPage(state, 'awards', T0), 'recap', T0))).toBe('recap0')
    // Past the last question the results start again; before the first they end at the facts.
    expect(pages(endPageStep(endPageStep(state, 1, T0), 1, T0))).toBe('podium')
    expect(pages(endPageStep(state, -1, T0))).toBe('recap0')
    expect(pages(endPageStep(endPageStep(state, -1, T0), -1, T0))).toBe('facts')
  })

  it('has no recap when no question was asked', () => {
    let state = finished(0)
    expect(() => showEndPage(state, 'recap', T0)).toThrow('errors.invalidTransition')
    state = showEndPage(state, 'facts', T0)
    expect(pages(endPageStep(state, 1, T0))).toBe('podium')
  })

  it('is refused before the end and while the projector waits for the results', () => {
    let running = createGame(fixtureQuiz(), fixtureSettings(), '123456', 'game-1', T0)
    running = startGame(joinPlayer(running, { id: 'p1', name: 'Anna', token: 't1' }), T0)
    expect(() => endPageStep(running, 1, T0)).toThrow('errors.invalidTransition')
    expect(() => setEndAuto(running, true, T0)).toThrow('errors.invalidTransition')

    const held = finished(1, { finalResults: 'onRelease' })
    expect(() => showEndPage(held, 'leaderboard', T0)).toThrow('errors.invalidTransition')
    // Released to the phones only: the projector still waits.
    expect(() => endPageStep(releaseResults(held, 'players'), 1, T0)).toThrow('errors.invalidTransition')
    expect(pages(endPageStep(releaseResults(held, 'screen'), 1, T0))).toBe('leaderboard')
  })

  it('moves round the results by itself in automatic mode, and plays a recap the host opened', () => {
    let state = setEndAuto(finished(2), true, T0)
    expect(endShowOf(state).pageEndsAt).toBe(T0 + END_PAGE_MS)
    // Not yet.
    expect(endPageTimeUp(state, T0 + END_PAGE_MS - 1)).toBe(state)
    const run = (steps: number) => {
      const seen: string[] = []
      for (let i = 0; i < steps; i++) {
        state = endPageTimeUp(state, endShowOf(state).pageEndsAt!)
        seen.push(pages(state))
      }
      return seen
    }
    expect(run(5)).toEqual(['leaderboard', 'awards', 'facts', 'podium', 'leaderboard'])

    const now = endShowOf(state).pageEndsAt! - 1000
    state = showEndPage(state, 'recap', now)
    expect(endShowOf(state).pageEndsAt).toBe(now + RECAP_PAGE_MS)
    expect(run(3)).toEqual(['recap1', 'podium', 'leaderboard'])
  })

  it('stops the clock when switched off, and gives a page stepped to by hand its full time', () => {
    const on = setEndAuto(finished(1), true, T0)
    expect(setEndAuto(on, true, T0 + 4000)).toBe(on)
    const off = setEndAuto(on, false, T0 + 4000)
    expect(endShowOf(off)).toMatchObject({ auto: false, pageEndsAt: null })
    expect(endPageTimeUp(off, T0 + 60_000)).toBe(off)
    expect(endShowOf(endPageStep(on, 1, T0 + 4000)).pageEndsAt).toBe(T0 + 4000 + END_PAGE_MS)
  })

  it('reads a game saved while automatic mode could include the recap', () => {
    const saved = { ...finished(2), endShow: { page: 'facts', recapIndex: 0, auto: false, recap: true, pageEndsAt: null } } as GameState
    expect(endShowOf(saved)).toEqual({ page: 'facts', recapIndex: 0, auto: false, pageEndsAt: null })
    expect(pages(endPageStep(saved, 1, T0))).toBe('podium')
  })

  it('keeps a long leaderboard up longer, one set of rows at a time', () => {
    expect(endPageMs(finished(1, {}, 2), 'leaderboard')).toBe(END_PAGE_MS)
    expect(endPageMs(finished(1, {}, 30), 'leaderboard')).toBe(3 * LEADERBOARD_SET_MS)
  })
})

describe('end page snapshots', () => {
  it('give the projector and the host the page and the recap question, never the phones', () => {
    let state = showEndPage(finished(2), 'recap', T0)
    state = endPageStep(state, 1, T0)
    const host = toHostSnapshot(state, T0)
    expect(host.endShow).toEqual({ ...endShowOf(state), recapCount: 2 })
    expect(host.recap?.question.id).toBe(state.quiz.questions[1]!.id)
    expect(toHostSnapshot(showEndPage(state, 'facts', T0), T0).recap).toBeNull()
    expect('endShow' in toPlayerSnapshot(state, 'p1', T0)).toBe(false)
  })

  it('are empty while the projector waits for the results, the host room included', () => {
    const held = finished(1, { finalResults: 'onRelease' })
    expect(toHostSnapshot(held, T0, { includeAnswers: true })).toMatchObject({ endShow: null, recap: null })
    expect(toHostSnapshot(releaseResults(held, 'screen'), T0).endShow).toMatchObject({ page: 'podium', recapCount: 1 })
  })
})

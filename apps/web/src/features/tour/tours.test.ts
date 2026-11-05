import { hostTourIds } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import en from '../../i18n/en.json'
import hu from '../../i18n/hu.json'
import { nextShownStep, stepsOnScreen, tours, type TourStep } from './tours'

const steps: TourStep[] = [{ id: 'welcome' }, { id: 'a', anchor: 'a' }, { id: 'b', anchor: 'b' }, { id: 'c', anchor: 'c' }]
const only = (...keys: string[]) => (anchor: string) => keys.includes(anchor)

describe('stepsOnScreen', () => {
  it('leaves out the steps whose element is not on screen, and keeps the centred ones', () => {
    expect(stepsOnScreen(steps, only('a', 'c'))!.map((step) => step.id)).toEqual(['welcome', 'a', 'c'])
  })

  it('waits while none of the elements is there yet', () => {
    expect(stepsOnScreen(steps, only())).toBeNull()
  })

  it('shows a tour of centred steps alone', () => {
    expect(stepsOnScreen([{ id: 'welcome' }], only())).toEqual([{ id: 'welcome' }])
  })
})

describe('nextShownStep', () => {
  it('moves to the next step whose element is still there, either way', () => {
    expect(nextShownStep(steps, 1, 2, only('a', 'c'))).toBe(3)
    expect(nextShownStep(steps, 3, 2, only('a', 'c'))).toBe(1)
    expect(nextShownStep(steps, 1, 0, only())).toBe(0)
  })

  it('ends the tour when nothing is left that way', () => {
    expect(nextShownStep(steps, 3, 4, only('a', 'b', 'c'))).toBeNull()
    expect(nextShownStep(steps, 2, 3, only('a', 'b'))).toBeNull()
  })
})

describe('tours', () => {
  it('has a tour for every host page the server knows, and the players’ lobby', () => {
    expect(Object.keys(tours).sort()).toEqual([...hostTourIds, 'playerLobby'].sort())
  })

  it('has a title and a text for every step in both languages', () => {
    for (const [id, tour] of Object.entries(tours)) {
      for (const step of tour.steps) {
        for (const dictionary of [en, hu] as Record<string, any>[]) {
          expect(dictionary.tour[id]?.[step.id]?.title, `${id}.${step.id}`).toBeTruthy()
          expect(dictionary.tour[id]?.[step.id]?.body, `${id}.${step.id}`).toBeTruthy()
        }
      }
    }
  })
})

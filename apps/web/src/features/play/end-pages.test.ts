import { describe, expect, it } from 'vitest'
import { aroundOf, stepPage, swipeStep } from './end-pages'

describe('stepPage', () => {
  it('steps forward and back, stopping at the ends', () => {
    expect(stepPage('standings', 1)).toBe('answers')
    expect(stepPage('stats', -1)).toBe('facts')
    expect(stepPage('standings', -1)).toBe('standings')
    expect(stepPage('stats', 1)).toBe('stats')
  })
})

describe('swipeStep', () => {
  it('goes forward on a swipe to the left and back on a swipe to the right', () => {
    expect(swipeStep(-80, 10)).toBe(1)
    expect(swipeStep(90, -20)).toBe(-1)
  })

  it('ignores short and mostly vertical drags', () => {
    expect(swipeStep(-40, 0)).toBe(0)
    expect(swipeStep(-80, 70)).toBe(0)
  })
})

describe('aroundOf', () => {
  const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ id }))
  const ids = (list: { id: string }[]) => list.map((row) => row.id).join('')

  it('takes two rows above and below', () => {
    expect(ids(aroundOf(rows, 'd'))).toBe('bcdef')
  })

  it('takes more on one side near an end', () => {
    expect(ids(aroundOf(rows, 'a'))).toBe('abcde')
    expect(ids(aroundOf(rows, 'g'))).toBe('cdefg')
  })

  it('takes the top rows for an unknown id and everything from a short list', () => {
    expect(ids(aroundOf(rows, 'x'))).toBe('abcde')
    expect(ids(aroundOf(rows.slice(0, 3), 'b'))).toBe('abc')
  })
})

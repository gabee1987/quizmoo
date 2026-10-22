import { describe, expect, it } from 'vitest'
import en from './en.json'
import hu from './hu.json'

function entries(tree: object, prefix = ''): [string, unknown][] {
  return Object.entries(tree).flatMap(([key, value]): [string, unknown][] =>
    typeof value === 'object' && value !== null ? entries(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]],
  )
}

describe('translations', () => {
  it('hu and en have the same keys', () => {
    const keys = (dict: object) => entries(dict).map(([key]) => key).sort()
    expect(keys(en)).toEqual(keys(hu))
  })

  it('has no empty strings', () => {
    for (const dict of [en, hu]) {
      for (const [key, value] of entries(dict)) expect(value, key).not.toBe('')
    }
  })
})

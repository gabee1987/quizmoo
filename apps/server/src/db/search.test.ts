import { describe, expect, it } from 'vitest'
import { normalise } from '../game/normalise.js'
import { ACCENTED, PLAIN, escapeLike } from './search.js'

/** What Postgres' `translate(lower(value), ACCENTED, PLAIN)` does. */
const fold = (value: string) =>
  [...value.toLowerCase()].map((c) => (ACCENTED.includes(c) ? PLAIN[[...ACCENTED].indexOf(c)] : c)).join('')

describe('title search folding', () => {
  it('maps each accented letter to one plain letter', () => {
    expect([...ACCENTED]).toHaveLength([...PLAIN].length)
    expect(new Set(ACCENTED).size).toBe([...ACCENTED].length)
  })

  it('folds the way answers are normalised, for Hungarian and Western European titles', () => {
    for (const title of ['Árvíztűrő Tükörfúrógép', 'ŐSZI ÜNNEP', 'Crème brûlée', 'Łódź Šibenik Ñandú', 'Smørrebrød Åland']) {
      expect(fold(title)).toBe(normalise(title).replace(/ø/g, 'o').replace(/ł/g, 'l'))
    }
  })

  it('escapes LIKE wildcards', () => {
    expect(escapeLike('100%_a\\b')).toBe('100\\%\\_a\\\\b')
  })
})

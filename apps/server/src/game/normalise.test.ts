import { describe, expect, it } from 'vitest'
import { normalise } from './normalise.js'

describe('normalise', () => {
  it.each([
    ['  Győr  ', 'gyor'],
    ['A   b', 'a b'],
    ['', ''],
    ['   ', ''],
    ['BuDaPeSt', 'budapest'],
    ['Árvíztűrő tükörfúrógép', 'arvizturo tukorfurogep'],
    ['Straße', 'straße'],
    ['multiple \t spaces\nand  lines', 'multiple spaces and lines'],
  ])('normalise(%j) is %j', (input, expected) => {
    expect(normalise(input)).toBe(expected)
  })
})

import type { ResultPlayer } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { sortPlayers, toggleSort } from './sort'

const player = (name: string, score: number): ResultPlayer => ({
  id: name,
  name,
  avatar: '🐶',
  teamId: null,
  score,
  rank: 0,
  correctCount: 0,
  points: [],
})
const players = [player('Zoé', 500), player('ádám', 900), player('Béla', 500), player('Anna', 100)]
const names = (list: ResultPlayer[]) => list.map((p) => p.name)

describe('sortPlayers', () => {
  it('sorts by score descending, ties by name', () => {
    expect(names(sortPlayers(players, { key: 'score', direction: 'desc' }, 'hu'))).toEqual(['ádám', 'Béla', 'Zoé', 'Anna'])
    expect(names(sortPlayers(players, { key: 'score', direction: 'asc' }, 'hu'))).toEqual(['Anna', 'Béla', 'Zoé', 'ádám'])
  })

  it('sorts names with the language collation, ignoring case and accents', () => {
    expect(names(sortPlayers(players, { key: 'name', direction: 'asc' }, 'hu'))).toEqual(['ádám', 'Anna', 'Béla', 'Zoé'])
    expect(names(sortPlayers(players, { key: 'name', direction: 'desc' }, 'hu'))).toEqual(['Zoé', 'Béla', 'Anna', 'ádám'])
  })
})

describe('toggleSort', () => {
  it('flips the active column and starts a new one in its natural direction', () => {
    expect(toggleSort({ key: 'score', direction: 'desc' }, 'score')).toEqual({ key: 'score', direction: 'asc' })
    expect(toggleSort({ key: 'score', direction: 'desc' }, 'name')).toEqual({ key: 'name', direction: 'asc' })
    expect(toggleSort({ key: 'name', direction: 'asc' }, 'score')).toEqual({ key: 'score', direction: 'desc' })
  })
})

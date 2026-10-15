import type { PlayerSnapshot } from '@quizmoo/shared'
import { describe, expect, it } from 'vitest'
import { lostCaptaincy, movedTo, newCaptaincy, newTeammates } from './team-moved'

const snapshot = (teamId: string | null, captains: Record<string, string | null> = {}) =>
  ({
    me: { id: 'me', teamId },
    players: [{ id: 'anna', name: 'Anna' }],
    teams: [
      { id: 'red', name: 'Red', captainId: captains.red ?? null },
      { id: 'blue', name: 'Blue', captainId: captains.blue ?? null },
    ],
  }) as unknown as PlayerSnapshot

describe('movedTo', () => {
  it('names the new team when the player went from one team to another', () => {
    expect(movedTo('red', snapshot('blue'))?.name).toBe('Blue')
  })

  it('is null for the same team, the first snapshot, a removed team and picking a team again', () => {
    expect(movedTo('red', snapshot('red'))).toBeNull()
    expect(movedTo(undefined, snapshot('blue'))).toBeNull()
    expect(movedTo('red', snapshot(null))).toBeNull()
    expect(movedTo(null, snapshot('blue'))).toBeNull()
  })
})

describe('newTeammates', () => {
  const team = (mates: string[]) =>
    ({
      me: { id: 'me', teamId: 'red' },
      players: [{ id: 'me', name: 'Me', teamId: 'red' }, ...mates.map((id) => ({ id, name: id.toUpperCase(), teamId: 'red' }))],
      teams: [{ id: 'red', name: 'Red', captainId: 'me' }],
    }) as unknown as PlayerSnapshot
  const seat = (mates: string[]) => ({ teamId: 'red', captainId: 'me', mates })

  it('names everyone new in the team', () => {
    expect(newTeammates(seat(['anna']), team(['anna', 'bela', 'cili']))).toEqual(['BELA', 'CILI'])
  })

  it('is empty when nobody new came, someone left, on the first snapshot, and after the player moved', () => {
    expect(newTeammates(seat(['anna']), team(['anna']))).toEqual([])
    expect(newTeammates(seat(['anna', 'bela']), team(['anna']))).toEqual([])
    expect(newTeammates(undefined, team(['anna']))).toEqual([])
    expect(newTeammates({ teamId: 'blue', captainId: null, mates: [] }, team(['anna']))).toEqual([])
  })
})

describe('lostCaptaincy', () => {
  it('names the new captain when the player lost the crown in the same team', () => {
    expect(lostCaptaincy({ teamId: 'red', captainId: 'me', mates: [] }, snapshot('red', { red: 'anna' }))).toBe('Anna')
  })

  it('is null when the player keeps or never had it, on the first snapshot, and after a move', () => {
    expect(lostCaptaincy({ teamId: 'red', captainId: 'me', mates: [] }, snapshot('red', { red: 'me' }))).toBeNull()
    expect(lostCaptaincy({ teamId: 'red', captainId: 'bela', mates: [] }, snapshot('red', { red: 'anna' }))).toBeNull()
    expect(lostCaptaincy(undefined, snapshot('red', { red: 'anna' }))).toBeNull()
    expect(lostCaptaincy({ teamId: 'red', captainId: 'me', mates: [] }, snapshot('blue', { blue: 'anna' }))).toBeNull()
  })
})

describe('newCaptaincy', () => {
  it('names the team when the captaincy passed to the player in the same team', () => {
    expect(newCaptaincy({ teamId: 'red', captainId: 'anna', mates: [] }, snapshot('red', { red: 'me' }))?.name).toBe('Red')
  })

  it('is null when nothing changed for the player, on the first snapshot, and after a move', () => {
    expect(newCaptaincy({ teamId: 'red', captainId: 'me', mates: [] }, snapshot('red', { red: 'me' }))).toBeNull()
    expect(newCaptaincy({ teamId: 'red', captainId: 'me', mates: [] }, snapshot('red', { red: 'anna' }))).toBeNull()
    expect(newCaptaincy(undefined, snapshot('red', { red: 'me' }))).toBeNull()
    expect(newCaptaincy({ teamId: 'red', captainId: 'anna', mates: [] }, snapshot('blue', { blue: 'me' }))).toBeNull()
  })
})

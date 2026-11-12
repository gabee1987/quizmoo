import { describe, expect, it } from 'vitest'
import { SHARE_CODE_ALPHABET, formatShareCode, normaliseShareCode } from './share.js'

describe('share codes', () => {
  it('uses 31 characters without the easily misread ones', () => {
    expect(SHARE_CODE_ALPHABET).toHaveLength(31)
    for (const c of '01OIL') expect(SHARE_CODE_ALPHABET).not.toContain(c)
    expect(new Set(SHARE_CODE_ALPHABET).size).toBe(31)
  })

  it('formats ten characters as QM-XXXXX-XXXXX', () => {
    expect(formatShareCode('7K4PX2XNAQ')).toBe('QM-7K4PX-2XNAQ')
  })

  it.each([
    'QM-7K4PX-2XNAQ',
    'qm-7k4px-2xnaq',
    'qm7k4px2xnaq',
    '7K4PX2XNAQ',
    ' 7k4px 2xnaq ',
    'https://quiz.example/share/QM-7K4PX-2XNAQ',
    'http://localhost:3000/share/qm7k4px2xnaq?x=1',
  ])('reads %j', (input) => {
    expect(normaliseShareCode(input)).toBe('QM-7K4PX-2XNAQ')
  })

  it('keeps a code whose own characters start with QM', () => {
    expect(normaliseShareCode('QMABCDEFGH')).toBe('QM-QMABC-DEFGH')
  })

  it.each(['', 'QM-7K4PX', 'QM-7K4PX-2XNAQ2', 'QM-0K4PX-2XNAQ', 'QM-IK4PX-2XNAQ', 'hello world'])('refuses %j', (input) => {
    expect(normaliseShareCode(input)).toBeNull()
  })
})

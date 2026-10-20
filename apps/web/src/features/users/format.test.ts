import { describe, expect, it } from 'vitest'
import { formatBytes, timeAgo } from './format'

describe('formatBytes', () => {
  it.each([
    [0, '0 byte'],
    [820, '820 byte'],
    [1536, '1.5 kB'],
    [12 * 1024, '12 kB'],
    [3.4 * 1024 * 1024, '3.4 MB'],
    [2.5 * 1024 ** 3, '2.5 GB'],
  ])('%d bytes is %s', (bytes, expected) => {
    expect(formatBytes(bytes, 'en')).toBe(expected)
  })
})

describe('timeAgo', () => {
  const now = Date.UTC(2026, 9, 20, 12)
  it.each([
    [10 * 1000, '10 seconds ago'],
    [5 * 60 * 1000, '5 minutes ago'],
    [3 * 3600 * 1000, '3 hours ago'],
    [24 * 3600 * 1000, 'yesterday'],
    [65 * 24 * 3600 * 1000, '2 months ago'],
    [400 * 24 * 3600 * 1000, 'last year'],
  ])('%d ms ago reads %s', (ago, expected) => {
    expect(timeAgo(new Date(now - ago), now, 'en')).toBe(expected)
  })

  it('speaks the page language', () => {
    expect(timeAgo(new Date(now - 24 * 3600 * 1000), now, 'hu')).toBe('tegnap')
  })
})

import { describe, expect, it } from 'vitest'
import { safeHostPath } from './redirect'

describe('safeHostPath', () => {
  it('keeps paths under /host', () => {
    for (const path of ['/host', '/host/users', '/host/settings?tab=account', '/host/games/123456#top']) {
      expect(safeHostPath(path)).toBe(path)
    }
  })

  it('drops anything that could leave the app or the host pages', () => {
    for (const value of [
      undefined,
      123456,
      '',
      '/',
      '/play/123456',
      '/hostile',
      'host/users',
      'https://evil.example/host/users',
      '//evil.example/host',
      '/host//evil.example',
      '/host/\\evil.example',
      `/host/${'a'.repeat(500)}`,
    ]) {
      expect(safeHostPath(value)).toBeNull()
    }
  })
})

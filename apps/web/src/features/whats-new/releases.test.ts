import { describe, expect, it } from 'vitest'
import en from '../../i18n/en.json'
import hu from '../../i18n/hu.json'
import { APP_VERSION } from '../../lib/version'
import { releaseKey, releases, type ReleaseNotes } from './releases'

const notesIn = (dict: object, version: string) =>
  releaseKey(version)
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], dict) as ReleaseNotes | undefined

describe('releases', () => {
  it('starts with the version in package.json, so a release cannot ship without notes', () => {
    expect(releases[0]?.version).toBe(APP_VERSION)
  })

  it('lists every release once, newest first, with a real date', () => {
    const versions = releases.map((r) => r.version)
    expect(new Set(versions).size).toBe(versions.length)
    const order = (v: string) => v.split('.').map(Number)
    for (let i = 1; i < releases.length; i++) {
      const [a, b] = [order(releases[i - 1]!.version), order(releases[i]!.version)]
      expect(a[0]! * 1e8 + a[1]! * 1e4 + a[2]!).toBeGreaterThan(b[0]! * 1e8 + b[1]! * 1e4 + b[2]!)
      expect(releases[i - 1]!.date >= releases[i]!.date).toBe(true)
    }
    for (const { date } of releases) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(Date.parse(date))).toBe(false)
    }
  })

  it('has notes for every release in Hungarian and English', () => {
    for (const { version } of releases) {
      for (const dict of [hu, en]) {
        const notes = notesIn(dict, version)
        expect(notes?.title, version).toBeTruthy()
        expect(notes?.intro, version).toBeTruthy()
        expect(notes?.sections.length, version).toBeGreaterThan(0)
        for (const section of notes!.sections) {
          expect(section.title).toBeTruthy()
          expect(section.items.length).toBeGreaterThan(0)
        }
      }
    }
  })
})

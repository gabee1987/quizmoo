import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '../i18n/en.json'
import hu from '../i18n/hu.json'
import { storedItems } from './storage-inventory'

/** Every source file of the app (tests excluded) and the public scripts. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name)
    if (statSync(file).isDirectory()) return sources(file)
    return /\.(ts|tsx|js)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [file] : []
  })
}

describe('storage inventory', () => {
  it('lists every quizmoo.* key the app stores, so the cookies page tells the whole truth', () => {
    const root = path.resolve(__dirname, '..', '..')
    const used = new Set<string>()
    for (const file of [...sources(path.join(root, 'src')), ...sources(path.join(root, 'public'))]) {
      for (const match of readFileSync(file, 'utf8').matchAll(/['`]quizmoo\.([A-Za-z]+)/g)) used.add(match[1]!)
    }
    // A download's file name, not something stored.
    used.delete('json')
    const listed = new Set(storedItems.map((item) => item.name.split('.')[1]).filter(Boolean))
    expect([...used].filter((stem) => !listed.has(stem))).toEqual([])
  })

  it('explains every listed item in both languages', () => {
    for (const { id } of storedItems) {
      expect(en.legal.cookies.items, id).toHaveProperty(id)
      expect(hu.legal.cookies.items, id).toHaveProperty(id)
    }
  })
})

import { describe, expect, it } from 'vitest'
import en from '../../i18n/en.json'
import hu from '../../i18n/hu.json'
import { tours } from '../tour/tours'
import { helpFigures } from './help-figures'
import { faqGroups, helpGroups } from './help-sections'

const dictionaries = { en, hu } as const

/** The string at a dotted key, or undefined (section ids contain dashes, not dots). */
function lookup(dictionary: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), dictionary)
}

const sections = helpGroups.flatMap((group) => group.sections)

describe('help page', () => {
  it.each(Object.keys(dictionaries) as (keyof typeof dictionaries)[])('has every text it shows in %s', (language) => {
    const dictionary = dictionaries[language]
    const missing: string[] = []
    const need = (key: string) => {
      const value = lookup(dictionary, key)
      if (typeof value !== 'string' || value.trim() === '') missing.push(key)
    }
    for (const group of helpGroups) need(`help.${group.id}.title`)
    for (const section of sections) {
      const key = `help.sections.${section.id}`
      need(`${key}.heading`)
      for (const item of section.items) {
        need(item.termKey ?? `${key}.items.${item.id}.term`)
        need(`${key}.items.${item.id}.text`)
      }
      for (const link of section.links ?? []) need(`help.links.${link.label}`)
    }
    for (const id of Object.keys(helpFigures)) need(`help.sections.${id}.figure`)
    for (const group of faqGroups) {
      need(`help.faq.groups.${group.id}.title`)
      const items = lookup(dictionary, `help.faq.groups.${group.id}.items`)
      expect(Array.isArray(items) && items.length > 0, `${language}: help.faq.groups.${group.id}.items`).toBe(true)
    }
    expect(missing).toEqual([])
  })

  it('has no texts for points or sections the page does not show', () => {
    const shown = Object.fromEntries(sections.map((section) => [section.id, section.items.map((item) => item.id).sort()]))
    for (const dictionary of Object.values(dictionaries)) {
      const written = dictionary.help.sections as Record<string, { items: Record<string, unknown> }>
      expect(Object.fromEntries(Object.entries(written).map(([id, section]) => [id, Object.keys(section.items).sort()]))).toEqual(shown)
    }
  })

  it('has a section for every tour’s help link', () => {
    const anchors = new Set([...helpGroups.map((group) => group.id), ...sections.map((section) => section.id)])
    for (const tour of Object.values(tours)) expect(anchors, tour.help).toContain(tour.help)
  })
})

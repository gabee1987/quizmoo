// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { matchShortcut } from './shortcuts'

const key = (key: string, mods: { ctrl?: boolean; meta?: boolean; alt?: boolean; shift?: boolean } = {}, target: EventTarget | null = document.body) => ({
  key,
  ctrlKey: mods.ctrl ?? false,
  metaKey: mods.meta ?? false,
  altKey: mods.alt ?? false,
  shiftKey: mods.shift ?? false,
  target,
})

describe('matchShortcut', () => {
  it('maps the editor shortcuts', () => {
    expect(matchShortcut(key('d', { ctrl: true }))).toBe('duplicate')
    expect(matchShortcut(key('D', { meta: true }))).toBe('duplicate')
    expect(matchShortcut(key('Enter', { ctrl: true }))).toBe('add')
    expect(matchShortcut(key('ArrowUp', { alt: true }))).toBe('moveUp')
    expect(matchShortcut(key('ArrowDown', { alt: true }))).toBe('moveDown')
    expect(matchShortcut(key('?', { shift: true }))).toBe('help')
  })

  it('ignores plain keys and other combinations', () => {
    expect(matchShortcut(key('d'))).toBeNull()
    expect(matchShortcut(key('Enter'))).toBeNull()
    expect(matchShortcut(key('ArrowUp'))).toBeNull()
    expect(matchShortcut(key('d', { ctrl: true, shift: true }))).toBeNull()
    expect(matchShortcut(key('ArrowUp', { ctrl: true, alt: true }))).toBeNull()
  })

  it('never fires while typing in a field', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      const field = document.createElement(tag)
      expect(matchShortcut(key('d', { ctrl: true }, field))).toBeNull()
      expect(matchShortcut(key('Enter', { ctrl: true }, field))).toBeNull()
      expect(matchShortcut(key('ArrowDown', { alt: true }, field))).toBeNull()
      expect(matchShortcut(key('?', { shift: true }, field))).toBeNull()
    }
    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    document.body.append(editable)
    expect(matchShortcut(key('d', { ctrl: true }, editable))).toBeNull()
    editable.remove()
  })

  it('fires on buttons, e.g. a focused question in the list', () => {
    expect(matchShortcut(key('d', { ctrl: true }, document.createElement('button')))).toBe('duplicate')
  })
})

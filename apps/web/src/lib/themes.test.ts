import { describe, expect, it } from 'vitest'
import { gameVars, paletteVars, textOn, themeSwatches, themeVars } from './themes'

describe('custom theme', () => {
  it('turns the host’s colours into the theme variables', () => {
    expect(themeVars({ theme: 'custom', customTheme: { hue: 140, accent: 20, chroma: 0.5 } })).toEqual({
      '--hue': 140,
      '--hue-accent': 20,
      '--chroma': 0.5,
      '--tint': 0.009,
    })
  })

  it('leaves the built-in themes to the stylesheet', () => {
    expect(themeVars({ theme: 'mint' })).toBeUndefined()
  })

  it('previews the custom colours in the swatches', () => {
    expect(themeSwatches('custom', { hue: 140, accent: 20, chroma: 0.5 })[0]).toBe('oklch(0.55 0.11 140)')
  })
})

describe('custom answer palette', () => {
  const colours = ['#000000', '#ffffff', '#f9cc21', '#1957d2', '#f77f00', '#7a31ca']

  it('picks white text on dark colours and dark text on light ones', () => {
    expect(textOn('#000000')).toBe('#ffffff')
    expect(textOn('#1957d2')).toBe('#ffffff')
    expect(textOn('#ffffff')).toBe('#1c1917')
    expect(textOn('#f9cc21')).toBe('#1c1917')
  })

  it('turns the host’s colours into the option variables', () => {
    const vars = paletteVars({ answerPalette: 'custom', customPalette: colours }) as Record<string, string>
    expect(vars['--option-1']).toBe('#000000')
    expect(vars['--option-1-fg']).toBe('#ffffff')
    expect(vars['--option-2-fg']).toBe('#1c1917')
    expect(vars['--option-6']).toBe('#7a31ca')
  })

  it('leaves the built-in palettes to the stylesheet', () => {
    expect(paletteVars({ answerPalette: 'vivid', customPalette: colours })).toBeUndefined()
    expect(gameVars({ theme: 'mint', answerPalette: 'neon' })).toBeUndefined()
  })

  it('combines a custom theme and a custom palette', () => {
    const vars = gameVars({ theme: 'custom', customTheme: { hue: 0, accent: 0, chroma: 0 }, answerPalette: 'custom', customPalette: colours })
    expect(vars).toMatchObject({ '--chroma': 0, '--option-3': '#f9cc21' })
  })
})

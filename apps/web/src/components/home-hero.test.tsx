// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import { HomeHero, MOO_LINES, mooKey } from './home-hero'

beforeAll(() => i18n.changeLanguage('en'))
afterEach(cleanup)

describe('mooKey', () => {
  it('cycles through the lines, starting again after the last', () => {
    expect(mooKey(1)).toBe('home.moo.line1')
    expect(mooKey(MOO_LINES)).toBe(`home.moo.line${MOO_LINES}`)
    expect(mooKey(MOO_LINES + 1)).toBe('home.moo.line1')
  })

  it('points at lines that exist in both languages', () => {
    for (let taps = 1; taps <= MOO_LINES; taps++) {
      for (const lng of ['en', 'hu']) expect(i18n.exists(mooKey(taps), { lng }), `${lng} ${mooKey(taps)}`).toBe(true)
    }
  })
})

describe('HomeHero', () => {
  it('has the app name as the page heading and shows the tagline', () => {
    render(<HomeHero tagline="The party quiz" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Quizmoo' })).toBeTruthy()
    expect(screen.getByText('The party quiz')).toBeTruthy()
  })

  it('says nothing until the cow is tapped, then a new line on every tap', () => {
    render(<HomeHero tagline="" />)
    const cow = screen.getByRole('button', { name: 'Pet the cow' })
    expect(screen.queryByText('Moo!')).toBeNull()

    fireEvent.click(cow)
    expect(screen.getByText('Moo!')).toBeTruthy()

    fireEvent.click(cow)
    expect(screen.queryByText('Moo!')).toBeNull()
    expect(screen.getByText(i18n.t('home.moo.line2'))).toBeTruthy()
  })

  it('announces the line to screen readers', () => {
    render(<HomeHero tagline="" />)
    fireEvent.click(screen.getByRole('button', { name: 'Pet the cow' }))
    expect(screen.getByText('Moo!').closest('[aria-live="polite"]')).toBeTruthy()
  })

  it('says something by itself after a while, without announcing it, and a tap takes over', () => {
    vi.useFakeTimers()
    // The highest pick: the last antic (moo), an everyday line, the longest first wait.
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    try {
      render(<HomeHero tagline="" />)
      const line = i18n.t('cow.lines.line8')
      act(() => vi.advanceTimersByTime(19_000))
      expect(screen.queryByText(line)).toBeNull()

      act(() => vi.advanceTimersByTime(1000))
      expect(screen.getByText(line).closest('[aria-hidden="true"]')).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: 'Pet the cow' }))
      expect(screen.queryByText(line)).toBeNull()
      expect(screen.getByText('Moo!')).toBeTruthy()
    } finally {
      vi.restoreAllMocks()
      vi.useRealTimers()
    }
  })
})

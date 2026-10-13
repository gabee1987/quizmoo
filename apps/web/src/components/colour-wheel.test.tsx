// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { ColourWheel } from './colour-wheel'

afterEach(cleanup)

function Harness() {
  const [hues, setHues] = useState({ hue: 0, accent: 200 })
  return (
    <ColourWheel
      chroma={1}
      handles={[
        { key: 'hue', hue: hues.hue, label: 'Main colour' },
        { key: 'accent', hue: hues.accent, label: 'Accent colour' },
      ]}
      onChange={(key, hue) => setHues((current) => ({ ...current, [key]: hue }))}
    />
  )
}

describe('ColourWheel', () => {
  it('moves a handle with the arrow keys, wrapping around the wheel', () => {
    render(<Harness />)
    const main = screen.getByRole('slider', { name: 'Main colour' })
    fireEvent.keyDown(main, { key: 'ArrowLeft' })
    expect(main.getAttribute('aria-valuenow')).toBe('355')
    fireEvent.keyDown(main, { key: 'ArrowRight', shiftKey: true })
    expect(main.getAttribute('aria-valuenow')).toBe('10')
    fireEvent.keyDown(main, { key: 'End' })
    expect(main.getAttribute('aria-valuenow')).toBe('359')
    // The other handle stays.
    expect(screen.getByRole('slider', { name: 'Accent colour' }).getAttribute('aria-valuenow')).toBe('200')
  })
})

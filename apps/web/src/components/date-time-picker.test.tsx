// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { DateTimePicker } from './date-time-picker'

afterEach(cleanup)

const at = (d: number, h = 19, m = 0) => new Date(2026, 9, d, h, m).getTime()
let latest = 0

function Harness() {
  const [value, setValue] = useState(at(15))
  latest = value
  return <DateTimePicker value={value} min={at(14, 9)} max={at(31, 9)} onChange={setValue} />
}

function open() {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: /19:00/ }))
}

/** A day button in the grid (the trigger names the chosen day too). */
const day = (name: RegExp) => within(screen.getByRole('grid')).getByRole('button', { name })

describe('DateTimePicker', () => {
  it('shows the choice in 24-hour style and opens on its month with the day selected', () => {
    open()
    expect(screen.getByRole('grid').getAttribute('aria-label')).toMatch(/2026\. október/)
    expect(day(/^október 15./).getAttribute('aria-pressed')).toBe('true')
    expect(day(/^október 15./).tabIndex).toBe(0)
  })

  it('picks a day and keeps the time', () => {
    open()
    fireEvent.click(day(/^október 20./))
    expect(latest).toBe(at(20))
  })

  it('moves the focus with the keyboard and stays within the allowed days', () => {
    open()
    fireEvent.keyDown(day(/^október 15./), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(day(/^október 22./))
    fireEvent.keyDown(day(/^október 22./), { key: 'PageUp' })
    // A month back is before the first allowed day, so the focus stops there.
    expect(document.activeElement).toBe(day(/^október 14./))
    expect(day(/^október 13./)).toHaveProperty('disabled', true)
  })
})

// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import '../i18n'
import { PinInput } from './pin-input'

afterEach(cleanup)

function Harness({ initial = '' }: { initial?: string }) {
  const [pin, setPin] = useState(initial)
  return (
    <>
      <PinInput value={pin} onChange={setPin} />
      <output data-testid="pin">{pin}</output>
    </>
  )
}

const boxes = () => screen.getAllByRole('textbox') as HTMLInputElement[]
const pin = () => screen.getByTestId('pin').textContent

describe('PinInput', () => {
  it('moves to the next box after each digit', () => {
    render(<Harness />)
    fireEvent.change(boxes()[0]!, { target: { value: '1' } })
    expect(pin()).toBe('1')
    expect(document.activeElement).toBe(boxes()[1])
    fireEvent.change(boxes()[1]!, { target: { value: '2' } })
    expect(pin()).toBe('12')
    expect(document.activeElement).toBe(boxes()[2])
  })

  it('ignores anything but digits', () => {
    render(<Harness />)
    fireEvent.change(boxes()[0]!, { target: { value: 'a' } })
    expect(pin()).toBe('')
    expect(boxes()[0]!.value).toBe('')
  })

  it('backspace clears the box, or on an empty box steps back and clears the previous one', () => {
    render(<Harness initial="12" />)
    fireEvent.keyDown(boxes()[1]!, { key: 'Backspace' })
    expect(pin()).toBe('1')
    fireEvent.keyDown(boxes()[2]!, { key: 'Backspace' })
    expect(pin()).toBe('1')
    expect(document.activeElement).toBe(boxes()[1])
    fireEvent.keyDown(boxes()[1]!, { key: 'Backspace' })
    expect(pin()).toBe('')
    expect(document.activeElement).toBe(boxes()[0])
  })

  it('fills every box from a paste, dropping separators', () => {
    render(<Harness />)
    fireEvent.paste(boxes()[0]!, { clipboardData: { getData: () => '123 456' } })
    expect(pin()).toBe('123456')
    expect(boxes().map((box) => box.value).join('')).toBe('123456')
    expect(document.activeElement).toBe(boxes()[5])
  })

  it('fills every box when the browser autofills the whole code into the first one', () => {
    render(<Harness />)
    fireEvent.change(boxes()[0]!, { target: { value: '654321' } })
    expect(pin()).toBe('654321')
  })
})

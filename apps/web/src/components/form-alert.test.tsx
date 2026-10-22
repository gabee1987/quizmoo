// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FormAlert } from './form-alert'

afterEach(cleanup)

describe('FormAlert', () => {
  it('holds a list of problems without invalid HTML nesting', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <FormAlert>
        <ul>
          <li>„Béla”: taken</li>
        </ul>
      </FormAlert>,
    )
    expect(screen.getByRole('alert').textContent).toContain('Béla')
    // React's development build reports a list inside a paragraph as a console error.
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })
})

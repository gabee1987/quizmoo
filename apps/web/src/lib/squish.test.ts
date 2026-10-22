// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installSquish, isUnselecting, squishAmount } from './squish'

describe('squish', () => {
  let uninstall = () => {}
  afterEach(() => {
    uninstall()
    document.body.innerHTML = ''
  })

  it('wobbles small controls more than large ones, never more than 12 %', () => {
    expect(squishAmount(40, 40)).toBe(0.12)
    expect(squishAmount(320, 120)).toBeCloseTo(0.05)
    expect(squishAmount(1000, 200)).toBeCloseTo(0.016)
  })

  it('animates the pressed button, also when the click lands on its icon', () => {
    document.body.innerHTML = '<button><svg></svg>Go</button><p>text</p><div data-no-squish><button id="quiet">x</button></div>'
    const button = document.querySelector('button')!
    const animate = vi.fn()
    button.animate = animate
    const quiet = document.querySelector<HTMLButtonElement>('#quiet')!
    quiet.animate = vi.fn()
    uninstall = installSquish()

    document.querySelector('svg')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(animate).toHaveBeenCalledTimes(1)
    expect(animate.mock.calls[0]![1]).toMatchObject({ composite: 'add' })

    document.querySelector('p')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    quiet.click()
    expect(animate).toHaveBeenCalledTimes(1)
    expect(quiet.animate).not.toHaveBeenCalled()
  })

  it('wobbles a [data-squish] card once when its label passes the click on to the control', () => {
    document.body.innerHTML = '<label data-squish for="r"><button id="r" role="radio"></button>Classic</label>'
    const card = document.querySelector<HTMLElement>('label')!
    card.animate = vi.fn()
    const radio = document.querySelector<HTMLButtonElement>('#r')!
    radio.animate = vi.fn()
    uninstall = installSquish()
    // The click on the label, then the click the browser forwards to the control.
    card.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    radio.click()
    expect(card.animate).toHaveBeenCalledTimes(1)
    expect(radio.animate).not.toHaveBeenCalled()
  })

  it('gives a press that turns something off a soft dip instead of the wobble', () => {
    document.body.innerHTML =
      '<button id="on" role="switch" aria-checked="true"></button><button id="off" role="switch" aria-checked="false"></button>'
    const on = document.querySelector<HTMLButtonElement>('#on')!
    const off = document.querySelector<HTMLButtonElement>('#off')!
    on.animate = vi.fn()
    off.animate = vi.fn()
    uninstall = installSquish()
    on.click()
    off.click()
    const frames = (el: HTMLButtonElement) => vi.mocked(el.animate).mock.calls[0]![0] as Keyframe[]
    expect(frames(on)).toHaveLength(3)
    expect(frames(off)).toHaveLength(6)
  })

  it('ignores the plain click Radix fires on the hidden input of the option just unchosen', () => {
    document.body.innerHTML = '<label data-squish><button role="radio" aria-checked="false"></button><input type="radio" aria-hidden="true"></label>'
    const card = document.querySelector<HTMLElement>('label')!
    card.animate = vi.fn()
    uninstall = installSquish()
    document.querySelector('input')!.dispatchEvent(new Event('click', { bubbles: true }))
    expect(card.animate).not.toHaveBeenCalled()
  })

  it('knows when a press takes a choice away', () => {
    document.body.innerHTML =
      '<label data-squish><input type="checkbox" checked></label><label data-squish><button role="radio" aria-checked="false"></button></label><button>Go</button>'
    const [checkbox, radio] = document.querySelectorAll('label')
    expect(isUnselecting(checkbox!)).toBe(true)
    expect(isUnselecting(radio!)).toBe(false)
    expect(isUnselecting(document.querySelector('body > button')!)).toBe(false)
  })
})

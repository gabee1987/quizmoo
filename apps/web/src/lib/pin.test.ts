import { describe, expect, it } from 'vitest'
import { pinFromScan } from './pin'

describe('pinFromScan', () => {
  it.each([
    ['123456', '123456'],
    [' 654321 ', '654321'],
    ['http://192.168.1.10:3000/?pin=123456', '123456'],
    ['https://quiz.example.com/?pin=123456&x=1', '123456'],
    ['https://quiz.example.com/play/123456', '123456'],
  ])('reads %s as %s', (text, pin) => {
    expect(pinFromScan(text)).toBe(pin)
  })

  it.each(['12345', 'abcdef', 'https://quiz.example.com/', 'https://quiz.example.com/?pin=12', 'WIFI:S:venue;;', ''])(
    'rejects %s',
    (text) => {
      expect(pinFromScan(text)).toBeNull()
    },
  )
})

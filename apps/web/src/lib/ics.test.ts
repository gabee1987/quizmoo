import { describe, expect, it } from 'vitest'
import { toIcs } from './ics'

const event = {
  uid: '123456-1791997200000@quizmoo',
  start: Date.UTC(2026, 9, 15, 17, 0),
  title: 'Quizmoo: Pub quiz; round 1, finals',
  description: 'PIN: 123456\nJoin: http://localhost:3000/?pin=123456',
  url: 'http://localhost:3000/?pin=123456',
}

describe('toIcs', () => {
  const ics = toIcs(event, Date.UTC(2026, 9, 14, 9, 0))
  const unfolded = ics.replace(/\r\n /g, '')

  it('is one VEVENT with CRLF lines, UTC times and an hour long', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true)
    expect(ics).not.toMatch(/[^\r]\n/)
    expect(unfolded).toContain('DTSTART:20261015T170000Z\r\n')
    expect(unfolded).toContain('DTEND:20261015T180000Z\r\n')
    expect(unfolded).toContain('DTSTAMP:20261014T090000Z\r\n')
    expect(unfolded).toContain(`UID:${event.uid}\r\n`)
    expect(unfolded).toContain('TRIGGER:-PT10M\r\n')
  })

  it('escapes text values', () => {
    expect(unfolded).toContain('SUMMARY:Quizmoo: Pub quiz\\; round 1\\, finals\r\n')
    expect(unfolded).toContain('DESCRIPTION:PIN: 123456\\nJoin: http://localhost:3000/?pin=123456\r\n')
  })

  it('folds long lines at 75 octets without splitting a character', () => {
    const long = toIcs({ ...event, title: 'Őszi kvízest a bölcsészkaron: ' + 'árvíztűrő tükörfúrógép '.repeat(6) }, 0)
    const encoder = new TextEncoder()
    for (const line of long.split('\r\n')) expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    expect(long.replace(/\r\n /g, '')).toContain('SUMMARY:Őszi kvízest a bölcsészkaron: árvíztűrő')
  })
})

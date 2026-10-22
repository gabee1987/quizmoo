import { downloadBlob } from './download'

/**
 * An iCalendar (.ics, RFC 5545) file for a scheduled game, built in the browser: every calendar app
 * imports it and no outside service is involved. A game has no set length, so the event lasts an hour.
 */

const HOUR_MS = 60 * 60 * 1000

export interface CalendarEvent {
  /** Stable per game, so importing the file twice updates the same event. */
  uid: string
  start: number
  title: string
  description: string
  url: string
}

/** 20261015T170000Z */
function utc(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Text values escape backslashes, semicolons, commas and newlines. */
function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Lines longer than 75 octets are folded: CRLF and a space, never inside a UTF-8 character. */
function fold(line: string): string {
  const encoder = new TextEncoder()
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const bytes = encoder.encode(char).length
    // The first line holds 75 octets, continuation lines 74 after their leading space.
    if (size + bytes > (parts.length === 0 ? 75 : 74)) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += char
    size += bytes
  }
  parts.push(current)
  return parts.join('\r\n ')
}

export function toIcs(event: CalendarEvent, now: number): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Quizmoo//Scheduled game//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(event.start)}`,
    `DTEND:${utc(event.start + HOUR_MS)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `URL:${event.url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(event.title)}`,
    'TRIGGER:-PT10M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** Saves the event as `<fileName>.ics`; phones offer to add it to their calendar. */
export function downloadIcs(event: CalendarEvent, fileName: string): void {
  downloadBlob(new Blob([toIcs(event, Date.now())], { type: 'text/calendar;charset=utf-8' }), `${fileName}.ics`)
}

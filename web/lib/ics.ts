// A one-event iCalendar file (RFC 5545), built in the browser so "Add to calendar" needs no
// server route and no calendar account. Kept to the fields every calendar app reads.

export interface IcsEvent {
  title: string;
  /** ISO timestamp; written out in UTC, so the guest's calendar shows it in their own zone. */
  start: string;
  /** Minutes. Defaults to three hours — a home game has no end time, and this is its usual length. */
  durationMinutes?: number;
  location?: string;
  description?: string;
}

const DEFAULT_DURATION_MINUTES = 180;

// 20260929T230000Z: the ISO string minus separators and milliseconds.
function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// TEXT values escape backslash first, then the three delimiters, and newlines become a literal \n.
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// Lines longer than 75 octets must fold onto continuation lines that start with a space. Folding
// at 60 characters keeps even an all-multibyte line under the limit without counting bytes.
function fold(line: string): string {
  const chars = Array.from(line);
  const parts: string[] = [];
  for (let i = 0; i < chars.length; i += 60) parts.push(chars.slice(i, i + 60).join(''));
  return parts.join('\r\n ');
}

export function buildIcs(event: IcsEvent): string {
  const start = new Date(event.start);
  const end = new Date(start.getTime() + (event.durationMinutes ?? DEFAULT_DURATION_MINUTES) * 60_000);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Buy-In//Game night//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@buy-in`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

/** A data URL for an `<a download>`: no blob to revoke, and iOS hands it straight to Calendar. */
export function icsDataUrl(ics: string): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

import { Event } from '../../types';

// "Add to calendar" as a standard .ics file generated in the browser. Works with Google
// Calendar, Outlook and Apple Calendar without sending anything to a third party.

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: unknown) =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

export const calendarFileUrl = (event: Event): string => {
  const start = event.date instanceof Date ? event.date : new Date(event.date as any);
  if (Number.isNaN(start.getTime())) return '#';
  // Assuming 2 hour duration for simplicity
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//REVA AICTE IDEA Lab//Portal//EN',
    'BEGIN:VEVENT',
    `UID:${icsText(event.id)}@idealab.reva.edu.in`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(event.title)}`,
    `DESCRIPTION:${icsText(event.description)}`,
    `LOCATION:${icsText(event.location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
};

export const calendarFileName = (event: Event) =>
  `${String(event.title || 'event').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'event'}.ics`;

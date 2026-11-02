// Utility to compute real-time event status from event dates
export type EventStatus = 'upcoming' | 'ongoing' | 'completed';

export function getComputedEventStatus(event: any): EventStatus {
  const now = new Date();
  // Get today's date string in local time (YYYY-MM-DD)
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const startDate: string = event.start_date;
  const endDate: string = event.end_date || event.start_date;

  if (!startDate) return 'upcoming';

  // === Date-level checks first (most reliable) ===
  // If end_date is strictly before today → always completed
  if (endDate < todayStr) return 'completed';

  // If start_date is strictly after today → always upcoming
  if (startDate > todayStr) return 'upcoming';

  // === On the boundary days, refine with time ===
  // Build start datetime in local time
  const [sh, sm] = (event.start_time || '00:00').split(':').map(Number);
  const startDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Use the actual start_date for multi-day events
  const [sy, smo, sd] = startDate.split('-').map(Number);
  startDateTime.setFullYear(sy, smo - 1, sd);
  startDateTime.setHours(sh, sm, 0, 0);

  // Build end datetime in local time
  const [ey, emo, ed] = endDate.split('-').map(Number);
  const [eh, em] = (event.end_time || '23:59').split(':').map(Number);
  const endDateTime = new Date(ey, emo - 1, ed, eh, em, 59, 0);

  if (now < startDateTime) return 'upcoming';
  if (now <= endDateTime) return 'ongoing';
  return 'completed';
}

export const STATUS_STYLES: Record<EventStatus, { label: string; cls: string }> = {
  upcoming:  { label: 'Upcoming',  cls: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  ongoing:   { label: 'Ongoing',   cls: 'bg-brand-50 text-brand-700 ring-brand-600/20' },
  completed: { label: 'Completed', cls: 'bg-green-50 text-green-700 ring-green-600/20' },
};

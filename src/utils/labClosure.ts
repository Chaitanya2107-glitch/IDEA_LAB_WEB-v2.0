// src/utils/labClosure.ts

export const INDIAN_HOLIDAYS_2026: Record<string, string> = {
  "2026-01-01": "New Year's Day",
  "2026-01-26": "Republic Day",
  "2026-03-04": "Holi",
  "2026-03-21": "Id-ul-Fitr",
  "2026-03-26": "Ram Navami",
  "2026-03-31": "Mahavir Jayanti",
  "2026-04-03": "Good Friday",
  "2026-05-01": "Buddha Purnima",
  "2026-08-15": "Independence Day",
  "2026-08-26": "Id-e-Milad",
  "2026-10-02": "Gandhi Jayanti",
  "2026-10-20": "Dussehra",
  "2026-11-08": "Diwali",
  "2026-12-25": "Christmas",
};

export interface LabStatus {
  isClosed: boolean;
  reason?: string;
  type?: 'holiday' | 'sunday' | 'blocked' | 'past';
}

export const getLabStatus = (dateStr: string, blockedDates: Date[] = []): LabStatus => {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);

  // Past check
  if (checkDate < today) {
    return { isClosed: true, reason: "Cannot book for past dates", type: 'past' };
  }

  // Sunday check
  if (date.getDay() === 0) {
    return { isClosed: true, reason: "Laboratory is closed on Sundays", type: 'sunday' };
  }

  // Holiday check
  if (INDIAN_HOLIDAYS_2026[dateStr]) {
    return { isClosed: true, reason: `Holiday: ${INDIAN_HOLIDAYS_2026[dateStr]}`, type: 'holiday' };
  }

  // Blocked dates check
  const isBlocked = blockedDates.some(d => {
    const bd = new Date(d);
    return bd.getFullYear() === date.getFullYear() &&
           bd.getMonth() === date.getMonth() &&
           bd.getDate() === date.getDate();
  });

  if (isBlocked) {
    return { isClosed: true, reason: "Laboratory is closed for maintenance/event", type: 'blocked' };
  }

  return { isClosed: false };
};

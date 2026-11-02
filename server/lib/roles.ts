// Portal roles. Staff roles live in the `staff` table (upper-case), portal users in `users`.
export const STAFF_ROLES = ['ADMIN', 'LAB', 'AMBASSADOR', 'EVENT_MANAGER', 'TECH_SUPPORT'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const USER_ROLES = ['USER', ...STAFF_ROLES] as const;

// Which staff roles may use each area of the API. ADMIN is always allowed.
// Mirrors the tab permissions in src/pages/StaffDashboard.tsx.
export const ACCESS = {
  inventoryWrite: ['LAB'],
  slotReview: ['LAB', 'EVENT_MANAGER'],
  printOrderReview: ['LAB'],
  eventsWrite: ['LAB', 'EVENT_MANAGER'],
  contentWrite: ['AMBASSADOR'],
  userManagement: ['TECH_SUPPORT'],
  history: ['TECH_SUPPORT', 'LAB'],
  signInAudit: ['TECH_SUPPORT'],
} as const satisfies Record<string, readonly StaffRole[]>;

export function normalizeRole(role: unknown): string {
  return typeof role === 'string' ? role.trim().toUpperCase() : '';
}

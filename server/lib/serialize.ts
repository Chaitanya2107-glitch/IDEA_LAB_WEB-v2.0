import { toApi, type Doc } from '../db.js';
import { normalizeRole } from './roles.js';

// Never leaves the server.
const SECRET_FIELDS = ['password_hash', 'password', 'token_version', 'failed_logins', 'locked_until', 'ms_oid', 'google_sub'];

function withoutSecrets(doc: Doc): Record<string, any> {
  const out = toApi(doc)!;
  for (const key of SECRET_FIELDS) delete out[key];
  return out;
}

// Staff as the frontend expects them: upper-case role (the dashboard compares against
// "ADMIN", "LAB", ...) and camelCase employeeId.
export function publicStaff(doc: Doc) {
  const out = withoutSecrets(doc);
  return {
    ...out,
    role: normalizeRole(doc.role),
    employeeId: doc.employee_id ?? doc.employeeId ?? null,
    // Only the emergency administrator has a password (Settings shows "Change password").
    has_password: Boolean(doc.password_hash),
  };
}

export function publicUser(doc: Doc) {
  // has_password: signed up with email + password (Settings shows "Change password").
  return { ...withoutSecrets(doc), has_password: Boolean(doc.password_hash) };
}

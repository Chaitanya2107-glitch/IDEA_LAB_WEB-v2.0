import { randomUUID } from 'node:crypto';
import { MongoClient, type Collection, type Db, type Document } from 'mongodb';

// Every document uses a string _id (UUIDs, or the ids carried over from the old
// database) and is returned to the frontend as { id, ...fields } with the same field
// names the pages already use.
export type Doc = Document & { _id: string };

export const COLLECTIONS = [
  'users',
  'staff',
  'auth_tokens',
  'oauth_states',
  'upload_tickets',
  // Per-student daily upload counter (stops one account filling the disk).
  'upload_quota',
  'inventory',
  'slot_bookings',
  // One document per booked half hour of the lab; the unique _id makes double booking impossible.
  'slot_cells',
  'blocked_dates',
  'lab_closures',
  'indents',
  'notifications',
  'machine_usage',
  'pcb_orders',
  'print_orders',
  'stl_files',
  'print_materials_config',
  'events',
  'event_registrations',
  'gallery',
  'lab_projects',
  'cms_pages',
  'pdf_reviews',
  'history_logs',
  'activity_log',
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

export const newId = () => randomUUID();
export const nowIso = () => new Date().toISOString();

export function collection(db: Db, name: CollectionName): Collection<Doc> {
  return db.collection<Doc>(name);
}

export async function connectMongo(
  uri: string,
  dbName: string,
  auditDbName = `${dbName}_audit`,
  googleAuditDbName = `${dbName}_audit_google`,
  passwordAuditDbName = `${dbName}_audit_password`,
): Promise<{ client: MongoClient; db: Db; audit: Db; googleAudit: Db; passwordAudit: Db }> {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 20,
    appName: 'idea-lab-portal',
  });
  await client.connect();
  const db = client.db(dbName);
  const audit = client.db(auditDbName);
  const googleAudit = client.db(googleAuditDbName);
  const passwordAudit = client.db(passwordAuditDbName);
  await Promise.all([
    ensureIndexes(db),
    ensureAuditIndexes(audit),
    ensureAuditIndexes(googleAudit),
    ensureAuditIndexes(passwordAudit),
  ]);
  return { client, db, audit, googleAudit, passwordAudit };
}

// Sign-in audit log: its own database, which the app's MongoDB user can only add to and
// read (see deploy/mongo-init.js), so the record of who signed in cannot be edited.
// Google sign-ins and email + password sign-ins each have their own database of the same
// shape, for separate monitoring.
export const LOGIN_EVENTS = 'login_events';

export async function ensureAuditIndexes(audit: Db): Promise<void> {
  const events = audit.collection<Doc>(LOGIN_EVENTS);
  await Promise.all([
    events.createIndex({ at: -1 }),
    events.createIndex({ account_kind: 1, outcome: 1, at: -1 }),
    events.createIndex({ email: 1, at: -1 }),
  ]);
}

export async function ensureIndexes(db: Db): Promise<void> {
  const c = (name: CollectionName) => collection(db, name);
  await Promise.all([
    c('users').createIndex({ email: 1 }, { unique: true }),
    c('staff').createIndex({ email: 1 }, { unique: true }),
    // One-time email/reset tokens and upload tickets expire on their own.
    c('auth_tokens').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    c('oauth_states').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    c('users').createIndex({ ms_oid: 1 }, { sparse: true }),
    c('users').createIndex({ google_sub: 1 }, { sparse: true }),
    c('upload_tickets').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    c('upload_quota').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
    c('slot_bookings').createIndex({ user_id: 1, date: -1 }),
    c('slot_bookings').createIndex({ status: 1, date: 1 }),
    c('slot_cells').createIndex({ booking_id: 1 }),
    c('blocked_dates').createIndex({ date: 1 }, { unique: true }),
    c('lab_closures').createIndex({ date: 1 }, { unique: true }),
    c('indents').createIndex({ user_id: 1, created_at: -1 }),
    c('notifications').createIndex({ user_id: 1, timestamp: -1 }),
    c('pcb_orders').createIndex({ user_id: 1, created_at: -1 }),
    c('print_orders').createIndex({ user_id: 1, created_at: -1 }),
    c('print_orders').createIndex({ status: 1, created_at: 1 }),
    c('events').createIndex({ start_date: 1 }),
    c('event_registrations').createIndex({ event_id: 1, user_id: 1 }, { unique: true }),
    c('event_registrations').createIndex({ event_id: 1, email: 1 }),
    c('cms_pages').createIndex({ page_name: 1 }, { unique: true }),
    c('pdf_reviews').createIndex({ uploaded_by: 1, created_at: -1 }),
    c('history_logs').createIndex({ timestamp: -1 }),
    c('activity_log').createIndex({ action: 1, targetName: 1, timestamp: -1 }),
  ]);
}

// { _id, ...rest } -> { id, ...rest }
export function toApi<T extends Doc | null | undefined>(doc: T): T extends Doc ? Record<string, any> : null {
  if (!doc) return null as any;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest } as any;
}

export function toApiList(docs: Doc[]): Record<string, any>[] {
  return docs.map((d) => toApi(d)!);
}

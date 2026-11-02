// One-time copy of the old Supabase project into MongoDB and the server's disk.
//
//   SUPABASE_DB_URL=postgresql://...   (Supabase → Project settings → Database → connection string)
//   SUPABASE_URL=https://<project>.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=...      (only needed to copy uploaded files)
//   MONGODB_URI=... MONGODB_DB=idealab STORAGE_DIR=./data/uploads
//   node build/scripts/migrate-from-supabase.js [--dry-run] [--skip-files]
//
// - Every table in the public schema becomes a MongoDB collection with the same name and
//   field names; "profiles" rows are merged into their users. Row ids become _id.
// - Every storage bucket is copied to STORAGE_DIR ("stl-files" stays private; everything
//   else is public site media under /files/projects/...). Stored file URLs are rewritten.
// - Safe to re-run: documents are upserted by id and existing files are skipped.
// - Passwords cannot be exported from Firebase/Supabase Auth, so migrated accounts set a
//   new one with "Forgot password" (the email link also verifies the address).
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import pg from 'pg';
import type { Db } from 'mongodb';
import { connectMongo } from '../server/db.js';
import { createFileStore, type Bucket, type FileStore } from '../server/lib/storage.js';

type Row = Record<string, any>;

export interface MigrationOptions {
  pgUrl: string;
  pgSslRejectUnauthorized?: boolean;
  supabaseUrl?: string;
  // Where to download files from; defaults to supabaseUrl (tests use a stand-in server).
  storageApiUrl?: string;
  serviceRoleKey?: string;
  db: Db;
  files: FileStore;
  dryRun?: boolean;
  skipFiles?: boolean;
  log?: (message: string) => void;
}

export interface MigrationReport {
  tables: Record<string, { read: number; written: number; skipped: number }>;
  files: { copied: number; skipped: number; failed: number };
}

/* ------------------------------------------------------------------ */
/* Pure helpers (unit-tested)                                          */
/* ------------------------------------------------------------------ */

// Storage paths → keys the new file store accepts (letters, digits, . _ -; ≤4 levels).
export function sanitizeKey(path: string): string {
  let segments = path
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      let s = seg.replace(/[^A-Za-z0-9._-]/g, '_');
      if (!/^[A-Za-z0-9]/.test(s)) s = `f${s}`;
      return s.slice(0, 200);
    });
  if (segments.length > 4) segments = [...segments.slice(0, 3), segments.slice(3).join('_').slice(0, 200)];
  return segments.join('/');
}

// Where an object from an old bucket lives now.
export function mapObject(bucket: string, path: string): { bucket: Bucket; key: string } {
  if (bucket === 'stl-files') return { bucket: 'stl-files', key: sanitizeKey(path) };
  if (bucket === 'projects') return { bucket: 'projects', key: sanitizeKey(path) };
  return { bucket: 'projects', key: sanitizeKey(`${bucket}/${path}`) };
}

// Rewrites Supabase Storage URLs inside any stored value to the new /files/... paths.
export function rewriteStorageUrls(value: any, supabaseUrl: string | undefined): any {
  if (!supabaseUrl) return value;
  const base = supabaseUrl.replace(/\/+$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`${base}/storage/v1/object/(?:public|sign|authenticated)/([^/?#\\s"']+)/([^?#\\s"']+)(?:\\?[^\\s"']*)?`, 'g');
  const visit = (v: any): any => {
    if (typeof v === 'string') {
      return v.replace(pattern, (match, bucket: string, path: string) => {
        const target = mapObject(bucket, decodeURIComponent(path));
        return target.bucket === 'projects' ? `/files/projects/${target.key}` : match;
      });
    }
    if (Array.isArray(v)) return v.map(visit);
    if (v && typeof v === 'object' && !(v instanceof Date)) {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, visit(x)]));
    }
    return v;
  };
  return visit(value);
}

// Row → document. Returns the document plus fields that must only be set on first insert.
export function transformRow(
  table: string,
  row: Row,
  supabaseUrl?: string,
): { doc: Row; onInsert: Row } {
  const doc: Row = rewriteStorageUrls({ ...row }, supabaseUrl);
  const onInsert: Row = {};

  if (row.id !== undefined && row.id !== null) {
    doc._id = String(row.id);
    delete doc.id;
  } else if (table === 'blocked_dates' && row.date) {
    doc._id = String(row.date);
  } else {
    doc._id = createHash('sha1').update(`${table}:${JSON.stringify(row)}`).digest('hex');
  }

  for (const [k, v] of Object.entries(doc)) {
    if (v instanceof Date) doc[k] = v.toISOString();
    else if (Buffer.isBuffer(v)) doc[k] = v.toString('base64');
  }

  if (table === 'users' || table === 'staff') {
    doc.email = String(doc.email ?? '').trim().toLowerCase();
    doc.role = String(doc.role ?? (table === 'users' ? 'USER' : '')).toUpperCase();
    delete doc.firebase_uid;
    delete doc.password_hash;
    delete doc.password;
    // Auth fields are only initialised once, so re-running never undoes a password reset.
    Object.assign(onInsert, { password_hash: null, token_version: 0, failed_logins: 0, email_verified: false });
  }
  if (table === 'event_registrations' && doc.email) doc.email = String(doc.email).trim().toLowerCase();
  if (table === 'stl_files' && doc.storage_path) doc.storage_path = mapObject('stl-files', String(doc.storage_path)).key;
  return { doc, onInsert };
}

/* ------------------------------------------------------------------ */
/* Migration                                                           */
/* ------------------------------------------------------------------ */

const TYPE_PARSERS: Record<number, (v: string) => unknown> = {
  1082: (v) => v, // date -> "YYYY-MM-DD"
  1114: (v) => new Date(`${v.replace(' ', 'T')}Z`).toISOString(), // timestamp (UTC)
  1184: (v) => new Date(v).toISOString(), // timestamptz
  1700: (v) => Number(v), // numeric
  20: (v) => Number(v), // bigint
};

export async function runMigration(opts: MigrationOptions): Promise<MigrationReport> {
  const log = opts.log ?? console.log;
  const report: MigrationReport = { tables: {}, files: { copied: 0, skipped: 0, failed: 0 } };

  const client = new pg.Client({
    connectionString: opts.pgUrl,
    ssl: /sslmode=disable/.test(opts.pgUrl) || /@(localhost|127\.0\.0\.1)[:/]/.test(opts.pgUrl)
      ? false
      : { rejectUnauthorized: opts.pgSslRejectUnauthorized ?? false },
    types: {
      getTypeParser: ((oid: number, format?: any) =>
        TYPE_PARSERS[oid] ?? pg.types.getTypeParser(oid, format)) as any,
    },
  });
  await client.connect();

  try {
    const { rows: tables } = await client.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
    );
    const names = tables.map((t) => t.table_name);
    let profiles: Row[] = [];

    for (const table of names) {
      const { rows } = await client.query(`select * from public."${table.replace(/"/g, '""')}"`);
      if (table === 'profiles') {
        profiles = rows;
        report.tables[table] = { read: rows.length, written: 0, skipped: 0 };
        continue;
      }
      const stats = (report.tables[table] = { read: rows.length, written: 0, skipped: 0 });
      const seenEmails = new Set<string>();
      const ops: any[] = [];
      for (const row of rows) {
        const { doc, onInsert } = transformRow(table, row, opts.supabaseUrl);
        if ((table === 'users' || table === 'staff') && (!doc.email || seenEmails.has(doc.email))) {
          log(`  ! ${table}: skipped ${doc._id} (${doc.email ? 'duplicate' : 'missing'} email)`);
          stats.skipped++;
          continue;
        }
        if (doc.email && (table === 'users' || table === 'staff')) seenEmails.add(doc.email);
        const { _id, ...fields } = doc;
        ops.push({ updateOne: { filter: { _id }, update: { $set: fields, $setOnInsert: onInsert }, upsert: true } });
      }
      if (!opts.dryRun && ops.length) {
        for (let i = 0; i < ops.length; i += 500) {
          await opts.db.collection<{ _id: string }>(table).bulkWrite(ops.slice(i, i + 500), { ordered: false });
        }
      }
      stats.written = opts.dryRun ? 0 : ops.length;
      log(`  ${table}: ${rows.length} read, ${stats.written} written${stats.skipped ? `, ${stats.skipped} skipped` : ''}`);
    }

    // profiles → fields on the matching user.
    if (profiles.length && !opts.dryRun) {
      const users = opts.db.collection<{ _id: string }>('users');
      for (const p of profiles) {
        if (!p.user_id) continue;
        const fields: Row = {};
        for (const key of ['degree', 'program', 'semester', 'phone', 'srn', 'is_profile_complete']) {
          if (p[key] !== undefined && p[key] !== null) fields[key] = p[key];
        }
        const { matchedCount } = await users.updateOne({ _id: String(p.user_id) }, { $set: fields });
        if (matchedCount) report.tables.profiles.written++;
      }
      log(`  profiles: merged into ${report.tables.profiles.written} users`);
    }

    // Seat counts from the registrations actually copied.
    if (!opts.dryRun && names.includes('events')) {
      const counts = await opts.db
        .collection('event_registrations')
        .aggregate<{ _id: string; count: number }>([{ $group: { _id: '$event_id', count: { $sum: 1 } } }])
        .toArray();
      const byEvent = new Map(counts.map((c) => [String(c._id), c.count]));
      const events = opts.db.collection<{ _id: string }>('events');
      for (const e of await events.find({}, { projection: { _id: 1 } }).toArray()) {
        await events.updateOne({ _id: e._id }, { $set: { registered_count: byEvent.get(String(e._id)) ?? 0 } });
      }
    }
  } finally {
    await client.end();
  }

  if (!opts.skipFiles) {
    if (!opts.supabaseUrl || !opts.serviceRoleKey) {
      log('  files: skipped (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to copy uploads)');
    } else {
      await copyStorage(opts, report, log);
    }
  }
  return report;
}

async function copyStorage(opts: MigrationOptions, report: MigrationReport, log: (m: string) => void) {
  const base = (opts.storageApiUrl ?? opts.supabaseUrl!).replace(/\/+$/, '');
  const headers = { apikey: opts.serviceRoleKey!, Authorization: `Bearer ${opts.serviceRoleKey}` };
  const api = async (path: string, init?: RequestInit) => {
    const res = await fetch(`${base}/storage/v1${path}`, {
      ...init,
      headers: { ...headers, ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (!res.ok) throw new Error(`Storage API ${path} failed: ${res.status} ${await res.text().catch(() => '')}`);
    return res;
  };

  const list = async (bucket: string, prefix = ''): Promise<string[]> => {
    const out: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const items = (await (
        await api(`/object/list/${encodeURIComponent(bucket)}`, {
          method: 'POST',
          body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
        })
      ).json()) as Array<{ name: string; id: string | null }>;
      for (const item of items) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null) out.push(...(await list(bucket, path)));
        else out.push(path);
      }
      if (items.length < 1000) break;
    }
    return out;
  };

  const buckets = (await (await api('/bucket')).json()) as Array<{ id: string }>;
  for (const { id: bucket } of buckets) {
    const objects = await list(bucket);
    log(`  bucket ${bucket}: ${objects.length} files`);
    for (const path of objects) {
      const target = mapObject(bucket, path);
      if ((await opts.files.size(target.bucket, target.key)) !== null) {
        report.files.skipped++;
        continue;
      }
      if (opts.dryRun) {
        report.files.copied++;
        continue;
      }
      try {
        const res = await api(`/object/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`);
        await opts.files.write(target.bucket, target.key, Readable.fromWeb(res.body as any), 500 * 1024 * 1024);
        report.files.copied++;
      } catch (err) {
        report.files.failed++;
        log(`  ! could not copy ${bucket}/${path}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  log(`  files: ${report.files.copied} copied, ${report.files.skipped} already present, ${report.files.failed} failed`);
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  const pgUrl = process.env.SUPABASE_DB_URL;
  const mongoUri = process.env.MONGODB_URI;
  if (!pgUrl || !mongoUri) throw new Error('Set SUPABASE_DB_URL and MONGODB_URI (see the comment at the top of this script)');
  const dryRun = process.argv.includes('--dry-run');
  const { client, db } = await connectMongo(mongoUri, process.env.MONGODB_DB || 'idealab', process.env.MONGODB_AUDIT_DB || undefined);
  try {
    console.log(`Migrating ${dryRun ? '(dry run, nothing is written) ' : ''}...`);
    const report = await runMigration({
      pgUrl,
      pgSslRejectUnauthorized: process.env.SUPABASE_DB_SSL_VERIFY === 'true',
      supabaseUrl: process.env.SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      db,
      files: createFileStore(process.env.STORAGE_DIR || './data/uploads'),
      dryRun,
      skipFiles: process.argv.includes('--skip-files'),
    });
    const failed = report.files.failed;
    console.log(failed ? `Done with ${failed} file error(s); re-run to retry them.` : 'Done.');
    console.log('Next: tell users to use "Forgot password" once to set a password on the new portal.');
  } finally {
    await client.close();
  }
}

// Only run when executed directly (the test imports the functions above).
if (process.argv[1] && /migrate-from-supabase\.(ts|js)$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { describe, test } from 'node:test';
import { MongoClient } from 'mongodb';
import pg from 'pg';
import { mapObject, rewriteStorageUrls, runMigration, sanitizeKey, transformRow } from '../../scripts/migrate-from-supabase.js';
import { ensureIndexes } from '../db.js';
import { assertKey, createFileStore } from '../lib/storage.js';
import { MONGO_URI } from './helpers.js';

const SUPABASE = 'https://proj.supabase.co';

describe('migration helpers', () => {
  test('storage paths become valid keys', () => {
    assert.equal(sanitizeKey('events/My Banner (1).png'), 'events/My_Banner__1_.png');
    assert.equal(sanitizeKey('/a//.hidden/b'), 'a/f.hidden/b');
    assert.equal(sanitizeKey('a/b/c/d/e/f.png'), 'a/b/c/d_e_f.png');
    for (const key of ['events/My Banner (1).png', '../../etc/passwd', 'a/b/c/d/e/f.png', '.env']) {
      assert.doesNotThrow(() => assertKey(sanitizeKey(key)), key);
    }
  });

  test('buckets map onto the two local stores', () => {
    assert.deepEqual(mapObject('stl-files', 'u/1_a b.stl'), { bucket: 'stl-files', key: 'u/1_a_b.stl' });
    assert.deepEqual(mapObject('projects', 'events/x.png'), { bucket: 'projects', key: 'events/x.png' });
    assert.deepEqual(mapObject('avatars', 'a b.png'), { bucket: 'projects', key: 'avatars/a_b.png' });
  });

  test('stored URLs are rewritten, nested and URL-encoded ones included', () => {
    const value = {
      banner: `${SUPABASE}/storage/v1/object/public/projects/events/My%20Banner.png`,
      list: [`see ${SUPABASE}/storage/v1/object/public/avatars/a%20b.png?t=1 here`],
      other: 'https://example.com/x.png',
    };
    assert.deepEqual(rewriteStorageUrls(value, SUPABASE), {
      banner: '/files/projects/events/My_Banner.png',
      list: ['see /files/projects/avatars/a_b.png here'],
      other: 'https://example.com/x.png',
    });
  });

  test('account rows drop provider ids and old password hashes', () => {
    const { doc, onInsert } = transformRow('staff', { id: 'abc', email: ' Lab@Reva.edu.in', role: 'lab', firebase_uid: 'fb', password_hash: '$2b$...' });
    assert.deepEqual(doc, { _id: 'abc', email: 'lab@reva.edu.in', role: 'LAB' });
    assert.equal(onInsert.password_hash, null);
    assert.equal(transformRow('blocked_dates', { date: '2026-12-25' }).doc._id, '2026-12-25');
  });
});

const PG_URL = process.env.TEST_PG_URL;

describe('migration from a Supabase-shaped Postgres', { skip: !PG_URL && 'set TEST_PG_URL to run' }, () => {
  test('copies tables and files, rewrites URLs, and is safe to re-run', async () => {
    const dbName = `mig_${randomBytes(4).toString('hex')}`;
    const admin = new pg.Client({ connectionString: PG_URL });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    await admin.end();
    const pgUrl = PG_URL!.replace(/\/[^/?]*(\?|$)/, `/${dbName}$1`);

    const seed = new pg.Client({ connectionString: pgUrl });
    await seed.connect();
    const U = '11111111-1111-1111-1111-111111111111';
    const E = '33333333-3333-3333-3333-333333333333';
    await seed.query(`
      create table users (id uuid primary key, email text, name text, role text, type text, firebase_uid text, created_at timestamp);
      create table staff (id uuid primary key default gen_random_uuid(), email text, name text, role text, is_verified boolean, password_hash text, firebase_uid text);
      create table profiles (user_id uuid, degree text, program text, semester text, is_profile_complete boolean);
      create table events (id uuid primary key, title text, start_date date, max_attendees int, registered_count int, banner_image text, created_at timestamptz);
      create table event_registrations (id uuid primary key default gen_random_uuid(), event_id uuid, user_id text, email text);
      create table stl_files (id uuid primary key, user_id uuid, filename text, storage_path text, volume numeric);
      create table print_orders (id uuid primary key default gen_random_uuid(), user_id uuid, stl_file_id uuid, cost numeric, status text, created_at timestamptz);
      create table blocked_dates (date date primary key);
      create table slot_bookings (id uuid primary key default gen_random_uuid(), user_id uuid, date date, start_time time, status text);
      create table gallery (id uuid primary key default gen_random_uuid(), title text, src text, tags jsonb);

      insert into users values ('${U}', 'Asha@REVA.edu.in', 'Asha', 'USER', 'university', 'fbx', '2024-05-01 10:00:00');
      insert into users values ('22222222-2222-2222-2222-222222222222', 'asha@reva.edu.in', 'Duplicate', 'USER', 'university', null, now());
      insert into staff (email, name, role, is_verified, password_hash, firebase_uid) values ('Lab@reva.edu.in', 'Lab', 'lab', true, '$2b$10$old', 'fb2');
      insert into profiles values ('${U}', 'B.Tech', 'CSE', '3', true);
      insert into events values ('${E}', 'Expo', '2026-10-10', 30, 99, '${SUPABASE}/storage/v1/object/public/projects/events/My%20Banner.png', '2026-01-01T00:00:00Z');
      insert into event_registrations (event_id, user_id, email) values ('${E}', '${U}', 'ASHA@reva.edu.in'), ('${E}', 'x', 'b@reva.edu.in');
      insert into stl_files values ('44444444-4444-4444-4444-444444444444', '${U}', 'My Part.stl', '${U}/1700_My Part.stl', 36.5);
      insert into print_orders (user_id, stl_file_id, cost, status, created_at) values ('${U}', '44444444-4444-4444-4444-444444444444', 98.50, 'Paid', now());
      insert into blocked_dates values ('2026-12-25');
      insert into slot_bookings (user_id, date, start_time, status) values ('${U}', '2026-11-01', '10:00', 'approved');
      insert into gallery (title, src, tags) values ('Team', '${SUPABASE}/storage/v1/object/public/avatars/a%20b.png', '{"k": ["v"]}');
    `);
    await seed.end();

    // Stand-in for the Supabase Storage API.
    const objects: Record<string, Record<string, string>> = {
      projects: { 'events/My Banner.png': 'banner-bytes' },
      'stl-files': { [`${U}/1700_My Part.stl`]: 'solid x' },
      avatars: { 'a b.png': 'avatar-bytes' },
    };
    const storage = http.createServer((req, res) => {
      if (req.headers.authorization !== 'Bearer service-key') return res.writeHead(401).end();
      const url = decodeURIComponent(req.url ?? '');
      if (url === '/storage/v1/bucket') return res.end(JSON.stringify(Object.keys(objects).map((id) => ({ id }))));
      const list = /^\/storage\/v1\/object\/list\/([^/]+)$/.exec(url);
      if (list && req.method === 'POST') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const { prefix } = JSON.parse(body);
          const entries = new Map<string, { name: string; id: string | null }>();
          for (const key of Object.keys(objects[list[1]])) {
            if (prefix && !key.startsWith(`${prefix}/`)) continue;
            const rest = prefix ? key.slice(prefix.length + 1) : key;
            const [head, ...tail] = rest.split('/');
            entries.set(head, { name: head, id: tail.length ? null : 'file' });
          }
          res.end(JSON.stringify([...entries.values()]));
        });
        return;
      }
      const get = /^\/storage\/v1\/object\/([^/]+)\/(.+)$/.exec(url);
      if (get && objects[get[1]]?.[get[2]] !== undefined) return res.end(objects[get[1]][get[2]]);
      res.writeHead(404).end();
    });
    storage.listen(0, '127.0.0.1');
    await new Promise((r) => storage.once('listening', r));
    const storageUrl = `http://127.0.0.1:${(storage.address() as AddressInfo).port}`;

    const mongo = new MongoClient(MONGO_URI);
    await mongo.connect();
    const db = mongo.db(`test_mig_${randomBytes(4).toString('hex')}`);
    await ensureIndexes(db);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-files-'));
    const files = createFileStore(dir);

    try {
      const opts = {
        pgUrl,
        // Stored URLs point at the real project; files are fetched from the stand-in.
        supabaseUrl: SUPABASE,
        serviceRoleKey: 'service-key',
        db,
        files,
        log: () => {},
      };
      const first = await runMigration({ ...opts, storageApiUrl: storageUrl });

      const user = await db.collection('users').findOne({ _id: U } as any);
      assert.equal(user?.email, 'asha@reva.edu.in');
      assert.equal(user?.firebase_uid, undefined);
      assert.equal(user?.password_hash, null);
      assert.equal(user?.degree, 'B.Tech');
      assert.equal(user?.created_at, '2024-05-01T10:00:00.000Z');
      assert.equal(await db.collection('users').countDocuments(), 1, 'case-duplicate email skipped');
      assert.equal(first.tables.users.skipped, 1);

      const staff = await db.collection('staff').findOne({ email: 'lab@reva.edu.in' });
      assert.equal(staff?.role, 'LAB');
      assert.equal(staff?.password_hash, null);

      const event = await db.collection('events').findOne({ _id: E } as any);
      assert.equal(event?.start_date, '2026-10-10');
      assert.equal(event?.banner_image, '/files/projects/events/My_Banner.png');
      assert.equal(event?.registered_count, 2, 'recounted from registrations');
      assert.equal((await db.collection('event_registrations').findOne({ user_id: U }))?.email, 'asha@reva.edu.in');

      assert.equal((await db.collection('stl_files').findOne({}))?.storage_path, `${U}/1700_My_Part.stl`);
      assert.equal((await db.collection('print_orders').findOne({}))?.cost, 98.5);
      assert.equal((await db.collection('blocked_dates').findOne({ _id: '2026-12-25' } as any))?.date, '2026-12-25');
      assert.equal((await db.collection('slot_bookings').findOne({}))?.start_time, '10:00:00');
      const gallery = await db.collection('gallery').findOne({});
      assert.equal(gallery?.src, '/files/projects/avatars/a_b.png');
      assert.deepEqual(gallery?.tags, { k: ['v'] });

      assert.equal(first.files.copied, 3);
      assert.equal(fs.readFileSync(path.join(dir, 'projects/events/My_Banner.png'), 'utf8'), 'banner-bytes');
      assert.equal(fs.readFileSync(path.join(dir, `stl-files/${U}/1700_My_Part.stl`), 'utf8'), 'solid x');
      assert.equal(fs.readFileSync(path.join(dir, 'projects/avatars/a_b.png'), 'utf8'), 'avatar-bytes');

      // A user sets a password after the migration; re-running must not undo it.
      await db.collection('users').updateOne({ _id: U } as any, { $set: { password_hash: 'scrypt$new', token_version: 2 } });
      const second = await runMigration({ ...opts, storageApiUrl: storageUrl });
      const after = await db.collection('users').findOne({ _id: U } as any);
      assert.equal(after?.password_hash, 'scrypt$new');
      assert.equal(after?.token_version, 2);
      assert.equal(second.files.skipped, 3);
      assert.equal(await db.collection('gallery').countDocuments(), 1);
    } finally {
      storage.close();
      await db.dropDatabase();
      await mongo.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

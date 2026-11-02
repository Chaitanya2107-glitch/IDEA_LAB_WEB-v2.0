import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, test } from 'node:test';
import { MongoClient } from 'mongodb';
import { createApp } from '../app.js';
import { analyzeStl } from '../lib/stl.js';
import { createFileStore } from '../lib/storage.js';
import { MONGO_URI, PNG_1PX, cleanup, config, daysFromNow, setup, staffToken, tetraStl, userToken, type TestEnv } from './helpers.js';

afterEach(cleanup);

const STAFF = [
  { id: 's-admin', name: 'Admin', email: 'admin@reva.edu.in', role: 'ADMIN', is_verified: true },
  { id: 's-lab', name: 'Lab', email: 'lab@reva.edu.in', role: 'lab', is_verified: true },
  { id: 's-tech', name: 'Tech', email: 'tech@reva.edu.in', role: 'TECH_SUPPORT', is_verified: true },
  { id: 's-amb', name: 'Amb', email: 'amb@reva.edu.in', role: 'AMBASSADOR', is_verified: true },
];
const USERS = [
  { id: 'u-1', name: 'Student One', email: 'one@reva.edu.in', role: 'USER', tenant_id: 'reva-idea-lab' },
  { id: 'u-2', name: 'Student Two', email: 'two@gmail.com', role: 'USER', tenant_id: 'reva-idea-lab' },
];
const MATERIAL = { id: 'mat-pla', name: 'PLA', density: 1.24, price_per_gram: 5, colors: [{ name: 'Red' }, { name: 'Blue' }] };

// Upload through the two-step flow the browser uses.
async function upload(env: TestEnv, token: string, meta: Record<string, unknown>, content: Buffer, contentType: string) {
  const ticket = await env.call('POST', '/api/uploads', { token, body: meta });
  if (ticket.status !== 200) return { ticket, put: null };
  const put = await env.call('PUT', ticket.body.uploadUrl, { token, raw: content, headers: { 'Content-Type': contentType } });
  return { ticket, put };
}

describe('health and routing', () => {
  test('health check includes a database round trip', async () => {
    const { call } = await setup();
    assert.deepEqual((await call('GET', '/api/health')).body, { status: 'ok', database: 'ok' });
  });

  test('unknown API routes return JSON 404; malformed JSON returns 400', async () => {
    const { call } = await setup();
    assert.equal((await call('GET', '/api/does-not-exist')).status, 404);
    assert.equal((await call('POST', '/api/auth/staff-login', { raw: '{bad', headers: { 'Content-Type': 'application/json' } })).status, 400);
  });
});

describe('authorization', () => {
  test('write endpoints and private reads reject anonymous callers', async () => {
    const { call } = await setup({ staff: STAFF, users: USERS });
    for (const [method, url] of [
      ['POST', '/api/inventory'],
      ['DELETE', '/api/inventory/batch-delete'],
      ['GET', '/api/inventory'],
      ['GET', '/api/users'],
      ['GET', '/api/staff'],
      ['DELETE', '/api/staff/s-admin'],
      ['POST', '/api/auth/create-staff'],
      ['POST', '/api/gallery'],
      ['PUT', '/api/events/e1'],
      ['GET', '/api/events/e1/registrations'],
      ['GET', '/api/pdf-reviews'],
      ['GET', '/api/slots'],
      ['GET', '/api/indents'],
      ['GET', '/api/print-orders'],
      ['POST', '/api/uploads'],
      ['PUT', '/api/uploads/aaaaaaaaaaaaaaaaaaaaaaaa'],
      ['GET', '/api/history'],
    ]) {
      const res = await call(method, url, method === 'GET' ? {} : { body: {} });
      assert.equal(res.status, 401, `${method} ${url} should need auth, got ${res.status}`);
    }
  });

  test('students cannot use staff endpoints', async () => {
    const { call } = await setup({ staff: STAFF, users: USERS });
    const token = userToken('u-1');
    assert.equal((await call('GET', '/api/inventory', { token })).status, 200);
    assert.equal((await call('POST', '/api/inventory', { token, body: { name: 'x' } })).status, 403);
    assert.equal((await call('GET', '/api/users', { token })).status, 403);
    assert.equal((await call('POST', '/api/events', { token, body: { title: 'x' } })).status, 403);
    assert.equal((await call('POST', '/api/cms-pages', { token, body: { page_name: 'home', content: {} } })).status, 403);
    assert.equal((await call('PUT', '/api/print-materials/mat-pla', { token, body: { price_per_gram: 0 } })).status, 403);
  });

  test('staff roles map to the dashboard tabs', async () => {
    const { call } = await setup({ staff: STAFF, users: USERS });
    const amb = staffToken('s-amb');
    const lab = staffToken('s-lab');
    assert.equal((await call('POST', '/api/inventory', { token: amb, body: { name: 'x' } })).status, 403);
    assert.equal((await call('POST', '/api/inventory', { token: lab, body: { name: 'Resistor' } })).status, 201);
    assert.equal((await call('POST', '/api/gallery', { token: lab, body: { title: 'x' } })).status, 403);
    assert.equal((await call('POST', '/api/gallery', { token: amb, body: { title: 'x' } })).status, 201);
    assert.equal((await call('GET', '/api/users', { token: lab })).status, 403);
    assert.equal((await call('GET', '/api/users', { token: staffToken('s-tech') })).status, 200);
  });

  test('inventory writes only accept known fields with valid values', async () => {
    const { call, db } = await setup({ staff: STAFF });
    const res = await call('POST', '/api/inventory', {
      token: staffToken('s-lab'),
      body: { name: 'Arduino', totalQuantity: '10', costPerUnit: 450, tenant_id: 'evil', is_admin: true, _id: 'chosen' },
    });
    assert.equal(res.status, 201);
    const doc = await db.collection('inventory').findOne({ name: 'Arduino' });
    assert.equal(doc?.total_quantity, 10);
    assert.equal(doc?.cost_per_unit, 450);
    assert.equal(doc?.tenant_id, 'reva-idea-lab');
    assert.equal(doc?.is_admin, undefined);
    assert.notEqual(doc?._id, 'chosen');
    assert.equal((await call('POST', '/api/inventory', { token: staffToken('s-lab'), body: { name: 'x', totalQuantity: -5 } })).status, 400);
  });

  test('tech support cannot modify administrators; nobody edits themselves', async () => {
    const { call } = await setup({ staff: [...STAFF, { id: 's-pending', name: 'P', email: 'p@reva.edu.in', role: 'LAB', is_verified: false }] });
    const tech = staffToken('s-tech');
    assert.equal((await call('PUT', '/api/staff/s-lab', { token: tech, body: { role: 'ADMIN' } })).status, 403);
    assert.equal((await call('DELETE', '/api/staff/s-admin', { token: tech })).status, 403);
    assert.equal((await call('PUT', '/api/staff/s-tech', { token: tech, body: { role: 'LAB' } })).status, 403);
    assert.equal((await call('DELETE', '/api/staff/s-admin', { token: staffToken('s-admin') })).status, 403);
    const verify = await call('PUT', '/api/staff/s-pending/verify', { token: tech, body: { is_verified: true } });
    assert.equal(verify.status, 200);
    assert.equal(verify.body.is_verified, true);
  });

  test('staff profile updates apply to the caller, not the id in the body', async () => {
    const { call, db } = await setup({ staff: STAFF });
    const res = await call('PUT', '/api/staff/profile', { token: staffToken('s-lab'), body: { id: 's-admin', name: 'Lab Renamed', role: 'ADMIN' } });
    assert.equal(res.status, 200);
    assert.equal((await db.collection('staff').findOne({ _id: 's-lab' } as any))?.name, 'Lab Renamed');
    assert.equal((await db.collection('staff').findOne({ _id: 's-lab' } as any))?.role, 'lab');
    assert.equal((await db.collection('staff').findOne({ _id: 's-admin' } as any))?.name, 'Admin');
  });
});

describe('student data isolation', () => {
  test('slot bookings: server sets owner and status; students see only their own', async () => {
    const [D1, D2, D3] = [daysFromNow(10), daysFromNow(11), daysFromNow(12)];
    const { call, db } = await setup({
      staff: STAFF,
      users: USERS,
      blocked_dates: [{ id: 'blocked-1', date: D2 }],
      lab_closures: [{ id: 'c1', date: D3, reason: 'Holiday' }],
    });
    const one = userToken('u-1');
    const booking = { bookingDate: D1, startTime: '10:00', endTime: '11:00', purpose: 'Build', sessionType: 'Individual', attendees: 2 };
    const res = await call('POST', '/api/slots', { token: one, body: { ...booking, status: 'approved', user_id: 'u-2' } });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'pending');
    assert.equal(res.body.user_id, 'u-1');
    assert.equal(res.body.purpose, '[Individual] Build');
    assert.equal((await call('POST', '/api/slots', { token: one, body: { ...booking, bookingDate: D2 } })).status, 409);
    assert.equal((await call('POST', '/api/slots', { token: one, body: { ...booking, bookingDate: D3 } })).status, 409);
    assert.equal((await call('POST', '/api/slots', { token: one, body: { ...booking, bookingDate: '2000-01-01' } })).status, 400);

    // Another student cannot take the same time (one booking per slot), but can book a free time.
    assert.equal((await call('POST', '/api/slots', { token: userToken('u-2'), body: booking })).status, 409);
    assert.equal((await call('POST', '/api/slots', { token: userToken('u-2'), body: { ...booking, startTime: '13:00', endTime: '16:00' } })).status, 201);
    assert.equal((await call('GET', '/api/slots', { token: one })).body.length, 1);
    assert.equal((await call('GET', '/api/slots', { token: staffToken('s-lab') })).body.length, 2);

    const id = res.body.id;
    assert.equal((await call('PUT', `/api/slots?id=${id}`, { token: one, body: { status: 'approved' } })).status, 403);
    const rejected = await call('PUT', `/api/slots?id=${id}`, { token: staffToken('s-admin'), body: { status: 'rejected', rejectionReason: 'Maintenance' } });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.rejection_reason, 'Maintenance');
    assert.equal((await db.collection('slot_bookings').countDocuments()), 2);
  });

  test('indents are priced from inventory and scoped to the requester', async () => {
    const { call } = await setup({
      staff: STAFF,
      users: USERS,
      inventory: [{ id: 'inv-1', name: 'Arduino', category: 'Boards', type: 'component', cost_per_unit: 450 }],
    });
    const res = await call('POST', '/api/indents', {
      token: userToken('u-1'),
      body: { projectTitle: 'Robot', items_json: [{ id: 'inv-1', quantity: 2, costPerUnit: 0 }], totalCost: 0, status: 'approved', paymentStatus: 'paid' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.totalCost, 900);
    assert.equal(res.body.status, 'pending');
    assert.equal(res.body.paymentStatus, 'pending');
    assert.match(res.body.id, /^IND-\d{4}-[0-9A-F]{8}$/);
    assert.equal((await call('POST', '/api/indents', { token: userToken('u-1'), body: { projectTitle: 'R', items_json: [{ id: 'nope', quantity: 1 }] } })).status, 400);
    assert.equal((await call('GET', '/api/indents', { token: userToken('u-2') })).body.length, 0);
    assert.equal((await call('GET', '/api/indents', { token: userToken('u-1') })).body.length, 1);
  });

  test('PCB orders are priced server-side and always start unpaid', async () => {
    const { call } = await setup({ users: USERS });
    const res = await call('POST', '/api/pcb-orders', {
      token: userToken('u-1'),
      body: { fileName: 'board.zip', cost: 1, paymentStatus: 'paid', specs: { layers: 2, dimensions: '100x100mm', quantity: 5, surfaceFinish: 'HASL with lead' } },
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.cost, 2200);
    assert.equal(res.body.paymentStatus, 'pending');
    assert.equal((await call('GET', '/api/pcb-orders', { token: userToken('u-2') })).body.length, 0);
  });

  test('event registration: caller identity, no duplicates, seats reserved atomically', async () => {
    const { call, db } = await setup({ users: [...USERS, ...Array.from({ length: 6 }, (_, i) => ({ id: `r-${i}`, name: `R${i}`, email: `r${i}@reva.edu.in` }))], events: [{ id: 'e1', title: 'Hackathon', max_attendees: 2, registered_count: 0 }] });
    const body = { event_id: 'e1', user_id: 'u-2', email: 'spoof@x.com', name: 'One', srn: 'R1' };
    const res = await call('POST', '/api/events/register', { token: userToken('u-1'), body });
    assert.equal(res.status, 201);
    assert.equal(res.body.user_id, 'u-1');
    assert.equal(res.body.email, 'one@reva.edu.in', 'email comes from the account, not the request');
    assert.equal((await call('POST', '/api/events/register', { token: userToken('u-1'), body })).status, 409);

    // Six people race for the one remaining seat.
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => call('POST', '/api/events/register', { token: userToken(`r-${i}`), body: { event_id: 'e1', name: `R${i}` } })),
    );
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 5);
    assert.equal(await db.collection('event_registrations').countDocuments({ event_id: 'e1' }), 2);
    assert.equal((await db.collection('events').findOne({ _id: 'e1' } as any))?.registered_count, 2);
  });

  test('pdf reviews ignore the client isAdmin flag', async () => {
    const { call } = await setup({
      staff: STAFF,
      pdf_reviews: [
        { id: 'p1', uploaded_by: 's-admin', created_at: '1' },
        { id: 'p2', uploaded_by: 's-amb', created_at: '2' },
      ],
    });
    const res = await call('GET', '/api/pdf-reviews?isAdmin=true', { token: staffToken('s-amb') });
    assert.deepEqual(res.body.map((r: any) => r.id), ['p2']);
    assert.equal((await call('PUT', '/api/pdf-reviews/p2', { token: staffToken('s-amb'), body: { status: 'approved' } })).status, 403);
    assert.equal((await call('PUT', '/api/pdf-reviews/p2', { token: staffToken('s-admin'), body: { status: 'approved' } })).status, 200);
  });
});

describe('uploads and files', () => {
  test('students upload STL files into their own folder; single-use tickets', async () => {
    const env = await setup({ staff: STAFF, users: USERS });
    const { ticket, put } = await upload(env, userToken('u-1'), { bucket: 'stl-files', fileName: '../../evil name.stl', size: 400 }, tetraStl(60), 'model/stl');
    assert.equal(ticket.status, 200);
    assert.match(ticket.body.path, /^u-1\/\d+_\.\._\.\._evil_name\.stl$/);
    assert.equal(ticket.body.publicUrl, null);
    assert.equal(put!.status, 201);
    assert.equal(await env.files.size('stl-files', ticket.body.path), tetraStl(60).length);

    const again = await env.call('PUT', ticket.body.uploadUrl, { token: userToken('u-1'), raw: tetraStl(10) });
    assert.equal(again.status, 404, 'tickets are single use');
    assert.equal((await env.call('POST', '/api/uploads', { token: userToken('u-1'), body: { bucket: 'stl-files', fileName: 'x.exe' } })).status, 400);
  });

  test("an upload link cannot be used by someone else", async () => {
    const env = await setup({ users: USERS });
    const ticket = await env.call('POST', '/api/uploads', { token: userToken('u-1'), body: { bucket: 'stl-files', fileName: 'a.stl' } });
    const stolen = await env.call('PUT', ticket.body.uploadUrl, { token: userToken('u-2'), raw: tetraStl(10) });
    assert.equal(stolen.status, 403);
  });

  test('only staff upload site media; type, content and size are enforced', async () => {
    const env = await setup({ staff: STAFF, users: USERS });
    assert.equal((await env.call('POST', '/api/uploads', { token: userToken('u-1'), body: { bucket: 'projects', fileName: 'a.png', contentType: 'image/png' } })).status, 403);
    assert.equal((await env.call('POST', '/api/uploads', { token: staffToken('s-amb'), body: { bucket: 'projects', fileName: 'a.html', contentType: 'text/html' } })).status, 400);

    const ok = await upload(env, staffToken('s-amb'), { bucket: 'projects', folder: 'gallery', fileName: 'photo.PNG', contentType: 'image/png' }, PNG_1PX, 'image/png');
    assert.equal(ok.put!.status, 201);
    assert.match(ok.ticket.body.path, /^gallery\/[0-9a-f]{16}-\d+\.png$/);
    const served = await fetch(env.base + ok.ticket.body.publicUrl);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/png');
    assert.equal(served.headers.get('x-content-type-options'), 'nosniff');
    assert.match(served.headers.get('content-security-policy') ?? '', /default-src 'none'/);

    // HTML disguised as a PNG is rejected and removed.
    const fake = await upload(env, staffToken('s-amb'), { bucket: 'projects', folder: 'gallery', fileName: 'x.png', contentType: 'image/png' }, Buffer.from('<html><script>alert(1)</script></html>'), 'image/png');
    assert.equal(fake.put!.status, 400);
    assert.equal(await env.files.size('projects', fake.ticket.body.path), null);

    // Size limit enforced while streaming (10 MB for images), nothing left behind.
    const big = await upload(env, staffToken('s-amb'), { bucket: 'projects', folder: 'gallery', fileName: 'big.png', contentType: 'image/png' }, Buffer.concat([PNG_1PX, Buffer.alloc(11 * 1024 * 1024)]), 'image/png');
    assert.equal(big.put!.status, 413);
    assert.equal(await env.files.size('projects', big.ticket.body.path), null);
    assert.equal((await fetch(`${env.base}/files/projects/../../etc/passwd`)).status, 404);
  });

  test('students may upload their own profile photo, images only, up to 2 MB', async () => {
    const env = await setup({ users: USERS });
    const ok = await upload(env, userToken('u-1'), { bucket: 'projects', folder: 'avatars', fileName: 'me.png', contentType: 'image/png' }, PNG_1PX, 'image/png');
    assert.equal(ok.put!.status, 201);
    assert.match(ok.ticket.body.path, /^avatars\/u-1-[0-9a-f]{16}-\d+\.png$/);
    assert.equal((await env.call('PUT', '/api/user/profile', { token: userToken('u-1'), body: { avatar: ok.put!.body.publicUrl } })).status, 200);
    assert.equal((await env.call('POST', '/api/uploads', { token: userToken('u-1'), body: { bucket: 'projects', folder: 'avatars', fileName: 'x.pdf', contentType: 'application/pdf' } })).status, 400);
    const big = await upload(env, userToken('u-1'), { bucket: 'projects', folder: 'avatars', fileName: 'big.png', contentType: 'image/png' }, Buffer.concat([PNG_1PX, Buffer.alloc(3 * 1024 * 1024)]), 'image/png');
    assert.equal(big.put!.status, 413);
  });
});

describe('3D printing', () => {
  test('STL analysis handles binary and ASCII files', () => {
    for (const ascii of [false, true]) {
      const result = analyzeStl(tetraStl(60, ascii));
      assert.equal(result.volumeCm3, 36);
      assert.equal(result.sizeMm.x, 60);
      assert.equal(result.triangles, 4);
    }
    assert.throws(() => analyzeStl(Buffer.from('not an stl')));
  });

  test('orders are priced on the server from the uploaded model', async () => {
    const env = await setup({ staff: STAFF, users: USERS, print_materials_config: [MATERIAL] });
    const { ticket } = await upload(env, userToken('u-1'), { bucket: 'stl-files', fileName: 'part.stl' }, tetraStl(60), 'model/stl');
    const other = await upload(env, userToken('u-2'), { bucket: 'stl-files', fileName: 'other.stl' }, tetraStl(60), 'model/stl');
    const order = { fileName: 'part.stl', materialId: 'mat-pla', color: 'Blue', infill: 20, scale: 100, quality: '0.2-std', cost: 1 };

    assert.equal((await env.call('POST', '/api/print-orders', { token: userToken('u-1'), body: { ...order, storagePath: other.ticket.body.path } })).status, 400);
    assert.equal((await env.call('POST', '/api/print-orders', { token: userToken('u-1'), body: { ...order, storagePath: 'u-1/../u-2/x.stl' } })).status, 400);
    assert.equal((await env.call('POST', '/api/print-orders', { token: userToken('u-1'), body: { ...order, storagePath: 'u-1/nope.stl' } })).status, 400);

    const res = await env.call('POST', '/api/print-orders', { token: userToken('u-1'), body: { ...order, storagePath: ticket.body.path } });
    assert.equal(res.status, 201);
    // 36 cm3 * (0.3 + 0.7 * 0.2) * 1.24 g/cm3 = 19.64 g; * Rs 5/g = Rs 98
    assert.equal(res.body.cost, 98);
    assert.equal(res.body.weight, 20);
    assert.equal(res.body.color, 'Blue');
    assert.equal(res.body.status, 'pending_payment');

    assert.equal((await env.call('GET', '/api/print-orders', { token: userToken('u-1') })).body[0].file_name, 'part.stl');
    assert.equal((await env.call('GET', '/api/print-orders', { token: userToken('u-2') })).body.length, 0);
    assert.equal((await env.call('GET', '/api/print-orders', { token: staffToken('s-lab') })).body[0].user_name, 'Student One');
  });

  test('stale unpaid orders are cancelled and can no longer be paid', async () => {
    const { call, db } = await setup({
      users: USERS,
      print_orders: [{ id: 'po-old', user_id: 'u-1', cost: 50, status: 'pending_payment', created_at: '2020-01-01T00:00:00.000Z' }],
    });
    assert.equal((await call('GET', '/api/print-orders', { token: userToken('u-1') })).body[0].status, 'cancelled');
    assert.equal((await db.collection('print_orders').findOne({ _id: 'po-old' } as any))?.status, 'cancelled');
    assert.equal((await call('POST', '/api/payments/print-orders/po-old/order', { token: userToken('u-1') })).status, 409);
  });

  test('lab staff update status (recorded as approver) and download via signed links', async () => {
    const env = await setup({
      staff: STAFF,
      users: USERS,
      stl_files: [{ id: 'stl-1', filename: 'part.stl', storage_path: 'u-1/1_part.stl' }],
      print_orders: [{ id: 'po-1', user_id: 'u-1', stl_file_id: 'stl-1', cost: 98, status: 'Paid', created_at: new Date().toISOString() }],
    });
    const { Readable } = await import('node:stream');
    await env.files.write('stl-files', 'u-1/1_part.stl', Readable.from([tetraStl(10)]), 1e6);

    assert.equal((await env.call('PUT', '/api/print-orders/po-1/status', { token: userToken('u-1'), body: { status: 'completed' } })).status, 403);
    assert.equal((await env.call('PUT', '/api/print-orders/po-1/status', { token: staffToken('s-lab'), body: { status: 'Paid' } })).status, 400);
    const updated = await env.call('PUT', '/api/print-orders/po-1/status', { token: staffToken('s-lab'), body: { status: 'printing' } });
    assert.equal(updated.body.status, 'printing');
    assert.deepEqual((await env.call('GET', '/api/print-orders/po-1/approver', { token: userToken('u-1') })).body, { name: 'Lab' });
    assert.equal((await env.call('GET', '/api/print-orders/po-1/approver', { token: userToken('u-2') })).status, 404);

    assert.equal((await env.call('GET', '/api/print-orders/po-1/download', { token: userToken('u-1') })).status, 403);
    const dl = await env.call('GET', '/api/print-orders/po-1/download', { token: staffToken('s-lab') });
    const file = await fetch(env.base + dl.body.url);
    assert.equal(file.status, 200);
    assert.match(file.headers.get('content-disposition') ?? '', /attachment; filename="part\.stl"/);
    assert.equal(Buffer.from(await file.arrayBuffer()).length, tetraStl(10).length);

    const tampered = dl.body.url.replace(/sig=[^&]+/, 'sig=AAAA');
    assert.equal((await fetch(env.base + tampered)).status, 403);
    const otherFile = dl.body.url.replace('1_part.stl', '2_other.stl');
    assert.equal((await fetch(env.base + otherFile)).status, 403, 'a signature is only valid for its own file');
    const expired = dl.body.url.replace(/expires=\d+/, 'expires=1000');
    assert.equal((await fetch(env.base + expired)).status, 403);
  });
});

describe('payments', () => {
  const seed = () => ({ users: USERS, print_orders: [{ id: 'po-1', user_id: 'u-1', cost: 120, status: 'pending_payment', payment_status: 'pending', created_at: new Date().toISOString() }] });

  test('checkout uses the stored price and only the owner can start it', async () => {
    const { call } = await setup(seed());
    assert.equal((await call('POST', '/api/payments/print-orders/po-1/order', { token: userToken('u-2') })).status, 404);
    const res = await call('POST', '/api/payments/print-orders/po-1/order', { token: userToken('u-1') });
    assert.equal(res.body.amount, 12000);
    assert.equal(res.body.keyId, 'rzp_test_key');
  });

  test('verify rejects bad signatures and marks the order paid once on a good one', async () => {
    const { call, db } = await setup(seed());
    const token = userToken('u-1');
    const { body: order } = await call('POST', '/api/payments/print-orders/po-1/order', { token });
    const bad = await call('POST', '/api/payments/verify', { token, body: { razorpay_order_id: order.orderId, razorpay_payment_id: 'pay_1', razorpay_signature: 'deadbeef' } });
    assert.equal(bad.status, 400);
    const signature = createHmac('sha256', 'rz-secret').update(`${order.orderId}|pay_1`).digest('hex');
    const payload = { razorpay_order_id: order.orderId, razorpay_payment_id: 'pay_1', razorpay_signature: signature };
    const [a, b] = await Promise.all([call('POST', '/api/payments/verify', { token, body: payload }), call('POST', '/api/payments/verify', { token, body: payload })]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const stored = await db.collection('print_orders').findOne({ _id: 'po-1' } as any);
    assert.equal(stored?.payment_status, 'paid');
    assert.equal(stored?.payment_method, 'Online: pay_1');
  });

  test('webhook requires a valid signature and checks the amount', async () => {
    const { call, db, gatewayOrders } = await setup(seed());
    gatewayOrders.set('order_9', { id: 'order_9', amount: 12000, currency: 'INR', status: 'paid', notes: { print_order_id: 'po-1' } });
    const event = (amount: number) => JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_9', order_id: 'order_9', amount } } } });
    const sign = (raw: string) => createHmac('sha256', 'wh-secret').update(raw).digest('hex');
    assert.equal((await call('POST', '/api/payments/razorpay/webhook', { raw: event(12000), headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': 'bad' } })).status, 400);
    const under = event(100);
    assert.equal((await call('POST', '/api/payments/razorpay/webhook', { raw: under, headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': sign(under) } })).body.status, 'ignored');
    assert.equal((await db.collection('print_orders').findOne({ _id: 'po-1' } as any))?.payment_status, 'pending');
    const good = event(12000);
    assert.equal((await call('POST', '/api/payments/razorpay/webhook', { raw: good, headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': sign(good) } })).status, 200);
    assert.equal((await db.collection('print_orders').findOne({ _id: 'po-1' } as any))?.payment_status, 'paid');
  });
});

describe('calendar, closures, registrations, content', () => {
  test('public calendar hides who booked', async () => {
    const { call } = await setup({
      slot_bookings: [
        { id: 'b1', date: '2099-01-01', status: 'approved', purpose: 'Build', user_id: 'u-1', user_name: 'Student One' },
        { id: 'b2', date: '2099-01-02', status: 'rejected', purpose: 'x', user_id: 'u-2' },
      ],
    });
    assert.deepEqual((await call('GET', '/api/slots/calendar')).body, [
      { date: '2099-01-01', status: 'approved', purpose: 'Build', start_time: null, end_time: null },
    ]);
  });

  test('lab closures: public read, event staff write (upsert by date)', async () => {
    const { call } = await setup({ staff: STAFF, users: USERS });
    const closure = { date: '2099-03-01', reason: 'Maintenance', closure_type: 'maintenance' };
    assert.equal((await call('POST', '/api/lab-closures', { token: userToken('u-1'), body: closure })).status, 403);
    const res = await call('POST', '/api/lab-closures', { token: staffToken('s-lab'), body: closure });
    assert.equal(res.status, 201);
    await call('POST', '/api/lab-closures', { token: staffToken('s-lab'), body: { ...closure, reason: 'Updated' } });
    const list = (await call('GET', '/api/lab-closures')).body;
    assert.equal(list.length, 1);
    assert.equal(list[0].reason, 'Updated');
    assert.equal((await call('DELETE', `/api/lab-closures/${res.body.id}`, { token: staffToken('s-lab') })).status, 200);
  });

  test('registration status and counts', async () => {
    const { call } = await setup({
      staff: STAFF,
      users: USERS,
      events: [{ id: 'e1', title: 'Hackathon' }],
      // Registered under the same email from another login (e.g. before the migration).
      event_registrations: [{ id: 'r1', event_id: 'e1', user_id: 'someone', email: 'one@reva.edu.in' }],
    });
    assert.deepEqual((await call('GET', '/api/events/e1/registration', { token: userToken('u-1') })).body, { registered: true });
    assert.deepEqual((await call('GET', '/api/events/e1/registration', { token: userToken('u-2') })).body, { registered: false });
    assert.equal((await call('GET', '/api/events/registration-counts', { token: userToken('u-1') })).status, 403);
    assert.deepEqual((await call('GET', '/api/events/registration-counts', { token: staffToken('s-lab') })).body, { e1: 1 });
  });

  test('onboarding answers are saved on the user; role cannot be changed', async () => {
    const { call, db } = await setup({ users: USERS });
    const res = await call('PUT', '/api/user/profile', { token: userToken('u-1'), body: { degree: 'B.Tech', program: 'CSE', semester: '3', isProfileComplete: true, role: 'ADMIN' } });
    assert.equal(res.status, 200);
    const doc = await db.collection('users').findOne({ _id: 'u-1' } as any);
    assert.equal(doc?.role, 'USER');
    assert.equal(doc?.degree, 'B.Tech');
    assert.equal(doc?.semester, '3');
    // Avatars may point at uploaded files, never at arbitrary schemes.
    assert.equal((await call('PUT', '/api/user/profile', { token: userToken('u-1'), body: { avatar: '/files/projects/gallery/a.png' } })).status, 200);
    assert.equal((await call('PUT', '/api/user/profile', { token: userToken('u-1'), body: { avatar: 'javascript:alert(1)' } })).status, 400);
    assert.equal((await call('PUT', '/api/user/profile', { token: userToken('u-1'), body: { avatar: '/files/projects/../../x' } })).status, 400);
  });

  test('CMS pages and events keep working end to end', async () => {
    const { call } = await setup({ staff: STAFF });
    const amb = staffToken('s-amb');
    assert.equal((await call('POST', '/api/cms-pages', { token: amb, body: { page_name: 'home', content: { hero: 'Hello' } } })).status, 200);
    assert.equal((await call('POST', '/api/cms-pages', { token: amb, body: { page_name: 'home', content: { hero: 'Updated' } } })).status, 200);
    assert.deepEqual((await call('GET', '/api/cms-pages?name=home')).body, { content: { hero: 'Updated' } });

    const ev = await call('POST', '/api/events', { token: staffToken('s-lab'), body: { title: 'Expo', banner_url: '/files/projects/events/a.png', registered_count: 999 } });
    assert.equal(ev.status, 201);
    assert.equal(ev.body.banner_image, '/files/projects/events/a.png');
    assert.equal(ev.body.registered_count, 0);
    assert.equal((await call('GET', `/api/events/${ev.body.id}`)).body.title, 'Expo');
  });
});

describe('static hosting', () => {
  test('serves the SPA shell with a CSP and 404s missing bundles', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spa-'));
    fs.mkdirSync(path.join(dir, 'assets'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><div id="root"></div>');
    fs.writeFileSync(path.join(dir, 'assets', 'app-123.js'), 'console.log(1)');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'files-'));
    const app = createApp(
      {
        config: { ...config, serveStatic: true, staticDir: dir },
        db: client.db('test_static_unused'),
        audit: client.db('test_static_unused_audit'),
        googleAudit: client.db('test_static_unused_audit_google'),
        passwordAudit: client.db('test_static_unused_audit_password'),
        files: createFileStore(storageDir),
        mailer: { configured: false, send: async () => {} },
        payments: {} as any,
        microsoft: {} as any,
        google: {} as any,
      },
      { rateLimit: false },
    );
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
      const route = await fetch(`${base}/staff-dashboard?tab=events`);
      assert.equal(route.status, 200);
      assert.match(await route.text(), /id="root"/);
      const csp = route.headers.get('content-security-policy') ?? '';
      assert.match(csp, /script-src 'self' https:\/\/checkout\.razorpay\.com/);
      assert.match(csp, /object-src 'none'/);
      assert.match(csp, /frame-ancestors 'self'/);
      assert.equal(route.headers.get('x-frame-options'), 'SAMEORIGIN');
      assert.equal(route.headers.get('x-powered-by'), null);
      assert.match((await fetch(`${base}/assets/app-123.js`)).headers.get('cache-control') ?? '', /immutable/);
      assert.equal((await fetch(`${base}/assets/app-OLD.js`)).status, 404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await client.close();
    }
  });
});

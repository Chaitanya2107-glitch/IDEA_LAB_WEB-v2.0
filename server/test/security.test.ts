import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { hashPassword } from '../lib/password.js';
import { cleanup, setup, staffToken, userToken } from './helpers.js';

afterEach(cleanup);

const STAFF = [
  { id: 's-admin', name: 'Admin', email: 'admin@reva.edu.in', role: 'ADMIN', is_verified: true },
  { id: 's-amb', name: 'Amb', email: 'amb@reva.edu.in', role: 'AMBASSADOR', is_verified: true },
  { id: 's-lab', name: 'Lab', email: 'lab@reva.edu.in', role: 'LAB', is_verified: true },
];
const USERS = [{ id: 'u-1', name: 'Student One', email: 'one@reva.edu.in', role: 'USER' }];

describe('NoSQL injection', () => {
  test('operator and dotted keys are rejected anywhere in stored content', async () => {
    const { call, db } = await setup({ staff: STAFF });
    const amb = staffToken('s-amb');
    const payloads = [
      { title: { $gt: '' } },
      { title: 'x', meta: { nested: [{ $where: 'sleep(1000)' }] } },
      { title: 'x', 'a.b': 1 },
      { title: 'x', meta: { 'a.b': 1 } },
      { $set: { role: 'ADMIN' } },
    ];
    for (const body of payloads) {
      const res = await call('POST', '/api/gallery', { token: amb, body });
      assert.equal(res.status, 400, `accepted ${JSON.stringify(body)}`);
    }
    const cms = await call('POST', '/api/cms-pages', { token: amb, body: { page_name: 'home', content: { $where: '1' } } });
    assert.equal(cms.status, 400);
    assert.equal(await db.collection('gallery').countDocuments(), 0);
  });

  test('prototype-pollution keys are rejected', async () => {
    const { call } = await setup({ staff: STAFF });
    for (const raw of ['{"__proto__":{"isAdmin":true},"title":"x"}', '{"title":"x","meta":{"constructor":{"prototype":{"a":1}}}}']) {
      const res = await call('POST', '/api/gallery', { token: staffToken('s-amb'), raw, headers: { 'Content-Type': 'application/json' } });
      assert.equal(res.status, 400, raw);
    }
    assert.equal(({} as any).isAdmin, undefined);
  });

  test('ids and query parameters cannot carry operators', async () => {
    const { call } = await setup({ staff: STAFF, users: USERS, slot_bookings: [{ id: 'b1', user_id: 'u-1', date: '2099-01-01', status: 'pending' }] });
    const admin = staffToken('s-admin');
    assert.equal((await call('PUT', '/api/slots?id[$ne]=x', { token: admin, body: { status: 'approved' } })).status, 400);
    assert.equal((await call('PUT', '/api/slots?id=b1&id=b2', { token: admin, body: { status: 'approved' } })).status, 400);
    assert.equal((await call('DELETE', `/api/inventory/${encodeURIComponent('{"$ne":null}')}`, { token: staffToken('s-lab') })).status, 400);
    const batch = await call('DELETE', '/api/inventory/batch-delete', { token: staffToken('s-lab'), body: { ids: [{ $ne: null }] } });
    assert.equal(batch.status, 400);
  });

  test('login cannot be bypassed with operator objects', async () => {
    const { call } = await setup({ users: [{ ...USERS[0], password_hash: await hashPassword('Real-Pass-123') }] });
    const res = await call('POST', '/api/auth/staff-login', { body: { email: { $regex: '.*' }, password: { $ne: 'x' } } });
    assert.equal(res.status, 400);
  });
});

describe('request limits', () => {
  test('bodies over 2 MB are refused', async () => {
    const { call } = await setup({ staff: STAFF });
    const res = await call('POST', '/api/gallery', { token: staffToken('s-amb'), body: { title: 'x', blob: 'a'.repeat(2.5 * 1024 * 1024) } });
    assert.equal(res.status, 413);
  });

  test('sign-in endpoints are rate limited per client', async () => {
    const { call } = await setup({}, { authRateLimitPerMinute: 3 }, { rateLimit: true });
    const attempt = () => call('POST', '/api/auth/staff-login', { body: { email: 'x@reva.edu.in', password: 'whatever-1' } });
    for (let i = 0; i < 3; i++) assert.equal((await attempt()).status, 401);
    const limited = await attempt();
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get('ratelimit') || limited.headers.get('ratelimit-policy'));
  });

  test('CORS is closed unless an origin is configured', async () => {
    const closed = await setup();
    const res = await closed.call('GET', '/api/health', { headers: { Origin: 'https://evil.example' } });
    assert.equal(res.headers.get('access-control-allow-origin'), null);

    const open = await setup({}, { corsOrigins: ['https://idealab.reva.edu.in'] });
    const allowed = await open.call('GET', '/api/health', { headers: { Origin: 'https://idealab.reva.edu.in' } });
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://idealab.reva.edu.in');
    const other = await open.call('GET', '/api/health', { headers: { Origin: 'https://evil.example' } });
    assert.equal(other.headers.get('access-control-allow-origin'), null);
  });
});

describe('information exposure', () => {
  test('secrets never appear in API responses', async () => {
    const hash = await hashPassword('Real-Pass-123');
    const { call } = await setup({
      staff: STAFF.map((s) => ({ ...s, password_hash: hash, token_version: 3, failed_logins: 2 })),
      users: USERS.map((u) => ({ ...u, password_hash: hash, token_version: 1, ms_oid: 'directory-id' })),
    });
    for (const url of ['/api/users', '/api/staff']) {
      const text = JSON.stringify((await call('GET', url, { token: staffToken('s-admin', 3) })).body);
      assert.ok(!/password_hash|"password"|scrypt|token_version|failed_logins|ms_oid/.test(text), `${url} leaked: ${text.slice(0, 200)}`);
    }
    const me = JSON.stringify((await call('GET', '/api/user/me', { token: userToken('u-1', 1) })).body);
    assert.ok(!/password_hash|"password"|scrypt|token_version|ms_oid/.test(me));
  });

  test('errors are generic and responses carry security headers', async () => {
    const { call } = await setup({ staff: STAFF });
    const dup = await call('POST', '/api/cms-pages', { token: staffToken('s-amb'), body: { page_name: 'x'.repeat(200), content: {} } });
    assert.equal(dup.status, 400);
    const res = await call('GET', '/api/health');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.match(res.headers.get('strict-transport-security') ?? '', /max-age=/);
  });
});

describe('denial of service', () => {
  test('crafted PCB dimensions are rejected quickly (no regex backtracking)', async () => {
    const { call } = await setup({ users: [{ id: 'u-1', name: 'S', email: 's@reva.edu.in' }] });
    const started = Date.now();
    for (const dimensions of ['1x' + ' '.repeat(100_000) + '!', '1'.repeat(100_000) + '!', '1.' + '1'.repeat(50_000) + 'x1' + ' '.repeat(50_000) + '!']) {
      const res = await call('POST', '/api/pcb-orders', { token: userToken('u-1'), body: { fileName: 'b.zip', specs: { dimensions } } });
      assert.equal(res.status, 400);
    }
    assert.ok(Date.now() - started < 2000, `took ${Date.now() - started} ms`);
    for (const dimensions of ['100x100mm', '100 x 100 mm'.replace(/ mm$/, 'mm'), '50.5x20']) {
      const res = await call('POST', '/api/pcb-orders', { token: userToken('u-1'), body: { fileName: 'b.zip', specs: { dimensions } } });
      assert.equal(res.status, 201, dimensions);
    }
  });

  test('email validation stays fast on long crafted input', async () => {
    const { call } = await setup();
    const started = Date.now();
    const res = await call('POST', '/api/auth/staff-login', { body: { email: 'a@' + '.'.repeat(200_000) + '@', password: 'whatever-1' } });
    assert.equal(res.status, 400);
    assert.ok(Date.now() - started < 1000);
  });
});

import assert from 'node:assert/strict';
import { after, afterEach, before, describe, test } from 'node:test';
import { mockGoogleSub, startMockGoogle, type MockGoogle } from '../../scripts/mock-google.js';
import { cleanup, setup, staffToken, type TestEnv } from './helpers.js';

// Google sign-in end to end against a stand-in for Google that signs real RS256 ID tokens.

let mock: MockGoogle;
before(async () => {
  mock = await startMockGoogle();
});
after(async () => {
  await mock.close();
});
afterEach(async () => {
  mock.tamper.claims = undefined;
  mock.tamper.foreignKey = false;
  await cleanup();
});

const withGoogle = (seed: Record<string, any[]> = {}) =>
  setup(seed, { google: { authority: mock.authority, clientId: mock.clientId, clientSecret: mock.clientSecret } });

async function signIn(env: TestEnv, opts: { email?: string; name?: string; next?: string; cancel?: boolean; cookie?: 'send' | 'omit' } = {}) {
  const q = opts.next ? `?next=${encodeURIComponent(opts.next)}` : '';
  const start = await fetch(`${env.base}/api/auth/google/start${q}`, { redirect: 'manual' });
  assert.equal(start.status, 303);
  const authorize = new URL(start.headers.get('location')!);
  if (!authorize.href.startsWith(mock.authority)) return { location: authorize.href, error: authorize.searchParams.get('error') ?? undefined };
  const cookie = /google_signin=([^;]+)/.exec(start.headers.get('set-cookie') ?? '')?.[1];
  assert.ok(cookie, 'state cookie set');
  assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authorize.searchParams.get('redirect_uri'), 'https://idealab.test/api/auth/google/callback');

  if (opts.cancel) authorize.searchParams.set('cancel', '1');
  else {
    authorize.searchParams.set('login_email', opts.email ?? 'visitor@gmail.com');
    authorize.searchParams.set('login_name', opts.name ?? 'Test Visitor');
  }
  const back = await fetch(authorize, { redirect: 'manual' });
  const callback = new URL(back.headers.get('location')!);
  const headers: Record<string, string> = opts.cookie === 'omit' ? {} : { Cookie: `google_signin=${cookie}` };
  const done = await fetch(`${env.base}${callback.pathname}${callback.search}`, { redirect: 'manual', headers });
  const location = done.headers.get('location')!;
  return {
    location,
    code: /#code=([A-Za-z0-9_-]+)/.exec(location)?.[1],
    error: new URL(location).searchParams.get('error') ?? undefined,
  };
}

const complete = (env: TestEnv, code?: string) => env.call('POST', '/api/auth/microsoft/complete', { body: { code } });

describe('Google sign-in', () => {
  test('a Gmail user gets a general-access account and a session', async () => {
    const env = await withGoogle();
    const flow = await signIn(env, { next: '/3d-print' });
    assert.match(flow.location, /^https:\/\/idealab\.test\/auth\/complete#code=/);
    const res = await complete(env, flow.code);
    assert.equal(res.status, 200);
    assert.equal(res.body.next, '/3d-print');
    assert.equal(res.body.user.email, 'visitor@gmail.com');
    assert.equal(res.body.user.type, 'non-university', 'general access');
    assert.equal(res.body.user.google_sub, undefined, 'Google id is not sent to the browser');
    assert.equal((await env.call('GET', '/api/user/me', { token: res.body.token })).status, 200);
    assert.equal((await complete(env, flow.code)).status, 400, 'code works once');
    const stored = await env.db.collection('users').findOne({ email: 'visitor@gmail.com' });
    assert.equal(stored?.google_sub, mockGoogleSub('visitor@gmail.com'));
    assert.equal(stored?.auth_provider, 'google');
  });

  test('Google sign-ins go to their own log database, not the Microsoft one', async () => {
    const env = await withGoogle();
    await complete(env, (await signIn(env)).code);
    const events = await env.googleAudit.collection('login_events').find().toArray();
    assert.equal(events.length, 1);
    assert.equal(events[0].method, 'google');
    assert.equal(events[0].outcome, 'success');
    assert.equal(events[0].email, 'visitor@gmail.com');
    assert.equal(events[0].google.sub, mockGoogleSub('visitor@gmail.com'));
    assert.match(events[0].google.id_token_sha256, /^[0-9a-f]{64}$/);
    assert.equal(await env.audit.collection('login_events').countDocuments(), 0);
  });

  test('@reva.edu.in accounts are sent to Microsoft sign-in', async () => {
    const env = await withGoogle();
    const flow = await signIn(env, { email: 'student@reva.edu.in' });
    assert.equal(flow.error, 'use_microsoft');
    assert.equal(await env.db.collection('users').countDocuments(), 0);
    assert.equal((await env.googleAudit.collection('login_events').findOne({}))?.reason, 'reva_use_microsoft');
  });

  test('old Gmail accounts from Supabase are linked by email and keep their data', async () => {
    const env = await withGoogle({ users: [{ id: 'u-old', email: 'visitor@gmail.com', name: 'Old Name', type: 'non-university' }] });
    const res = await complete(env, (await signIn(env, { name: 'Other' })).code);
    assert.equal(res.body.user.id, 'u-old');
    assert.equal(res.body.user.name, 'Old Name');
    assert.equal(await env.db.collection('users').countDocuments(), 1);
  });

  test('unverified emails, forged or replayed tokens, and a different Google account are refused', async () => {
    const env = await withGoogle({ users: [{ id: 'u-1', email: 'taken@gmail.com', google_sub: 'someone-else' }] });
    mock.tamper.claims = (c) => ({ ...c, email_verified: false });
    assert.equal((await signIn(env)).error, 'google_unverified');
    mock.tamper.claims = (c) => ({ ...c, aud: 'another-app' });
    assert.equal((await signIn(env)).error, 'failed');
    mock.tamper.claims = (c) => ({ ...c, nonce: 'old' });
    assert.equal((await signIn(env)).error, 'failed');
    mock.tamper.claims = undefined;
    mock.tamper.foreignKey = true;
    assert.equal((await signIn(env)).error, 'failed');
    mock.tamper.foreignKey = false;
    assert.equal((await signIn(env, { email: 'taken@gmail.com' })).error, 'account_mismatch');
    const reasons = (await env.googleAudit.collection('login_events').find().sort({ at: 1 }).toArray()).map((e) => e.reason);
    assert.deepEqual(reasons, ['email_not_verified', 'invalid_id_token', 'invalid_id_token', 'invalid_id_token', 'account_mismatch']);
    assert.equal(await env.db.collection('users').countDocuments(), 1);
  });

  test('state must match the browser; cancel is recorded; no open redirects; off without settings', async () => {
    const env = await withGoogle();
    assert.equal((await signIn(env, { cookie: 'omit' })).error, 'expired');
    assert.equal((await signIn(env, { cancel: true })).error, 'cancelled');
    const res = await complete(env, (await signIn(env, { next: '//evil.example' })).code);
    assert.equal(res.body.next, null);

    const off = await setup();
    const start = await fetch(`${off.base}/api/auth/google/start`, { redirect: 'manual' });
    assert.equal(start.headers.get('location'), 'https://idealab.test/login?error=google_not_configured');
  });

  test('general-access users cannot borrow components; other services still work', async () => {
    const env = await withGoogle({ inventory: [{ id: 'inv-1', name: 'Arduino', total_quantity: 5, available_quantity: 5, cost_per_unit: 100 }] });
    const token = (await complete(env, (await signIn(env)).code)).body.token;
    const indent = await env.call('POST', '/api/indents', { token, body: { items_json: [{ id: 'inv-1', quantity: 1 }] } });
    assert.equal(indent.status, 403);
    assert.match(indent.body.error, /REVA students/);
    assert.equal((await env.call('GET', '/api/events', { token })).status, 200);
  });
});

describe('sign-in log combines Microsoft and Google', () => {
  test('counts, list, method filter and CSV include both logs', async () => {
    const env = await withGoogle({ staff: [{ id: 's-admin', name: 'Admin', email: 'admin@reva.edu.in', role: 'ADMIN', is_verified: true }] });
    await complete(env, (await signIn(env, { email: 'a@gmail.com' })).code);
    await complete(env, (await signIn(env, { email: 'b@gmail.com' })).code);
    await signIn(env, { email: 'x@reva.edu.in' });
    await env.audit.collection('login_events').insertOne({
      _id: 'ms-1' as any, at: new Date(), account_kind: 'student', method: 'microsoft', outcome: 'success', account_id: 'u-ms', email: 's@reva.edu.in',
    });
    const token = staffToken('s-admin');

    const summary = (await env.call('GET', '/api/admin/sign-ins/summary', { token })).body;
    assert.equal(summary.totals.sign_ins, 3);
    assert.equal(summary.totals.failed_attempts, 1);
    assert.equal(summary.totals.unique_students, 3);
    assert.deepEqual(summary.totals.sign_ins_by_method, { microsoft: 1, google: 2, password: 0, email: 0 });
    assert.equal(summary.daily[0].sign_ins, 3);

    const all = (await env.call('GET', '/api/admin/sign-ins?limit=2', { token })).body;
    assert.equal(all.total, 4);
    assert.equal(all.events.length, 2);
    assert.ok(new Date(all.events[0].at) >= new Date(all.events[1].at), 'newest first across both logs');
    assert.equal((await env.call('GET', '/api/admin/sign-ins?method=google', { token })).body.total, 3);
    assert.equal((await env.call('GET', '/api/admin/sign-ins?method=microsoft', { token })).body.total, 1);

    const csv = await (await fetch(`${env.base}/api/admin/sign-ins/export`, { headers: { Authorization: `Bearer ${token}` } })).text();
    const lines = csv.trim().split('\n');
    assert.equal(lines.length, 5);
    assert.match(lines[0], /,google_sub,google_email_verified,google_hosted_domain$/);
    assert.ok(lines.some((l) => l.includes(mockGoogleSub('a@gmail.com'))));
  });
});

import assert from 'node:assert/strict';
import { after, afterEach, before, describe, test } from 'node:test';
import { mockOid, startMockMicrosoft, type MockMicrosoft } from '../../scripts/mock-microsoft.js';
import { cleanup, setup, staffToken, userToken, type TestEnv } from './helpers.js';

// The whole "Sign in with Microsoft" flow against a stand-in for Microsoft that signs
// real RS256 ID tokens, so token checks (signature, issuer, audience, tenant, nonce,
// PKCE, client secret) run exactly as in production.

let mock: MockMicrosoft;
before(async () => {
  mock = await startMockMicrosoft();
});
after(async () => {
  await mock.close();
});
afterEach(async () => {
  mock.tamper.claims = undefined;
  mock.tamper.foreignKey = false;
  await cleanup();
});

const STAFF = [
  { id: 's-admin', name: 'Admin', email: 'admin@reva.edu.in', role: 'ADMIN', is_verified: true },
  { id: 's-tech', name: 'Tech', email: 'tech@reva.edu.in', role: 'TECH_SUPPORT', is_verified: true },
  { id: 's-lab', name: 'Lab Staff', email: 'lab@reva.edu.in', role: 'LAB', is_verified: true },
  { id: 's-off', name: 'Off', email: 'off@reva.edu.in', role: 'LAB', is_verified: false },
];

const withMicrosoft = (seed: Record<string, any[]> = {}) =>
  setup(seed, {
    microsoft: { authority: mock.authority, tenantId: mock.tenantId, clientId: mock.clientId, clientSecret: mock.clientSecret },
  });

interface Flow {
  status: number;
  location: string;
  code?: string;
  error?: string;
}

// Browser steps: start -> Microsoft -> callback. Returns where the site sends the person.
async function signIn(
  env: TestEnv,
  opts: { email?: string; name?: string; portal?: 'student' | 'staff'; next?: string; cancel?: boolean; cookie?: 'send' | 'omit' | 'wrong' } = {},
): Promise<Flow> {
  const q = new URLSearchParams({ portal: opts.portal ?? 'student', ...(opts.next ? { next: opts.next } : {}) });
  const start = await fetch(`${env.base}/api/auth/microsoft/start?${q}`, { redirect: 'manual' });
  assert.equal(start.status, 303);
  const authorize = new URL(start.headers.get('location')!);
  if (!authorize.href.startsWith(mock.authority)) return { status: 303, location: authorize.href, error: authorize.searchParams.get('error') ?? undefined };
  const cookie = /ms_signin=([^;]+)/.exec(start.headers.get('set-cookie') ?? '')?.[1];
  assert.ok(cookie, 'state cookie set');
  assert.match(start.headers.get('set-cookie')!, /HttpOnly/);
  assert.match(start.headers.get('set-cookie')!, /SameSite=Lax/);
  assert.equal(authorize.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authorize.searchParams.get('redirect_uri'), 'https://idealab.test/api/auth/microsoft/callback');

  if (opts.cancel) authorize.searchParams.set('cancel', '1');
  else {
    authorize.searchParams.set('login_email', opts.email ?? 'new.student@reva.edu.in');
    authorize.searchParams.set('login_name', opts.name ?? 'New Student');
  }
  const back = await fetch(authorize, { redirect: 'manual' });
  const callback = new URL(back.headers.get('location')!);
  const headers: Record<string, string> = {};
  if ((opts.cookie ?? 'send') === 'send') headers.Cookie = `ms_signin=${cookie}`;
  if (opts.cookie === 'wrong') headers.Cookie = 'ms_signin=someone-elses-state';
  const done = await fetch(`${env.base}${callback.pathname}${callback.search}`, { redirect: 'manual', headers });
  const location = done.headers.get('location')!;
  const url = new URL(location);
  return {
    status: done.status,
    location,
    code: /#code=([A-Za-z0-9_-]+)/.exec(location)?.[1],
    error: url.searchParams.get('error') ?? undefined,
  };
}

const complete = (env: TestEnv, code?: string) => env.call('POST', '/api/auth/microsoft/complete', { body: { code } });

describe('Microsoft sign-in: students', () => {
  test('a first sign-in creates a verified university account and returns a session', async () => {
    const env = await withMicrosoft();
    const flow = await signIn(env, { next: '/dashboard?tab=orders' });
    assert.equal(flow.status, 303);
    assert.match(flow.location, /^https:\/\/idealab\.test\/auth\/complete#code=/);

    const res = await complete(env, flow.code);
    assert.equal(res.status, 200);
    assert.equal(res.body.next, '/dashboard?tab=orders');
    assert.equal(res.body.user.email, 'new.student@reva.edu.in');
    assert.equal(res.body.user.name, 'New Student');
    assert.equal(res.body.user.type, 'university');
    assert.equal(res.body.user.email_verified, true);
    assert.equal(res.body.user.ms_oid, undefined, 'directory id is not sent to the browser');
    assert.equal((await env.call('GET', '/api/user/me', { token: res.body.token })).body.user.email, 'new.student@reva.edu.in');
    assert.equal((await complete(env, flow.code)).status, 400, 'the one-time code works once');

    const stored = await env.db.collection('users').findOne({ email: 'new.student@reva.edu.in' });
    assert.equal(stored?.ms_oid, mockOid('new.student@reva.edu.in'));
    assert.equal(stored?.login_count, 1);
  });

  test('every sign-in is recorded with proof from Microsoft', async () => {
    const env = await withMicrosoft();
    for (let i = 0; i < 2; i++) assert.equal((await complete(env, (await signIn(env)).code)).status, 200);
    const events = await env.audit.collection('login_events').find().toArray();
    assert.equal(events.length, 2);
    const e = events[0];
    assert.equal(e.outcome, 'success');
    assert.equal(e.method, 'microsoft');
    assert.equal(e.account_kind, 'student');
    assert.equal(e.email, 'new.student@reva.edu.in');
    assert.equal(e.microsoft.oid, mockOid('new.student@reva.edu.in'));
    assert.equal(e.microsoft.tid, mock.tenantId);
    assert.match(e.microsoft.id_token_sha256, /^[0-9a-f]{64}$/);
    assert.ok(e.microsoft.id_token_issued_at instanceof Date);
    assert.ok(e.ip);
    assert.equal(events[0].account_id, events[1].account_id, 'same person, same account');
    assert.equal((await env.db.collection('users').findOne({}))?.login_count, 2);
  });

  test('accounts moved from Supabase are linked by email on first Microsoft sign-in', async () => {
    const env = await withMicrosoft({
      users: [{ id: 'u-old', email: 'old@reva.edu.in', name: 'Old Name', role: 'USER', type: 'non-university', password_hash: null }],
    });
    const res = await complete(env, (await signIn(env, { email: 'Old@Reva.edu.in', name: 'Someone Else' })).code);
    assert.equal(res.body.user.id, 'u-old');
    assert.equal(res.body.user.name, 'Old Name', 'existing profile kept');
    assert.equal(res.body.user.type, 'university');
    assert.equal(await env.db.collection('users').countDocuments(), 1);
  });

  test('an account already linked to another Microsoft identity is refused', async () => {
    const env = await withMicrosoft({ users: [{ id: 'u-1', email: 'one@reva.edu.in', ms_oid: 'another-person' }] });
    const flow = await signIn(env, { email: 'one@reva.edu.in' });
    assert.equal(flow.error, 'account_mismatch');
    assert.equal((await env.audit.collection('login_events').findOne({}))?.reason, 'account_mismatch');
  });
});

describe('Microsoft sign-in: only @reva.edu.in from REVA\'s tenant', () => {
  test('gmail and other domains are refused and recorded, with no account created', async () => {
    const env = await withMicrosoft();
    for (const email of ['someone@gmail.com', 'x@reva.edu.in.evil.com', 'x@notreva.edu.in']) {
      const flow = await signIn(env, { email });
      assert.equal(flow.error, 'domain', email);
      assert.match(flow.location, /^https:\/\/idealab\.test\/login\?error=domain$/);
    }
    assert.equal(await env.db.collection('users').countDocuments(), 0);
    const reasons = await env.audit.collection('login_events').distinct('reason');
    assert.deepEqual(reasons, ['domain_not_allowed']);
  });

  test('tokens from another tenant, for another app, with a bad signature or nonce are rejected', async () => {
    const env = await withMicrosoft();
    const cases: Array<[string, () => void, string]> = [
      ['other tenant', () => (mock.tamper.claims = (c) => ({ ...c, tid: '99999999-9999-9999-9999-999999999999' })), 'wrong_tenant'],
      ['other app', () => (mock.tamper.claims = (c) => ({ ...c, aud: 'someone-elses-app' })), 'invalid_id_token'],
      ['forged signature', () => (mock.tamper.foreignKey = true), 'invalid_id_token'],
      ['replayed nonce', () => (mock.tamper.claims = (c) => ({ ...c, nonce: 'old-nonce' })), 'invalid_id_token'],
      ['no email', () => (mock.tamper.claims = ({ email, preferred_username, ...c }) => c), 'invalid_id_token'],
    ];
    for (const [name, arrange, reason] of cases) {
      mock.tamper.claims = undefined;
      mock.tamper.foreignKey = false;
      arrange();
      const flow = await signIn(env, { email: 'good@reva.edu.in' });
      assert.ok(flow.error === 'failed' || flow.error === 'domain', `${name}: ${flow.location}`);
      assert.equal(flow.code, undefined, name);
      const last = await env.audit.collection('login_events').find().sort({ at: -1 }).limit(1).next();
      assert.equal(last?.reason, reason, name);
    }
    assert.equal(await env.db.collection('users').countDocuments(), 0);
  });

  test('the sign-in must finish in the browser that started it, once', async () => {
    const env = await withMicrosoft();
    assert.equal((await signIn(env, { cookie: 'omit' })).error, 'expired');
    assert.equal((await signIn(env, { cookie: 'wrong' })).error, 'expired');
    const res = await fetch(`${env.base}/api/auth/microsoft/callback?code=abc&state=made-up`, { redirect: 'manual' });
    assert.match(res.headers.get('location')!, /error=expired/);
    assert.equal(await env.db.collection('users').countDocuments(), 0);
  });

  test('cancelling at Microsoft is recorded; bad codes and open redirects are refused', async () => {
    const env = await withMicrosoft();
    const flow = await signIn(env, { cancel: true });
    assert.equal(flow.error, 'cancelled');
    assert.equal((await env.audit.collection('login_events').findOne({}))?.reason, 'cancelled');

    for (const code of [undefined, 'x', { $ne: null }, 'a'.repeat(43)]) {
      assert.equal((await complete(env, code as any)).status, 400);
    }
    const res = await complete(env, (await signIn(env, { next: '//evil.example/steal' })).code);
    assert.equal(res.body.next, null);
  });

  test('without Microsoft settings, sign-in explains it is not configured', async () => {
    const env = await setup();
    const res = await fetch(`${env.base}/api/auth/microsoft/start?portal=staff`, { redirect: 'manual' });
    assert.equal(res.headers.get('location'), 'https://idealab.test/staff-login?error=not_configured');
  });
});

describe('Microsoft sign-in: staff', () => {
  test('staff added by an admin sign in to the staff portal with their role', async () => {
    const env = await withMicrosoft({ staff: STAFF });
    const res = await complete(env, (await signIn(env, { portal: 'staff', email: 'LAB@reva.edu.in' })).code);
    assert.equal(res.status, 200);
    assert.equal(res.body.staff.id, 's-lab');
    assert.equal(res.body.staff.role, 'LAB');
    assert.equal((await env.call('GET', '/api/print-orders', { token: res.body.token })).status, 200);
    const event = await env.audit.collection('login_events').findOne({});
    assert.equal(event?.account_kind, 'staff');
    assert.equal(event?.role, 'LAB');
  });

  test('people who are not staff, or were disabled, cannot enter the staff portal', async () => {
    const env = await withMicrosoft({ staff: STAFF });
    assert.equal((await signIn(env, { portal: 'staff', email: 'student@reva.edu.in' })).error, 'not_staff');
    assert.equal((await signIn(env, { portal: 'staff', email: 'off@reva.edu.in' })).error, 'staff_disabled');
    assert.equal(await env.db.collection('users').countDocuments(), 0, 'no student account is created from the staff page');
    const reasons = (await env.audit.collection('login_events').find().toArray()).map((e) => e.reason).sort();
    assert.deepEqual(reasons, ['not_staff', 'staff_not_verified']);
  });
});

describe('sign-in log for administrators', () => {
  async function withHistory() {
    const env = await withMicrosoft({ staff: STAFF });
    for (const email of ['a@reva.edu.in', 'b@reva.edu.in', 'a@reva.edu.in']) await complete(env, (await signIn(env, { email })).code);
    await complete(env, (await signIn(env, { portal: 'staff', email: 'lab@reva.edu.in' })).code);
    await signIn(env, { email: '=cmd@gmail.com' });
    return env;
  }

  test('counts: total sign-ins, unique students and staff, failures, today and per day', async () => {
    const env = await withHistory();
    const res = await env.call('GET', '/api/admin/sign-ins/summary', { token: staffToken('s-admin') });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.totals, {
      sign_ins: 4,
      failed_attempts: 1,
      unique_students: 2,
      unique_staff: 1,
      registered_students: 2,
      registered_staff: 4,
      sign_ins_by_method: { microsoft: 4, google: 0, password: 0, email: 0 },
    });
    assert.deepEqual(res.body.today, { sign_ins: 4, unique_people: 3 });
    assert.equal(res.body.daily.length, 1);
    assert.deepEqual(
      { ...res.body.daily[0], date: undefined },
      { date: undefined, sign_ins: 4, failures: 1, unique_students: 2, unique_staff: 1 },
    );
  });

  test('list and filter the log', async () => {
    const env = await withHistory();
    const token = staffToken('s-tech');
    const all = await env.call('GET', '/api/admin/sign-ins?limit=2', { token });
    assert.equal(all.body.total, 5);
    assert.equal(all.body.events.length, 2);
    assert.ok(all.body.events[0].id);
    const a = await env.call('GET', '/api/admin/sign-ins?email=a@reva&outcome=success', { token });
    assert.equal(a.body.total, 2);
    const staffOnly = await env.call('GET', '/api/admin/sign-ins?kind=staff', { token });
    assert.equal(staffOnly.body.total, 1);
    const failures = await env.call('GET', '/api/admin/sign-ins?outcome=failure', { token });
    assert.equal(failures.body.events[0].reason, 'domain_not_allowed');
    const future = await env.call('GET', '/api/admin/sign-ins?from=2999-01-01', { token });
    assert.equal(future.body.total, 0);
    for (const bad of ['?kind=admin', '?from=yesterday', `?email=${'a'.repeat(300)}`, '?limit=100000', '?email=(a+)+$', '?kind=student&kind=staff']) {
      const res = await env.call('GET', `/api/admin/sign-ins${bad}`, { token });
      assert.ok(res.status === 400 || (res.status === 200 && res.body.total === 0), bad);
    }
  });

  test('CSV export for proof, safe to open in Excel', async () => {
    const env = await withHistory();
    const res = await fetch(`${env.base}/api/admin/sign-ins/export`, { headers: { Authorization: `Bearer ${staffToken('s-admin')}` } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type')!, /text\/csv/);
    assert.match(res.headers.get('content-disposition')!, /attachment; filename="idealab-sign-ins-/);
    const lines = (await res.text()).trim().split('\n');
    assert.equal(lines.length, 6);
    assert.match(lines[0], /^time_utc,account_kind,method,outcome,reason,email,name,role,account_id,ip,user_agent,microsoft_oid/);
    assert.ok(lines.some((l) => l.includes(",'=cmd@gmail.com,")), 'formula-looking values are neutralised');
  });

  test('only administrators and tech support can see the log', async () => {
    const env = await withHistory();
    for (const path of ['/api/admin/sign-ins/summary', '/api/admin/sign-ins', '/api/admin/sign-ins/export']) {
      assert.equal((await env.call('GET', path)).status, 401, path);
      assert.equal((await env.call('GET', path, { token: userToken('u-x') })).status, 401, path);
      assert.equal((await env.call('GET', path, { token: staffToken('s-lab') })).status, 403, path);
      assert.equal((await env.call('GET', path, { token: staffToken('s-tech') })).status, 200, path);
    }
  });
});

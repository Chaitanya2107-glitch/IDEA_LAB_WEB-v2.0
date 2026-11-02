import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { hashPassword } from '../lib/password.js';
import { cleanup, linkToken, setup, staffToken, userToken, waitForMail } from './helpers.js';

afterEach(cleanup);

const PASSWORD = 'Correct-Horse-42';
const pause = (ms = 100) => new Promise((r) => setTimeout(r, ms));

const register = (call: any, email: string, password = PASSWORD, name = 'New Person') =>
  call('POST', '/api/auth/register', { body: { name, email, password } });
const login = (call: any, email: string, password = PASSWORD) => call('POST', '/api/auth/login', { body: { email, password } });
const verify = (call: any, token: string, password = PASSWORD) => call('POST', '/api/auth/verify-email', { body: { token, password } });

async function signUp(env: any, email: string, password = PASSWORD) {
  assert.equal((await register(env.call, email, password)).status, 202);
  await waitForMail(env.sent, email);
  const res = await verify(env.call, linkToken(env.sent, email), password);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

describe('email + password sign-up', () => {
  test('nothing is created until the emailed link is opened with the same password', async () => {
    const env = await setup();
    const res = await register(env.call, 'Visitor@Gmail.com');
    assert.equal(res.status, 202);
    assert.equal(await env.db.collection('users').countDocuments(), 0);
    await waitForMail(env.sent, 'visitor@gmail.com');
    assert.match(env.sent[0].text, /https:\/\/idealab\.test\/verify-email\?token=/);
    assert.equal((await login(env.call, 'visitor@gmail.com')).status, 401, 'cannot sign in before confirming');

    const token = linkToken(env.sent, 'visitor@gmail.com');
    const wrong = await verify(env.call, token, 'Someone-Elses-9');
    assert.equal(wrong.status, 401);
    const ok = await verify(env.call, token);
    assert.equal(ok.status, 201);
    assert.equal(ok.body.user.email, 'visitor@gmail.com');
    assert.equal(ok.body.user.type, 'non-university', 'general access for non-REVA addresses');
    assert.equal(ok.body.user.has_password, true);
    assert.equal(ok.body.user.password_hash, undefined);
    assert.equal((await env.call('GET', '/api/user/me', { token: ok.body.token })).body.user.id, ok.body.user.id);
    assert.equal((await verify(env.call, token)).status, 400, 'the link works once');
  });

  test('a confirmed @reva.edu.in mailbox gets university access', async () => {
    const env = await setup();
    const body = await signUp(env, 'student2@reva.edu.in');
    assert.equal(body.user.type, 'university');
  });

  test('the link stops working after 5 wrong passwords', async () => {
    const env = await setup();
    await register(env.call, 'x@example.com');
    await waitForMail(env.sent, 'x@example.com');
    const token = linkToken(env.sent, 'x@example.com');
    for (let i = 0; i < 5; i++) assert.equal((await verify(env.call, token, `Wrong-Pass-${i}x`)).status, 401);
    assert.equal((await verify(env.call, token)).status, 400);
  });

  test('weak passwords, bad emails and operator input are refused', async () => {
    const env = await setup();
    assert.equal((await register(env.call, 'a@example.com', 'short')).status, 400);
    assert.equal((await register(env.call, 'a@example.com', 'password123')).status, 400);
    assert.equal((await register(env.call, 'a@example.com', 'a@example.com')).status, 400);
    assert.equal((await register(env.call, 'not-an-email')).status, 400);
    const injected = await env.call('POST', '/api/auth/login', { body: { email: { $gt: '' }, password: { $ne: '' } } });
    assert.equal(injected.status, 400);
    assert.equal((await env.call('POST', '/api/auth/register', { body: { email: 'a@example.com', password: PASSWORD } })).status, 400, 'name required');
  });

  test('same answer for new and existing addresses; the owner is told instead of a second account', async () => {
    const env = await setup();
    await signUp(env, 'owner@example.com');
    const fresh = await register(env.call, 'fresh@example.com');
    const again = await register(env.call, 'owner@example.com', 'Attacker-Pass-1');
    assert.equal(again.status, fresh.status);
    assert.equal(again.body.message.replace('owner@', 'fresh@'), fresh.body.message);
    await waitForMail(env.sent, 'owner@example.com', 2);
    assert.match(env.sent.filter((m) => m.to === 'owner@example.com').at(-1)!.subject, /already have/);
    assert.equal((await login(env.call, 'owner@example.com', 'Attacker-Pass-1')).status, 401);
    assert.equal((await login(env.call, 'owner@example.com')).status, 200);
  });

  test('confirmation emails are limited to one a minute per address', async () => {
    const env = await setup();
    await register(env.call, 'spam@example.com');
    await register(env.call, 'spam@example.com');
    await register(env.call, 'spam@example.com');
    await waitForMail(env.sent, 'spam@example.com');
    await pause();
    assert.equal(env.sent.length, 1);
  });

  test('a Microsoft/Google account gets a password only when its owner confirms from the mailbox', async () => {
    const env = await setup({
      users: [{ id: 'u-ms', name: 'MS Student', email: 'ms@reva.edu.in', role: 'USER', type: 'university', password_hash: null, token_version: 0 }],
    });
    const before = userToken('u-ms');
    assert.equal((await login(env.call, 'ms@reva.edu.in')).status, 401);
    const body = await signUp(env, 'ms@reva.edu.in');
    assert.equal(body.user.id, 'u-ms', 'same account, data kept');
    assert.equal((await login(env.call, 'ms@reva.edu.in')).status, 200);
    assert.equal((await env.call('GET', '/api/user/me', { token: before })).status, 200, 'adding a first password keeps sessions');
  });

  test('staff cannot sign in to the staff portal with a student password', async () => {
    const env = await setup({ staff: [{ id: 's-lab', name: 'Lab', email: 'lab@reva.edu.in', role: 'LAB', is_verified: true, password_hash: null }] });
    await signUp(env, 'lab@reva.edu.in');
    const staffLogin = await env.call('POST', '/api/auth/staff-login', { body: { email: 'lab@reva.edu.in', password: PASSWORD } });
    assert.equal(staffLogin.status, 401);
    const student = await login(env.call, 'lab@reva.edu.in');
    assert.equal(student.status, 200);
    assert.ok(student.body.user, 'a student-portal session, not a staff one');
    assert.equal(student.body.staff, undefined);
  });
});

describe('email + password sign-in', () => {
  const seeded = async () => ({
    users: [
      { id: 'u-pw', name: 'Pw User', email: 'pw@example.com', role: 'USER', type: 'non-university', password_hash: await hashPassword(PASSWORD), token_version: 0 },
      { id: 'u-ms', name: 'MS Student', email: 'ms@reva.edu.in', role: 'USER', type: 'university', password_hash: null, token_version: 0 },
    ],
  });

  test('signs in, and wrong password / unknown / no-password accounts get the same answer', async () => {
    const env = await setup(await seeded());
    const ok = await login(env.call, 'PW@example.com');
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.id, 'u-pw');
    const wrong = await login(env.call, 'pw@example.com', 'Wrong-Pass-11');
    const unknown = await login(env.call, 'ghost@example.com');
    const microsoftOnly = await login(env.call, 'ms@reva.edu.in');
    for (const r of [wrong, unknown, microsoftOnly]) {
      assert.equal(r.status, 401);
      assert.deepEqual(r.body, wrong.body);
    }
  });

  test('ten wrong passwords lock the account for 15 minutes', async () => {
    const env = await setup(await seeded());
    for (let i = 0; i < 10; i++) await login(env.call, 'pw@example.com', `Wrong-Pass-${i}x`);
    const locked = await login(env.call, 'pw@example.com');
    assert.equal(locked.status, 429);
    assert.match(locked.body.error, /Try again in 15 minute/);
  });

  test('every attempt goes to its own log database, not the Microsoft or Google logs', async () => {
    const env = await setup(await seeded());
    await login(env.call, 'pw@example.com');
    await login(env.call, 'pw@example.com', 'Wrong-Pass-11');
    await signUp(env, 'new@example.com');
    const events = await env.passwordAudit.collection('login_events').find().sort({ at: 1 }).toArray();
    assert.deepEqual(events.map((e) => [e.method, e.outcome, e.reason, e.email]), [
      ['email', 'success', null, 'pw@example.com'],
      ['email', 'failure', 'bad_password', 'pw@example.com'],
      ['email', 'success', 'sign_up', 'new@example.com'],
    ]);
    assert.ok(events[0].ip);
    assert.equal(await env.audit.collection('login_events').countDocuments(), 0);
    assert.equal(await env.googleAudit.collection('login_events').countDocuments(), 0);
  });

  test('forgot password: link for password accounts only, works once, signs out other sessions', async () => {
    const env = await setup(await seeded());
    const session = (await login(env.call, 'pw@example.com')).body.token;
    const answers: unknown[] = [];
    for (const email of ['pw@example.com', 'ms@reva.edu.in', 'ghost@example.com']) {
      answers.push((await env.call('POST', '/api/auth/forgot-password', { body: { email } })).body);
    }
    for (const a of answers) assert.deepEqual(a, answers[0]);
    await waitForMail(env.sent, 'pw@example.com');
    await pause();
    assert.deepEqual(env.sent.map((m) => m.to), ['pw@example.com']);

    const token = linkToken(env.sent, 'pw@example.com');
    const reset = await env.call('POST', '/api/auth/reset-password', { body: { token, password: 'Brand-New-Pass-7' } });
    assert.equal(reset.status, 200);
    assert.equal(reset.body.account, 'user');
    assert.equal((await env.call('POST', '/api/auth/reset-password', { body: { token, password: 'Another-Pass-8' } })).status, 400);
    assert.equal((await env.call('GET', '/api/user/me', { token: session })).status, 401);
    assert.equal((await login(env.call, 'pw@example.com')).status, 401);
    assert.equal((await login(env.call, 'pw@example.com', 'Brand-New-Pass-7')).status, 200);
  });

  test('change password in Settings; Microsoft-only students have nothing to change', async () => {
    const env = await setup(await seeded());
    const a = (await login(env.call, 'pw@example.com')).body.token;
    const b = (await login(env.call, 'pw@example.com')).body.token;
    const changed = await env.call('POST', '/api/auth/change-password', { token: a, body: { currentPassword: PASSWORD, newPassword: 'Brand-New-Pass-7' } });
    assert.equal(changed.status, 200);
    assert.equal((await env.call('GET', '/api/user/me', { token: changed.body.token })).body.user.id, 'u-pw');
    assert.equal((await env.call('GET', '/api/user/me', { token: b })).status, 401);
    const ms = await env.call('POST', '/api/auth/change-password', { token: userToken('u-ms'), body: { currentPassword: PASSWORD, newPassword: 'Brand-New-Pass-7' } });
    assert.equal(ms.status, 403);
  });

  test('sign-in log shows email sign-ins under their own method and counts people once', async () => {
    const env = await setup({
      ...(await seeded()),
      staff: [{ id: 's-tech', name: 'Tech', email: 'tech@reva.edu.in', role: 'TECH_SUPPORT', is_verified: true }],
    });
    await login(env.call, 'pw@example.com');
    await login(env.call, 'pw@example.com');
    // The same person also signed in with Microsoft.
    await env.audit.collection('login_events').insertOne({
      _id: 'ms-1' as any, at: new Date(), account_kind: 'student', method: 'microsoft', outcome: 'success', account_id: 'u-pw', email: 'pw@example.com',
    });
    const token = staffToken('s-tech');
    const summary = await env.call('GET', '/api/admin/sign-ins/summary', { token });
    assert.equal(summary.status, 200);
    assert.equal(summary.body.totals.sign_ins, 3);
    assert.equal(summary.body.totals.unique_students, 1);
    assert.equal(summary.body.totals.sign_ins_by_method.email, 2);
    assert.equal(summary.body.daily[0].unique_students, 1);
    const list = await env.call('GET', '/api/admin/sign-ins?method=email', { token });
    assert.equal(list.body.total, 2);
    assert.ok(list.body.events.every((e: any) => e.method === 'email'));
  });
});

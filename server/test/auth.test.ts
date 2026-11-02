import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import jwt from 'jsonwebtoken';
import { hashPassword } from '../lib/password.js';
import { cleanup, config, linkToken, setup, staffToken, userToken, waitForMail } from './helpers.js';

afterEach(cleanup);

const PASSWORD = 'Correct-Horse-42';

async function accounts() {
  const hash = await hashPassword(PASSWORD);
  return {
    staff: [
      // The emergency administrator (created with `create-admin`) is the only password account.
      { id: 's-admin', name: 'Admin', email: 'admin@reva.edu.in', role: 'ADMIN', is_verified: true, password_hash: hash },
      { id: 's-tech', name: 'Tech', email: 'tech@reva.edu.in', role: 'TECH_SUPPORT', is_verified: true, password_hash: hash },
      { id: 's-off', name: 'Disabled', email: 'off@reva.edu.in', role: 'ADMIN', is_verified: false, password_hash: hash },
    ],
    // Signed up with Microsoft: no password.
    users: [{ id: 'u-1', name: 'Student One', email: 'one@reva.edu.in', role: 'USER', type: 'university', password_hash: null }],
  };
}

const adminLogin = (call: any, password = PASSWORD, email = 'admin@reva.edu.in') =>
  call('POST', '/api/auth/staff-login', { body: { email, password } });

describe('staff password form', () => {
  test('students and non-admin staff cannot use the password form, even with the right password', async () => {
    const { call } = await setup(await accounts());
    const student = await adminLogin(call, PASSWORD, 'one@reva.edu.in');
    const tech = await adminLogin(call, PASSWORD, 'tech@reva.edu.in');
    const unknown = await adminLogin(call, PASSWORD, 'nobody@reva.edu.in');
    for (const res of [student, tech, unknown]) assert.equal(res.status, 401);
    assert.deepEqual(student.body, unknown.body, 'same answer, so the form does not reveal who exists');
  });
});

describe('emergency administrator sign-in', () => {
  test('signs in and is recorded in the audit log', async () => {
    const { call, audit } = await setup(await accounts());
    const res = await adminLogin(call);
    assert.equal(res.status, 200);
    assert.equal(res.body.staff.role, 'ADMIN');
    assert.equal(res.body.staff.password_hash, undefined);
    assert.equal((await call('GET', '/api/user/me', { token: res.body.token })).body.staff.id, 's-admin');

    await adminLogin(call, 'wrong-pass-1');
    const events = await audit.collection('login_events').find().sort({ at: 1 }).toArray();
    assert.equal(events.length, 2);
    assert.equal(events[0].outcome, 'success');
    assert.equal(events[0].method, 'password');
    assert.equal(events[0].account_id, 's-admin');
    assert.ok(events[0].at instanceof Date);
    assert.equal(events[1].outcome, 'failure');
    assert.equal(events[1].reason, 'bad_credentials');
    assert.equal(events[1].email, 'admin@reva.edu.in');
  });

  test('ten failed attempts lock the account for 15 minutes', async () => {
    const { call, db } = await setup(await accounts());
    for (let i = 0; i < 10; i++) assert.equal((await adminLogin(call, `wrong-${i}-pass`)).status, 401);
    const locked = await adminLogin(call);
    assert.equal(locked.status, 429, 'even the right password is refused while locked');
    assert.match(locked.body.error, /Try again in 1[45] minute/);
    await db.collection('staff').updateOne({ _id: 's-admin' } as any, { $set: { locked_until: new Date(Date.now() - 1000).toISOString() } });
    assert.equal((await adminLogin(call)).status, 200);
  });

  test('a disabled administrator cannot sign in', async () => {
    const { call } = await setup(await accounts());
    assert.equal((await adminLogin(call, PASSWORD, 'off@reva.edu.in')).status, 403);
  });

  test('operator-style input is rejected, not interpreted', async () => {
    const { call } = await setup(await accounts());
    for (const email of [{ $gt: '' }, { $ne: null }, ['admin@reva.edu.in']]) {
      const res = await call('POST', '/api/auth/staff-login', { body: { email, password: { $gt: '' } } });
      assert.equal(res.status, 400);
    }
    assert.equal((await call('POST', '/api/auth/staff-login', { body: { email: 'admin@reva.edu.in', password: { $gt: '' } } })).status, 400);
  });
});

describe('administrator password reset and sessions', () => {
  test('reset link works once and signs out existing sessions; only the newest link works', async () => {
    const { call, sent, db } = await setup(await accounts());
    const session = (await adminLogin(call)).body.token;
    await call('POST', '/api/auth/forgot-password', { body: { email: 'admin@reva.edu.in' } });
    await waitForMail(sent, 'admin@reva.edu.in', 1);
    const older = linkToken(sent, 'admin@reva.edu.in');
    // A second request within a minute sends nothing (no mail bombing).
    await call('POST', '/api/auth/forgot-password', { body: { email: 'admin@reva.edu.in' } });
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(sent.length, 1);
    await db.collection('auth_tokens').updateMany({ purpose: 'reset-password' }, { $set: { created_at: new Date(Date.now() - 120_000).toISOString() } });
    await call('POST', '/api/auth/forgot-password', { body: { email: 'admin@reva.edu.in' } });
    await waitForMail(sent, 'admin@reva.edu.in', 2);
    const newer = linkToken(sent, 'admin@reva.edu.in');
    assert.match(sent.at(-1)!.text, /https:\/\/idealab\.test\/reset-password\?token=/);

    assert.equal((await call('POST', '/api/auth/reset-password', { body: { token: older, password: 'Brand-New-Pass-7' } })).status, 400);
    assert.equal((await call('POST', '/api/auth/reset-password', { body: { token: newer, password: 'short' } })).status, 400);
    assert.equal((await call('POST', '/api/auth/reset-password', { body: { token: newer, password: 'Brand-New-Pass-7' } })).status, 200);
    assert.equal((await call('POST', '/api/auth/reset-password', { body: { token: newer, password: 'Another-Pass-8' } })).status, 400, 'single use');
    assert.equal((await call('GET', '/api/user/me', { token: session })).status, 401);
    assert.equal((await adminLogin(call, 'Brand-New-Pass-7')).status, 200);
  });

  test('forgot-password sends nothing to students, other staff or unknown emails, and answers the same', async () => {
    const { call, sent } = await setup(await accounts());
    const answers: unknown[] = [];
    for (const email of ['admin@reva.edu.in', 'one@reva.edu.in', 'tech@reva.edu.in', 'ghost@reva.edu.in']) {
      answers.push((await call('POST', '/api/auth/forgot-password', { body: { email } })).body);
    }
    for (const a of answers) assert.deepEqual(a, answers[0]);
    await waitForMail(sent, 'admin@reva.edu.in', 1);
    await new Promise((r) => setTimeout(r, 100));
    assert.deepEqual(sent.map((m) => m.to), ['admin@reva.edu.in']);
  });

  test('change password keeps this session and ends the others; students have no password to change', async () => {
    const { call } = await setup(await accounts());
    const a = (await adminLogin(call)).body.token;
    const b = (await adminLogin(call)).body.token;
    assert.equal((await call('POST', '/api/auth/change-password', { token: a, body: { currentPassword: 'wrong-pass-1', newPassword: 'Brand-New-Pass-7' } })).status, 401);
    const changed = await call('POST', '/api/auth/change-password', { token: a, body: { currentPassword: PASSWORD, newPassword: 'Brand-New-Pass-7' } });
    assert.equal(changed.status, 200);
    assert.equal((await call('GET', '/api/user/me', { token: changed.body.token })).status, 200);
    assert.equal((await call('GET', '/api/user/me', { token: a })).status, 401);
    assert.equal((await call('GET', '/api/user/me', { token: b })).status, 401);

    const student = await call('POST', '/api/auth/change-password', { token: userToken('u-1'), body: { currentPassword: PASSWORD, newPassword: 'Brand-New-Pass-7' } });
    assert.equal(student.status, 403);
  });

  test('sign out everywhere ends all sessions', async () => {
    const { call } = await setup(await accounts());
    const token = userToken('u-1');
    assert.equal((await call('POST', '/api/auth/logout-all', { token })).status, 200);
    assert.equal((await call('GET', '/api/user/me', { token })).status, 401);
  });

  test('forged, unsigned, expired and wrong-kind tokens are rejected', async () => {
    const { call } = await setup(await accounts());
    const forged = jwt.sign({ kind: 'staff', tv: 0 }, 'wrong-secret', { subject: 's-admin' });
    const none = jwt.sign({ kind: 'staff', tv: 0, sub: 's-admin' }, '', { algorithm: 'none' } as any);
    const expired = jwt.sign({ kind: 'staff', tv: 0 }, config.jwtSecret, { subject: 's-admin', expiresIn: -10 });
    const noKind = jwt.sign({ tv: 0 }, config.jwtSecret, { subject: 's-admin' });
    for (const token of [forged, none, expired, noKind]) {
      assert.equal((await call('GET', '/api/users', { token })).status, 401);
    }
    // A staff id presented as a student token does not find a student.
    assert.equal((await call('GET', '/api/user/me', { token: userToken('s-admin') })).status, 401);
    assert.equal((await call('GET', '/api/users', { token: staffToken('s-admin') })).status, 200);
  });

  test('deleted or de-verified staff lose access immediately', async () => {
    const { call, db } = await setup(await accounts());
    const token = staffToken('s-tech');
    assert.equal((await call('GET', '/api/users', { token })).status, 200);
    await db.collection('staff').updateOne({ _id: 's-tech' } as any, { $set: { is_verified: false } });
    assert.equal((await call('GET', '/api/users', { token })).status, 403);
    await db.collection('staff').deleteOne({ _id: 's-tech' } as any);
    assert.equal((await call('GET', '/api/users', { token })).status, 401);
  });
});

describe('staff accounts', () => {
  test('admins add @reva.edu.in staff without passwords; tech support cannot create admins', async () => {
    const { call, db } = await setup(await accounts());
    const member = { name: 'New Lab', email: 'NewLab@reva.edu.in', role: 'lab', password: 'Lab-Pass-2026' };
    assert.equal((await call('POST', '/api/auth/create-staff', { body: member })).status, 401);
    assert.equal((await call('POST', '/api/auth/create-staff', { token: staffToken('s-tech'), body: { ...member, role: 'ADMIN' } })).status, 403);
    const outsider = await call('POST', '/api/auth/create-staff', { token: staffToken('s-admin'), body: { ...member, email: 'lab@gmail.com' } });
    assert.equal(outsider.status, 400);

    const created = await call('POST', '/api/auth/create-staff', { token: staffToken('s-admin'), body: member });
    assert.equal(created.status, 201);
    assert.equal(created.body.staff.role, 'LAB');
    assert.equal(created.body.staff.email, 'newlab@reva.edu.in');
    assert.equal((await call('POST', '/api/auth/create-staff', { token: staffToken('s-admin'), body: member })).status, 409);

    const stored = await db.collection('staff').findOne({ email: 'newlab@reva.edu.in' });
    assert.equal(stored?.password_hash, null, 'a sent password is ignored; staff sign in with Microsoft');
    assert.equal((await adminLogin(call, 'Lab-Pass-2026', 'newlab@reva.edu.in')).status, 401);
  });
});

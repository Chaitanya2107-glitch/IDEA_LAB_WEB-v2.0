import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { afterEach, describe, test } from 'node:test';
import { cleanup, daysFromNow, setup, staffToken, userToken, type TestEnv } from './helpers.js';

afterEach(cleanup);

const USERS = Array.from({ length: 12 }, (_, i) => ({ id: `u-${i + 1}`, name: `Student ${i + 1}`, email: `s${i + 1}@reva.edu.in`, role: 'USER', type: 'university' }));
const STAFF = [
  { id: 's-admin', name: 'Admin', email: 'admin@reva.edu.in', role: 'ADMIN', is_verified: true },
  { id: 's-lab', name: 'Lab', email: 'lab@reva.edu.in', role: 'LAB', is_verified: true },
];
const DAY = daysFromNow(20);
const MORNING = { startTime: '09:00', endTime: '12:00' };
const AFTERNOON = { startTime: '13:00', endTime: '16:00' };
const EVENING = { startTime: '16:00', endTime: '19:00' };
const FULL_DAY = { startTime: '09:00', endTime: '18:00' };

const book = (env: TestEnv, user: string, times: object, date = DAY) =>
  env.call('POST', '/api/slots', { token: userToken(user), body: { bookingDate: date, purpose: 'Project work', attendees: 3, ...times } });

describe('lab slot booking: one booking per time slot', () => {
  test('a taken slot cannot be booked again; overlapping times are refused; free times work', async () => {
    const env = await setup({ users: USERS });
    assert.equal((await book(env, 'u-1', MORNING)).status, 201);
    const again = await book(env, 'u-2', MORNING);
    assert.equal(again.status, 409);
    assert.match(again.body.error, /already booked/);
    assert.equal((await book(env, 'u-1', MORNING)).status, 409, 'not even the same student twice');
    assert.equal((await book(env, 'u-3', FULL_DAY)).status, 409, 'full day overlaps the morning');
    assert.equal((await book(env, 'u-4', AFTERNOON)).status, 201);
    assert.equal((await book(env, 'u-5', EVENING)).status, 201, '16:00 end and 16:00 start do not overlap');
    assert.equal((await book(env, 'u-6', MORNING, daysFromNow(21))).status, 201, 'another day is free');
  });

  test('ten students pressing Book at the same moment: exactly one gets the slot', async () => {
    const env = await setup({ users: USERS });
    const results = await Promise.all(USERS.slice(0, 10).map((u) => book(env, u.id, AFTERNOON)));
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 9);
    assert.equal(await env.db.collection('slot_bookings').countDocuments({ status: 'pending' }), 1);
    // A full-day request racing against a morning one: never both.
    const env2 = await setup({ users: USERS });
    const [a, b] = await Promise.all([book(env2, 'u-1', FULL_DAY), book(env2, 'u-2', MORNING)]);
    assert.equal([a.status, b.status].filter((s) => s === 201).length, 1);
  });

  test('rejecting or cancelling frees the slot; re-opening needs the slot to be free', async () => {
    const env = await setup({ users: USERS, staff: STAFF });
    const first = (await book(env, 'u-1', MORNING)).body;
    const admin = staffToken('s-admin');
    await env.call('PUT', `/api/slots/${first.id}`, { token: admin, body: { status: 'rejected', rejectionReason: 'Maintenance' } });
    const second = await book(env, 'u-2', MORNING);
    assert.equal(second.status, 201, 'rejected booking released the time');
    const reopen = await env.call('PUT', `/api/slots/${first.id}`, { token: admin, body: { status: 'approved' } });
    assert.equal(reopen.status, 409, 'cannot approve a booking whose time is now taken');

    assert.equal((await env.call('POST', `/api/slots/${second.body.id}/cancel`, { token: userToken('u-3') })).status, 404, 'only the owner cancels');
    const cancelled = await env.call('POST', `/api/slots/${second.body.id}/cancel`, { token: userToken('u-2') });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, 'cancelled');
    assert.equal((await env.call('POST', `/api/slots/${second.body.id}/cancel`, { token: userToken('u-2') })).status, 409);
    assert.equal((await book(env, 'u-3', MORNING)).status, 201, 'cancelled booking released the time');
    assert.equal(await env.db.collection('slot_cells').countDocuments({ booking_id: first.id }), 0);
  });

  test('older bookings without times block the whole day; times are validated; calendar shows taken times', async () => {
    const env = await setup({ users: USERS, slot_bookings: [{ id: 'old', user_id: 'u-9', date: DAY, status: 'approved', purpose: 'x' }] });
    assert.equal((await book(env, 'u-1', EVENING)).status, 409);
    assert.equal((await book(env, 'u-1', {}, daysFromNow(22))).status, 400, 'times are required');
    assert.equal((await book(env, 'u-1', { startTime: '12:00', endTime: '09:00' }, daysFromNow(22))).status, 400);
    await book(env, 'u-1', AFTERNOON, daysFromNow(22));
    const calendar = (await env.call('GET', '/api/slots/calendar')).body;
    assert.deepEqual(
      calendar.find((c: any) => c.date === daysFromNow(22)),
      { date: daysFromNow(22), status: 'pending', purpose: 'Project work', start_time: '13:00', end_time: '16:00' },
    );
    assert.ok(calendar.every((c: any) => !('user_id' in c) && !('user_name' in c)));
  });
});

describe('event registration: no double registration or overbooking', () => {
  const event = (extra: object = {}) => ({ id: 'ev-1', title: 'Workshop', start_date: '2099-06-01', end_date: '2099-06-01', status: 'upcoming', max_attendees: 3, registered_count: 0, ...extra });
  const register = (env: TestEnv, user: string, eventId = 'ev-1') =>
    env.call('POST', '/api/events/register', { token: userToken(user), body: { event_id: eventId, name: 'Student' } });

  test('ten students race for 3 seats: exactly 3 get in and the count stays right', async () => {
    const env = await setup({ users: USERS, events: [event()] });
    const results = await Promise.all(USERS.slice(0, 10).map((u) => register(env, u.id)));
    assert.equal(results.filter((r) => r.status === 201).length, 3);
    assert.ok(results.filter((r) => r.status !== 201).every((r) => r.status === 409 && /full/.test(r.body.error)));
    assert.equal(await env.db.collection('event_registrations').countDocuments({ event_id: 'ev-1' }), 3);
    assert.equal((await env.db.collection('events').findOne({ _id: 'ev-1' } as any))?.registered_count, 3);
  });

  test('the same student registering twice at once is recorded once, and seats are not lost', async () => {
    const env = await setup({ users: USERS, events: [event({ max_attendees: 10 })] });
    const results = await Promise.all(Array.from({ length: 5 }, () => register(env, 'u-1')));
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(await env.db.collection('event_registrations').countDocuments({ event_id: 'ev-1' }), 1);
    assert.equal((await env.db.collection('events').findOne({ _id: 'ev-1' } as any))?.registered_count, 1);
  });

  test('registration is closed for past or cancelled events', async () => {
    const env = await setup({
      users: USERS,
      events: [event({ id: 'ev-past', start_date: '2001-01-01', end_date: '2001-01-02' }), event({ id: 'ev-cancelled', status: 'cancelled' })],
    });
    for (const id of ['ev-past', 'ev-cancelled']) {
      const res = await register(env, 'u-1', id);
      assert.equal(res.status, 409, id);
      assert.match(res.body.error, /closed/);
    }
  });
});

describe('PCB orders: design upload and online payment', () => {
  const specs = { dimensions: '100x100mm', layers: 2, quantity: 5, surfaceFinish: 'HASL' };

  async function uploadDesign(env: TestEnv, user: string, fileName = 'board.zip') {
    const ticket = await env.call('POST', '/api/uploads', { token: userToken(user), body: { bucket: 'pcb-files', fileName, size: 22 } });
    if (ticket.status !== 200) return ticket;
    const put = await fetch(env.base + ticket.body.uploadUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${userToken(user)}`, 'Content-Type': 'application/octet-stream' },
      body: Buffer.from('PK\x03\x04 gerber files'),
    });
    assert.ok(put.ok, `upload failed: ${put.status}`);
    return ticket;
  }
  const order = (env: TestEnv, user: string, extra: object = {}) =>
    env.call('POST', '/api/pcb-orders', { token: userToken(user), body: { fileName: 'board.zip', specs, ...extra } });

  test('design files: private upload of Gerber archives only; orders must use your own file', async () => {
    const env = await setup({ users: USERS, staff: STAFF });
    assert.equal((await uploadDesign(env, 'u-1', 'virus.exe')).status, 400);
    const ticket = await uploadDesign(env, 'u-1');
    assert.equal(ticket.body.publicUrl, null, 'not publicly reachable');
    assert.equal((await order(env, 'u-2', { storagePath: ticket.body.path })).status, 403, "someone else's file");
    assert.equal((await order(env, 'u-1', { storagePath: 'u-1/123_missing.zip' })).status, 400);
    const placed = await order(env, 'u-1', { storagePath: ticket.body.path, paymentMethod: 'lab' });
    assert.equal(placed.status, 201);
    assert.equal(placed.body.hasDesignFile, true);

    assert.equal((await env.call('GET', `/api/pcb-orders/${placed.body.id}/download`, { token: userToken('u-1') })).status, 403);
    const link = await env.call('GET', `/api/pcb-orders/${placed.body.id}/download`, { token: staffToken('s-lab') });
    assert.equal(link.status, 200);
    const file = await fetch(env.base + link.body.url);
    assert.equal(file.status, 200);
    assert.match(await file.text(), /gerber files/);
  });

  test('pay at lab: order is queued and unpaid; online checkout is not offered', async () => {
    const env = await setup({ users: USERS });
    const res = await order(env, 'u-1', { paymentMethod: 'lab' });
    assert.equal(res.body.status, 'queued');
    assert.equal(res.body.paymentStatus, 'pending');
    assert.equal(res.body.cost, 2200, 'priced on the server');
    assert.equal((await env.call('POST', `/api/payments/pcb-orders/${res.body.id}/order`, { token: userToken('u-1') })).status, 409);
  });

  test('pay online: checkout for the server price, verified once, then the order joins the queue', async () => {
    const env = await setup({ users: USERS });
    const placed = await order(env, 'u-1', { paymentMethod: 'online', cost: 1 });
    assert.equal(placed.body.status, 'pending_payment');
    assert.equal(placed.body.cost, 2200, 'client-sent cost is ignored');
    assert.equal((await env.call('POST', `/api/payments/pcb-orders/${placed.body.id}/order`, { token: userToken('u-2') })).status, 404);
    const checkout = await env.call('POST', `/api/payments/pcb-orders/${placed.body.id}/order`, { token: userToken('u-1') });
    assert.equal(checkout.body.amount, 220000);
    assert.equal(env.gatewayOrders.get(checkout.body.orderId)?.notes?.pcb_order_id, placed.body.id);

    const token = userToken('u-1');
    const bad = await env.call('POST', '/api/payments/verify', { token, body: { razorpay_order_id: checkout.body.orderId, razorpay_payment_id: 'pay_pcb', razorpay_signature: 'nope' } });
    assert.equal(bad.status, 400);
    const signature = createHmac('sha256', 'rz-secret').update(`${checkout.body.orderId}|pay_pcb`).digest('hex');
    const payload = { razorpay_order_id: checkout.body.orderId, razorpay_payment_id: 'pay_pcb', razorpay_signature: signature };
    const [a, b] = await Promise.all([
      env.call('POST', '/api/payments/verify', { token, body: payload }),
      env.call('POST', '/api/payments/verify', { token, body: payload }),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(a.body.kind, 'pcb');
    const stored = await env.db.collection('pcb_orders').findOne({ _id: placed.body.id } as any);
    assert.equal(stored?.payment_status, 'paid');
    assert.equal(stored?.status, 'queued');
    assert.equal(stored?.payment_method, 'Online: pay_pcb');
    assert.equal((await env.call('POST', `/api/payments/pcb-orders/${placed.body.id}/order`, { token })).status, 409, 'already paid');
  });

  test('webhook confirms PCB payments and rejects wrong amounts', async () => {
    const env = await setup({
      users: USERS,
      pcb_orders: [{ id: 'pcb-1', user_id: 'u-1', cost: 2200, status: 'pending_payment', payment_status: 'pending', created_at: new Date().toISOString() }],
    });
    env.gatewayOrders.set('order_p', { id: 'order_p', amount: 220000, currency: 'INR', status: 'paid', notes: { pcb_order_id: 'pcb-1' } });
    const event = (amount: number) => JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_w', order_id: 'order_p', amount } } } });
    const sign = (raw: string) => createHmac('sha256', 'wh-secret').update(raw).digest('hex');
    const send = (raw: string) => env.call('POST', '/api/payments/razorpay/webhook', { raw, headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': sign(raw) } });
    assert.equal((await send(event(100))).body.status, 'ignored');
    assert.equal((await env.db.collection('pcb_orders').findOne({ _id: 'pcb-1' } as any))?.payment_status, 'pending');
    assert.equal((await send(event(220000))).status, 200);
    const stored = await env.db.collection('pcb_orders').findOne({ _id: 'pcb-1' } as any);
    assert.equal(stored?.payment_status, 'paid');
    assert.equal(stored?.status, 'queued');
  });

  test('unpaid online orders expire after 30 minutes and can no longer be paid', async () => {
    const old = new Date(Date.now() - 31 * 60 * 1000).toISOString();
    const env = await setup({
      users: USERS,
      pcb_orders: [{ id: 'pcb-old', user_id: 'u-1', cost: 2200, status: 'pending_payment', payment_status: 'pending', created_at: old }],
    });
    assert.equal((await env.call('POST', '/api/payments/pcb-orders/pcb-old/order', { token: userToken('u-1') })).status, 409);
    const list = (await env.call('GET', '/api/pcb-orders', { token: userToken('u-1') })).body;
    assert.equal(list[0].status, 'cancelled');
  });

  test('without Razorpay keys, online PCB payment is refused before an order is created', async () => {
    const env = await setup({ users: USERS }, {}, { paymentsConfigured: false });
    const res = await order(env, 'u-1', { paymentMethod: 'online' });
    assert.equal(res.status, 503);
    assert.match(res.body.error, /Pay at Lab/);
    assert.equal(await env.db.collection('pcb_orders').countDocuments(), 0);
    assert.equal((await order(env, 'u-1', { paymentMethod: 'lab' })).status, 201, 'pay at lab still works');
  });
});

describe('abuse limits', () => {
  test('general-access (Google) accounts cannot book lab slots', async () => {
    const env = await setup({ users: [{ id: 'g-1', name: 'Visitor', email: 'v@gmail.com', role: 'USER', type: 'non-university' }] });
    const res = await book(env, 'g-1', MORNING);
    assert.equal(res.status, 403);
    assert.match(res.body.error, /REVA students/);
  });

  test('a student can hold at most 3 upcoming bookings, and only up to 60 days ahead', async () => {
    const env = await setup({ users: USERS, staff: STAFF });
    for (let d = 1; d <= 3; d++) assert.equal((await book(env, 'u-1', MORNING, daysFromNow(d))).status, 201);
    const fourth = await book(env, 'u-1', MORNING, daysFromNow(4));
    assert.equal(fourth.status, 409);
    assert.match(fourth.body.error, /3 upcoming bookings/);
    const first = (await env.call('GET', '/api/slots', { token: userToken('u-1') })).body[0];
    await env.call('POST', `/api/slots/${first.id}/cancel`, { token: userToken('u-1') });
    assert.equal((await book(env, 'u-1', MORNING, daysFromNow(4))).status, 201, 'cancelling frees a place');
    assert.equal((await book(env, 'u-2', MORNING, daysFromNow(61))).status, 400, 'too far ahead');
  });

  test('students have a daily upload limit; staff do not', async () => {
    const env = await setup({ users: USERS, staff: STAFF });
    const ask = (token: string) => env.call('POST', '/api/uploads', { token, body: { bucket: 'stl-files', fileName: 'part.stl', size: 100 } });
    for (let i = 0; i < 40; i++) assert.equal((await ask(userToken('u-1'))).status, 200);
    const over = await ask(userToken('u-1'));
    assert.equal(over.status, 429);
    assert.equal((await ask(userToken('u-2'))).status, 200, 'other students unaffected');
    const staffAsk = await env.call('POST', '/api/uploads', { token: staffToken('s-lab'), body: { bucket: 'projects', folder: 'gallery', fileName: 'a.png', contentType: 'image/png', size: 100 } });
    assert.equal(staffAsk.status, 200);
  });

  test('staff cannot print or fabricate an online order that was never paid', async () => {
    const now = new Date().toISOString();
    const env = await setup({
      users: USERS,
      staff: STAFF,
      print_orders: [{ id: 'po-unpaid', user_id: 'u-1', cost: 50, status: 'pending_payment', payment_status: 'pending', created_at: now }],
      pcb_orders: [{ id: 'pcb-unpaid', user_id: 'u-1', cost: 2200, status: 'pending_payment', payment_status: 'pending', created_at: now }],
    });
    const lab = staffToken('s-lab');
    assert.equal((await env.call('PUT', '/api/print-orders/po-unpaid/status', { token: lab, body: { status: 'printing' } })).status, 409);
    assert.equal((await env.call('PUT', '/api/pcb-orders/pcb-unpaid', { token: lab, body: { status: 'processing' } })).status, 409);
    assert.equal((await env.call('PUT', '/api/pcb-orders/pcb-unpaid', { token: lab, body: { paymentStatus: 'paid' } })).status, 409);
    assert.equal((await env.call('PUT', '/api/pcb-orders/pcb-unpaid', { token: lab, body: { status: 'rejected', rejectionReason: 'Bad files' } })).status, 200, 'rejecting is allowed');
  });

  test('Microsoft/Google sign-in is not throttled by the strict password limit (campus NAT)', async () => {
    const env = await setup({}, { authRateLimitPerMinute: 3 }, { rateLimit: true });
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${env.base}/api/auth/microsoft/start`, { redirect: 'manual' });
      assert.equal(res.status, 303, `sign-in start ${i + 1}`);
    }
    const attempt = () => env.call('POST', '/api/auth/staff-login', { body: { email: 'x@reva.edu.in', password: 'whatever-1' } });
    for (let i = 0; i < 3; i++) assert.equal((await attempt()).status, 401);
    assert.equal((await attempt()).status, 429, 'password form is still limited');
  });
});

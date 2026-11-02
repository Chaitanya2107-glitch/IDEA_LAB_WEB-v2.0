import { Router, type Request } from 'express';
import type { Document, Filter } from 'mongodb';
import { LOGIN_EVENTS, collection, toApi, type Doc } from '../db.js';
import type { Deps } from '../deps.js';
import type { Guards } from '../lib/auth.js';
import { badRequest, oneOf, optNumber, optString } from '../lib/http.js';
import { ACCESS } from '../lib/roles.js';

// Read-only views of the sign-in audit log: counts for the dashboard, a searchable list,
// and a CSV export as proof of who used the portal and when.

const TIME_ZONE = 'Asia/Kolkata';
const DAY_MS = 24 * 60 * 60 * 1000;

// "YYYY-MM-DD" as the start of that day in India.
function istDay(value: unknown, field: string): Date | undefined {
  const str = optString(value, field, 10);
  if (!str) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) throw badRequest(`${field} must be a date (YYYY-MM-DD)`);
  const date = new Date(`${str}T00:00:00+05:30`);
  if (Number.isNaN(date.getTime())) throw badRequest(`${field} must be a date (YYYY-MM-DD)`);
  return date;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function eventFilter(req: Request): Filter<Doc> {
  const q = req.query;
  const filter: Filter<Doc> = {};
  const kind = oneOf(q.kind, 'kind', ['student', 'staff'] as const);
  const outcome = oneOf(q.outcome, 'outcome', ['success', 'failure'] as const);
  const method = oneOf(q.method, 'method', ['microsoft', 'google', 'password', 'email'] as const);
  if (kind) filter.account_kind = kind;
  if (outcome) filter.outcome = outcome;
  if (method) filter.method = method;
  const email = optString(q.email, 'email', 254);
  if (email) filter.email = { $regex: `^${escapeRegex(email.toLowerCase())}` };
  const from = istDay(q.from, 'from');
  const to = istDay(q.to, 'to');
  if (from || to) {
    filter.at = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lt: new Date(to.getTime() + DAY_MS) } : {}),
    };
  }
  return filter;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  // Stop spreadsheet apps from treating a cell as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const CSV_COLUMNS: Array<[string, (e: Doc) => unknown]> = [
  ['time_utc', (e) => e.at],
  ['account_kind', (e) => e.account_kind],
  ['method', (e) => e.method],
  ['outcome', (e) => e.outcome],
  ['reason', (e) => e.reason],
  ['email', (e) => e.email],
  ['name', (e) => e.name],
  ['role', (e) => e.role],
  ['account_id', (e) => e.account_id],
  ['ip', (e) => e.ip],
  ['user_agent', (e) => e.user_agent],
  ['microsoft_oid', (e) => e.microsoft?.oid],
  ['microsoft_tenant', (e) => e.microsoft?.tid],
  ['id_token_issued_at', (e) => e.microsoft?.id_token_issued_at ?? e.google?.id_token_issued_at],
  ['id_token_sha256', (e) => e.microsoft?.id_token_sha256 ?? e.google?.id_token_sha256],
  ['event_id', (e) => e._id],
  ['google_sub', (e) => e.google?.sub],
  ['google_email_verified', (e) => e.google?.email_verified],
  ['google_hosted_domain', (e) => e.google?.hosted_domain],
];

// Newest-first merge of several already-sorted cursors (one per log database).
async function* mergeByTime(cursors: AsyncIterator<Doc>[]): AsyncGenerator<Doc> {
  const heads = await Promise.all(cursors.map((c) => c.next()));
  for (;;) {
    let best = -1;
    heads.forEach((h, i) => {
      if (!h.done && (best < 0 || h.value.at > (heads[best].value as Doc).at)) best = i;
    });
    if (best < 0) return;
    yield heads[best].value as Doc;
    heads[best] = await cursors[best].next();
  }
}

export function signInRoutes(deps: Deps, guards: Guards): Router {
  const router = Router();
  // Microsoft and emergency-password sign-ins, Google sign-ins and email + password
  // sign-ins live in separate databases; these views combine them. One person can use
  // several methods, so unique people are counted across all logs together.
  const microsoftLog = deps.audit.collection<Doc>(LOGIN_EVENTS);
  const googleLog = deps.googleAudit.collection<Doc>(LOGIN_EVENTS);
  const emailLog = deps.passwordAudit.collection<Doc>(LOGIN_EVENTS);
  const LOG_FOR_METHOD = { microsoft: microsoftLog, password: microsoftLog, google: googleLog, email: emailLog };
  const logsFor = (filter: Filter<Doc>) =>
    filter.method ? [LOG_FOR_METHOD[filter.method as keyof typeof LOG_FOR_METHOD]] : [microsoftLog, googleLog, emailLog];
  const canView = guards.requireStaff(...ACCESS.signInAudit);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  const uniquePeople = async (match: Filter<Doc>) => {
    const ids = await Promise.all(logsFor({}).map((events) => events.distinct('account_id', match)));
    return new Set(ids.flat().filter((id) => id !== null)).size;
  };
  const countAll = async (filter: Filter<Doc>) => sum(await Promise.all(logsFor({}).map((events) => events.countDocuments(filter))));

  /* GET /api/admin/sign-ins/summary?days=30 */
  router.get('/admin/sign-ins/summary', canView, async (req, res) => {
    const days = optNumber(req.query.days, 'days', { min: 1, max: 366, integer: true }) ?? 30;
    const ok = { outcome: 'success' };
    const now = Date.now();
    const todayStart = istDay(new Date(now + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10), 'today')!;
    const since = new Date(todayStart.getTime() - (days - 1) * DAY_MS);

    const successFor = (kind: string): Document => ({
      $cond: [{ $and: [{ $eq: ['$outcome', 'success'] }, { $eq: ['$account_kind', kind] }] }, '$account_id', '$$REMOVE'],
    });

    const [
      totalSignIns,
      failedSignIns,
      uniqueStudents,
      uniqueStaff,
      todaySignIns,
      todayPeople,
      registeredStudents,
      registeredStaff,
      dailyPerLog,
      byMethod,
    ] = await Promise.all([
      countAll(ok),
      countAll({ outcome: 'failure' }),
      uniquePeople({ ...ok, account_kind: 'student' }),
      uniquePeople({ ...ok, account_kind: 'staff' }),
      countAll({ ...ok, at: { $gte: todayStart } }),
      uniquePeople({ ...ok, at: { $gte: todayStart } }),
      collection(deps.db, 'users').countDocuments(),
      collection(deps.db, 'staff').countDocuments(),
      Promise.all(logsFor({}).map((events) => events
        .aggregate<{ date: string; sign_ins: number; failures: number; students: string[]; staff: string[] }>([
          { $match: { at: { $gte: since } } },
          {
            $group: {
              _id: { $dateToString: { date: '$at', format: '%Y-%m-%d', timezone: TIME_ZONE } },
              sign_ins: { $sum: { $cond: [{ $eq: ['$outcome', 'success'] }, 1, 0] } },
              failures: { $sum: { $cond: [{ $eq: ['$outcome', 'failure'] }, 1, 0] } },
              students: { $addToSet: successFor('student') },
              staff: { $addToSet: successFor('staff') },
            },
          },
          { $project: { _id: 0, date: '$_id', sign_ins: 1, failures: 1, students: 1, staff: 1 } },
          { $sort: { date: -1 } },
        ])
        .toArray())),
      Promise.all(
        (['microsoft', 'google', 'password', 'email'] as const).map(async (method) => [
          method,
          await LOG_FOR_METHOD[method].countDocuments({ ...ok, method }),
        ]),
      ),
    ]);

    const byDate = new Map<string, { date: string; sign_ins: number; failures: number; students: Set<string>; staff: Set<string> }>();
    for (const row of dailyPerLog.flat()) {
      const d = byDate.get(row.date) ?? { date: row.date, sign_ins: 0, failures: 0, students: new Set(), staff: new Set() };
      d.sign_ins += row.sign_ins;
      d.failures += row.failures;
      row.students.forEach((id) => d.students.add(id));
      row.staff.forEach((id) => d.staff.add(id));
      byDate.set(row.date, d);
    }
    const daily = [...byDate.values()]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map(({ students, staff, ...d }) => ({ ...d, unique_students: students.size, unique_staff: staff.size }));

    res.json({
      time_zone: TIME_ZONE,
      totals: {
        sign_ins: totalSignIns,
        failed_attempts: failedSignIns,
        unique_students: uniqueStudents,
        unique_staff: uniqueStaff,
        registered_students: registeredStudents,
        registered_staff: registeredStaff,
        sign_ins_by_method: Object.fromEntries(byMethod),
      },
      today: { sign_ins: todaySignIns, unique_people: todayPeople },
      days,
      daily,
    });
  });

  /* GET /api/admin/sign-ins?kind&outcome&method&email&from&to&page&limit */
  router.get('/admin/sign-ins', canView, async (req, res) => {
    const filter = eventFilter(req);
    const limit = optNumber(req.query.limit, 'limit', { min: 1, max: 200, integer: true }) ?? 50;
    const page = optNumber(req.query.page, 'page', { min: 1, max: 100_000, integer: true }) ?? 1;
    const logs = logsFor(filter);
    const [counts, lists] = await Promise.all([
      Promise.all(logs.map((events) => events.countDocuments(filter))),
      // Take enough from each log to fill this page, then merge by time.
      Promise.all(logs.map((events) => events.find(filter).sort({ at: -1 }).limit(page * limit).toArray())),
    ]);
    const rows = lists
      .flat()
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice((page - 1) * limit, page * limit);
    res.json({ total: sum(counts), page, limit, events: rows.map((r) => toApi(r)) });
  });

  /* GET /api/admin/sign-ins/export — CSV of the filtered log */
  router.get('/admin/sign-ins/export', canView, async (req, res) => {
    const filter = eventFilter(req);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="idealab-sign-ins-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.write(`${CSV_COLUMNS.map(([name]) => name).join(',')}\n`);
    const cursors = logsFor(filter).map((events) => events.find(filter).sort({ at: -1 })[Symbol.asyncIterator]());
    for await (const event of mergeByTime(cursors)) {
      if (!res.write(`${CSV_COLUMNS.map(([, get]) => csvCell(get(event))).join(',')}\n`)) {
        await new Promise((resolve) => res.once('drain', resolve));
      }
    }
    res.end();
  });

  return router;
}

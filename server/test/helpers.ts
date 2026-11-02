import { createHmac, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { MongoClient, type Db } from 'mongodb';
import { createApp } from '../app.js';
import type { Config } from '../config.js';
import { ensureAuditIndexes, ensureIndexes, newId, type Doc } from '../db.js';
import type { Deps } from '../deps.js';
import { HttpError } from '../lib/http.js';
import type { Mail } from '../lib/mailer.js';
import { createGoogleClient } from '../lib/google.js';
import { createMicrosoftClient } from '../lib/microsoft.js';
import type { GatewayOrder } from '../lib/razorpay.js';
import { signSession } from '../lib/session.js';
import { createFileStore, type FileStore } from '../lib/storage.js';

// Tests run against a real MongoDB (docker run -p 27017:27017 mongo:7, or the CI service).
export const MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017';

export const config: Config = {
  isProd: false,
  port: 0,
  host: '127.0.0.1',
  publicUrl: 'https://idealab.test',
  tenantId: 'reva-idea-lab',
  universityEmailDomain: 'reva.edu.in',
  jwtSecret: 'test-secret-that-is-long-enough-1234567890',
  jwtExpiresIn: '1h',
  mongodbUri: MONGO_URI,
  mongodbDb: 'unused',
  mongodbAuditDb: 'unused',
  microsoft: { authority: 'https://login.microsoftonline.com' },
  mongodbGoogleAuditDb: 'unused',
  mongodbPasswordAuditDb: 'unused',
  google: {},
  storageDir: 'unused',
  email: {},
  corsOrigins: [],
  trustProxy: false,
  rateLimitPerMinute: 1000,
  authRateLimitPerMinute: 1000,
  passwordRateLimitPerMinute: 1000,
  serveStatic: false,
  staticDir: 'dist',
  razorpay: { keyId: 'rzp_test_key', keySecret: 'rz-secret', webhookSecret: 'wh-secret', apiBase: 'http://127.0.0.1:9' },
};

type Seed = Record<string, Array<Record<string, any>>>;

const cleanups: Array<() => Promise<void>> = [];
export async function cleanup() {
  while (cleanups.length) await cleanups.pop()!();
}

// Seed documents may use `id` (as the API returns) or `_id`.
function toDoc(row: Record<string, any>): Doc {
  const { id, _id, ...rest } = row;
  return { _id: String(_id ?? id ?? newId()), ...rest };
}

export interface TestEnv {
  db: Db;
  audit: Db;
  googleAudit: Db;
  passwordAudit: Db;
  files: FileStore;
  base: string;
  sent: Mail[];
  gatewayOrders: Map<string, GatewayOrder>;
  call: (
    method: string,
    path: string,
    opts?: { token?: string; body?: unknown; raw?: string | Buffer; headers?: Record<string, string> },
  ) => Promise<{ status: number; body: any; headers: Headers }>;
}

export async function setup(
  seed: Seed = {},
  overrides: Partial<Config> = {},
  options: { rateLimit?: boolean; paymentsConfigured?: boolean } = {},
): Promise<TestEnv> {
  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const dbName = `test_${randomBytes(6).toString('hex')}`;
  const db = client.db(dbName);
  const audit = client.db(`${dbName}_audit`);
  const googleAudit = client.db(`${dbName}_audit_google`);
  const passwordAudit = client.db(`${dbName}_audit_password`);
  await Promise.all([ensureIndexes(db), ensureAuditIndexes(audit), ensureAuditIndexes(googleAudit), ensureAuditIndexes(passwordAudit)]);
  for (const [name, rows] of Object.entries(seed)) {
    if (rows.length) await db.collection<Doc>(name).insertMany(rows.map(toDoc));
  }

  const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idealab-files-'));
  const files = createFileStore(storageDir);
  const sent: Mail[] = [];
  const gatewayOrders = new Map<string, GatewayOrder>();
  const cfg = { ...config, storageDir, ...overrides };

  const deps: Deps = {
    config: cfg,
    db,
    audit,
    googleAudit,
    passwordAudit,
    files,
    microsoft: createMicrosoftClient(cfg),
    google: createGoogleClient(cfg),
    mailer: {
      configured: true,
      async send(mail) {
        sent.push(mail);
      },
    },
    payments: {
      configured: options.paymentsConfigured ?? true,
      keyId: 'rzp_test_key',
      async createOrder({ amount, notes }) {
        const order = { id: `order_${gatewayOrders.size + 1}`, amount, currency: 'INR', status: 'created', notes };
        gatewayOrders.set(order.id, order);
        return order;
      },
      async fetchOrder(id) {
        const order = gatewayOrders.get(id);
        if (!order) throw new HttpError(502, 'Payment provider request failed');
        return order;
      },
      verifyPaymentSignature(orderId, paymentId, signature) {
        return createHmac('sha256', 'rz-secret').update(`${orderId}|${paymentId}`).digest('hex') === signature;
      },
      verifyWebhookSignature(raw, signature) {
        return createHmac('sha256', 'wh-secret').update(raw).digest('hex') === signature;
      },
    },
  };

  const server = createApp(deps, { rateLimit: options.rateLimit ?? false }).listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  cleanups.push(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.dropDatabase().catch(() => {});
    await audit.dropDatabase().catch(() => {});
    await googleAudit.dropDatabase().catch(() => {});
    await passwordAudit.dropDatabase().catch(() => {});
    await client.close();
    fs.rmSync(storageDir, { recursive: true, force: true });
  });

  async function call(
    method: string,
    urlPath: string,
    opts: { token?: string; body?: unknown; raw?: string | Buffer; headers?: Record<string, string> } = {},
  ) {
    const headers: Record<string, string> = { ...opts.headers };
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    let payload: string | Buffer | undefined = opts.raw;
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(opts.body);
    }
    const res = await fetch(base + urlPath, { method, headers, body: payload as any });
    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = text;
    }
    return { status: res.status, body: json, headers: res.headers };
  }

  return { db, audit, googleAudit, passwordAudit, files, base, sent, gatewayOrders, call };
}

export const staffToken = (id: string, tokenVersion = 0) =>
  signSession(config, { sub: id, kind: 'staff', email: `${id}@reva.edu.in`, tokenVersion });
export const userToken = (id: string, tokenVersion = 0) =>
  signSession(config, { sub: id, kind: 'user', email: `${id}@reva.edu.in`, tokenVersion });

// Emails are sent in the background; wait until `count` have gone to an address.
export async function waitForMail(sent: Mail[], to: string, count = 1, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (sent.filter((m) => m.to === to).length < count) {
    if (Date.now() > deadline) throw new Error(`expected ${count} email(s) to ${to}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

// Pulls the one-time token out of the link in the last email sent to an address.
export function linkToken(sent: Mail[], to: string): string {
  const mail = [...sent].reverse().find((m) => m.to === to);
  if (!mail) throw new Error(`no email sent to ${to}`);
  const match = /token=([A-Za-z0-9_-]+)/.exec(mail.text);
  if (!match) throw new Error('no token in email');
  return match[1];
}

// Tetrahedron with legs of `a` mm: volume a^3 / 6.
export function tetraStl(a: number, ascii = false): Buffer {
  const v = [
    [0, 0, 0],
    [a, 0, 0],
    [0, a, 0],
    [0, 0, a],
  ];
  const faces = [
    [0, 2, 1],
    [0, 1, 3],
    [0, 3, 2],
    [1, 2, 3],
  ];
  if (ascii) {
    const body = faces
      .map((f) => `facet normal 0 0 0\nouter loop\n${f.map((i) => `vertex ${v[i].join(' ')}`).join('\n')}\nendloop\nendfacet`)
      .join('\n');
    return Buffer.from(`solid t\n${body}\nendsolid t\n`);
  }
  const buf = Buffer.alloc(84 + faces.length * 50);
  buf.writeUInt32LE(faces.length, 80);
  faces.forEach((f, t) => {
    f.forEach((idx, k) => v[idx].forEach((c, axis) => buf.writeFloatLE(c, 84 + t * 50 + 12 + (k * 3 + axis) * 4)));
  });
  return buf;
}

export const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

// A date n days from today in India (bookings are allowed up to 60 days ahead).
export const daysFromNow = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

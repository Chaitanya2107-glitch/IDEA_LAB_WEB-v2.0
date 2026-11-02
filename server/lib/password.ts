import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import type { Collection } from 'mongodb';
import type { Doc } from '../db.js';
import { HttpError, badRequest } from './http.js';

// Passwords are hashed with scrypt (built into Node, memory-hard) and stored as
// "scrypt$N$r$p$salt$hash" so parameters can be raised later without breaking old hashes.

const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { ...opts, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const parts = (stored ?? '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    // Burn comparable time so unknown accounts are not distinguishable by timing.
    await derive(password, randomBytes(16), PARAMS);
    return false;
  }
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, 'base64');
  const actual = await derive(password, Buffer.from(salt, 'base64'), { N: Number(n), r: Number(r), p: Number(p) });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const COMMON = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwertyuiop',
  'iloveyou',
  'admin123',
  'welcome1',
  'reva1234',
  'idealab123',
]);

// Minimum rules: 8-128 characters, not a well-known password, not the email itself.
export function assertStrongPassword(password: unknown, email?: string): string {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw badRequest('Password must be between 8 and 128 characters');
  }
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password) || (email && lower === email.toLowerCase())) {
    throw badRequest('This password is too easy to guess. Please choose another one.');
  }
  return password;
}

const LOCK_AFTER_FAILURES = 10;
const LOCK_MINUTES = 15;

// Checks a password against an account (or null, for an unknown email) with a lockout
// after 10 wrong attempts. Unknown accounts take the same time and get the same answer.
export async function checkPasswordWithLockout(accounts: Collection<Doc>, doc: Doc | null, password: string): Promise<Doc> {
  if (doc?.locked_until && new Date(doc.locked_until) > new Date()) {
    const minutes = Math.ceil((new Date(doc.locked_until).getTime() - Date.now()) / 60_000);
    throw new HttpError(429, `Too many failed sign-in attempts. Try again in ${minutes} minute(s) or reset your password.`);
  }
  const ok = await verifyPassword(password, doc?.password_hash);
  if (!doc || !ok) {
    if (doc) {
      const after = await accounts.findOneAndUpdate({ _id: doc._id }, { $inc: { failed_logins: 1 } }, { returnDocument: 'after' });
      if ((after?.failed_logins ?? 0) >= LOCK_AFTER_FAILURES) {
        await accounts.updateOne(
          { _id: doc._id },
          { $set: { failed_logins: 0, locked_until: new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() } },
        );
      }
    }
    throw new HttpError(401, 'Invalid email or password');
  }
  if (doc.failed_logins || doc.locked_until) {
    await accounts.updateOne({ _id: doc._id }, { $set: { failed_logins: 0, locked_until: null } });
  }
  return doc;
}

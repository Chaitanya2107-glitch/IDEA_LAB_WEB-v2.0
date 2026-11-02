import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const notFound = (message = 'Not found') => new HttpError(404, message);
export const forbidden = (message = 'Access denied: insufficient permissions') =>
  new HttpError(403, message);

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;

  // Malformed JSON and oversized bodies come from express.json().
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }

  if (err instanceof HttpError) {
    if (err.status >= 500) console.error(`[api] ${req.method} ${req.path}:`, err);
    return res.status(err.status).json({ error: err.message });
  }

  // MongoDB unique index violation. Details (index/field names) stay in the log.
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'A record with these details already exists' });
  }

  // Database errors and bugs: log the details, never send them to the client.
  console.error(`[api] ${req.method} ${req.path} unhandled error:`, err);
  return res.status(500).json({ error: 'Internal server error' });
}

/* ------------------------------------------------------------------ */
/* Input validation helpers                                            */
/* ------------------------------------------------------------------ */

export function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function body(req: Request): Record<string, any> {
  if (!isPlainObject(req.body)) throw badRequest('Request body must be a JSON object');
  return req.body;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function idParam(value: unknown, name = 'id'): string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw badRequest(`Invalid ${name}`);
  }
  return value;
}

export function optString(value: unknown, field: string, max = 500): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw badRequest(`${field} must be a string`);
  }
  const str = String(value).trim();
  if (str.length > max) throw badRequest(`${field} must be at most ${max} characters`);
  return str;
}

export function reqString(value: unknown, field: string, max = 500): string {
  const str = optString(value, field, max);
  if (!str) throw badRequest(`${field} is required`);
  return str;
}

export function optNumber(
  value: unknown,
  field: string,
  { min = 0, max = 1e9, integer = false }: { min?: number; max?: number; integer?: boolean } = {},
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < min || num > max || (integer && !Number.isInteger(num))) {
    throw badRequest(`${field} must be ${integer ? 'an integer' : 'a number'} between ${min} and ${max}`);
  }
  return num;
}

export function optBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw badRequest(`${field} must be true or false`);
  return value;
}

// An https URL, or a file uploaded to this server (/files/projects/...).
export function optUrl(value: unknown, field: string): string | null | undefined {
  const str = optString(value, field, 2048);
  if (!str) return str;
  if (!/^https:\/\//i.test(str) && !/^\/files\/projects\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(str)) {
    throw badRequest(`${field} must be an https URL or an uploaded file`);
  }
  if (str.includes('..')) throw badRequest(`${field} is not a valid file path`);
  return str;
}

export function optDate(value: unknown, field: string): string | null | undefined {
  const str = optString(value, field, 40);
  if (!str) return str;
  if (!/^\d{4}-\d{2}-\d{2}/.test(str) || Number.isNaN(Date.parse(str))) {
    throw badRequest(`${field} must be a date (YYYY-MM-DD)`);
  }
  return str;
}

export function optTime(value: unknown, field: string): string | null | undefined {
  const str = optString(value, field, 8);
  if (!str) return str;
  if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(str)) throw badRequest(`${field} must be HH:MM`);
  return str;
}

export function oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw badRequest(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Drops undefined values so partial updates only touch the fields that were sent.
export function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Guards stored JSON against NoSQL injection: no "$operator" or dotted keys at any
// depth (they could turn stored data into query/update operators), and bounded nesting.
export function assertSafeValue(value: unknown, field = 'value', depth = 0): void {
  if (depth > 12) throw badRequest(`${field} is nested too deeply`);
  if (Array.isArray(value)) {
    if (value.length > 1000) throw badRequest(`${field} has too many items`);
    value.forEach((v) => assertSafeValue(v, field, depth + 1));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.') || key.length > 100 || RESERVED_KEYS.has(key)) {
        throw badRequest(`Invalid key in ${field}: ${key.slice(0, 40)}`);
      }
      assertSafeValue(v, field, depth + 1);
    }
  }
}

// For collections whose fields are managed from the dashboard by trusted staff: forward
// fields except the ones clients must never set, with safe names and values.
export function stripProtected(
  input: Record<string, any>,
  protectedKeys: readonly string[],
): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(input)) {
    if (protectedKeys.includes(key) || key === '_id') continue;
    if (!FIELD_NAME.test(key) || RESERVED_KEYS.has(key)) throw badRequest(`Invalid field name: ${key}`);
    assertSafeValue(value, key);
    out[key] = value;
  }
  return out;
}

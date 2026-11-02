import type { Request } from 'express';
import type { Db } from 'mongodb';
import { LOGIN_EVENTS, newId, type Doc } from '../db.js';
import type { GoogleIdentity } from './google.js';
import type { MicrosoftIdentity } from './microsoft.js';

// One document per sign-in attempt (successful or not) in the separate audit database.
// Written before the session is handed out, so every session has a matching record.

export type AccountKind = 'student' | 'staff';

export interface LoginEventInput {
  accountKind: AccountKind;
  // password = emergency administrator; email = student-portal email + password account.
  method: 'microsoft' | 'password' | 'google' | 'email';
  outcome: 'success' | 'failure';
  reason?: string; // why it failed
  account?: Doc | null;
  email?: string | null;
  role?: string | null;
  microsoft?: MicrosoftIdentity | null;
  google?: GoogleIdentity | null;
}

export async function recordLogin(audit: Db, req: Request, input: LoginEventInput): Promise<void> {
  const account = input.account ?? null;
  await audit.collection<Doc>(LOGIN_EVENTS).insertOne({
    _id: newId(),
    at: new Date(),
    account_kind: input.accountKind,
    method: input.method,
    outcome: input.outcome,
    reason: input.reason ?? null,
    account_id: account?._id ?? null,
    email: (input.email ?? account?.email ?? null)?.slice(0, 254) ?? null,
    name: account?.name ?? input.microsoft?.name ?? input.google?.name ?? null,
    role: input.role ?? account?.role ?? null,
    ip: req.ip ?? null,
    user_agent: String(req.headers['user-agent'] ?? '').slice(0, 300) || null,
    microsoft: input.microsoft
      ? {
          oid: input.microsoft.oid,
          tid: input.microsoft.tid,
          id_token_issued_at: input.microsoft.issuedAt ? new Date(input.microsoft.issuedAt * 1000) : null,
          id_token_sha256: input.microsoft.idTokenSha256,
        }
      : null,
    ...(input.google
      ? {
          google: {
            sub: input.google.sub,
            email_verified: input.google.emailVerified,
            hosted_domain: input.google.hostedDomain,
            id_token_issued_at: input.google.issuedAt ? new Date(input.google.issuedAt * 1000) : null,
            id_token_sha256: input.google.idTokenSha256,
          },
        }
      : {}),
  });
}

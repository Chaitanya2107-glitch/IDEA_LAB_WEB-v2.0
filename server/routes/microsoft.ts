import { createHash, timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { collection, newId, nowIso, type Doc } from '../db.js';
import type { Deps } from '../deps.js';
import { recordLogin, type AccountKind } from '../lib/audit.js';
import { EMAIL_PATTERN, badRequest, body } from '../lib/http.js';
import { MicrosoftSignInError, pkceChallenge, randomToken, type MicrosoftIdentity } from '../lib/microsoft.js';
import { publicStaff, publicUser } from '../lib/serialize.js';
import { signSession } from '../lib/session.js';

// "Sign in with Microsoft" for students (/login) and staff (/staff-login).
//
//  1. GET  /api/auth/microsoft/start?portal=student|staff  -> redirect to Microsoft
//  2. GET  /api/auth/microsoft/callback                    <- Microsoft sends the person back
//     Checks the ID token, only allows @reva.edu.in accounts from REVA's tenant, records
//     the attempt in the audit database, then redirects to /auth/complete#code=...
//  3. POST /api/auth/microsoft/complete { code }           -> session token (code is single use)

const STATE_TTL_MS = 10 * 60 * 1000;
const LOGIN_CODE_TTL_MS = 2 * 60 * 1000;
const STATE_COOKIE = 'ms_signin';
const COOKIE_PATH = '/api/auth/microsoft';

type Portal = AccountKind;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function sameSecret(a: string, b: string): boolean {
  const x = createHash('sha256').update(a).digest();
  const y = createHash('sha256').update(b).digest();
  return timingSafeEqual(x, y);
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

// Only same-site paths, so the sign-in flow cannot be used as an open redirect.
export function safeNext(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 200) return null;
  return /^\/(?!\/)[A-Za-z0-9\-._~/?=&%]*$/.test(value) ? value : null;
}

export function microsoftRoutes(deps: Deps): Router {
  const router = Router();
  const { db, audit, config, microsoft } = deps;
  const users = collection(db, 'users');
  const staff = collection(db, 'staff');
  const states = collection(db, 'oauth_states');
  const tokens = collection(db, 'auth_tokens');

  const redirectUri = `${config.publicUrl}/api/auth/microsoft/callback`;
  const secureCookie = config.publicUrl.startsWith('https://');
  const cookieOptions = { httpOnly: true, secure: secureCookie, sameSite: 'lax' as const, path: COOKIE_PATH };
  const domain = config.universityEmailDomain;

  const loginPage = (portal: Portal) => `${config.publicUrl}${portal === 'staff' ? '/staff-login' : '/login'}`;
  const fail = (res: Response, portal: Portal, error: string) => res.redirect(303, `${loginPage(portal)}?error=${error}`);

  router.get('/auth/microsoft/start', async (req, res) => {
    const portal: Portal = req.query.portal === 'staff' ? 'staff' : 'student';
    if (!microsoft.configured) return fail(res, portal, 'not_configured');

    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken();
    await states.insertOne({
      _id: sha256(state),
      portal,
      nonce,
      verifier,
      next: safeNext(req.query.next),
      expires_at: new Date(Date.now() + STATE_TTL_MS),
      created_at: nowIso(),
    });
    // Ties the sign-in to this browser, so nobody can finish a sign-in they started on
    // someone else's device (login CSRF).
    res.cookie(STATE_COOKIE, state, { ...cookieOptions, maxAge: STATE_TTL_MS });
    res.redirect(
      303,
      microsoft.authorizeUrl({ state, nonce, codeChallenge: pkceChallenge(verifier), redirectUri, domainHint: domain }),
    );
  });

  router.get('/auth/microsoft/callback', async (req, res) => {
    const state = typeof req.query.state === 'string' && req.query.state.length <= 100 ? req.query.state : '';
    const cookieState = readCookie(req, STATE_COOKIE);
    res.clearCookie(STATE_COOKIE, cookieOptions);

    const pending = state ? await states.findOneAndDelete({ _id: sha256(state) }) : null;
    const portal: Portal = pending?.portal === 'staff' ? 'staff' : 'student';
    if (!pending || pending.expires_at <= new Date() || !cookieState || !sameSecret(cookieState, state)) {
      return fail(res, portal, 'expired');
    }

    const record = (outcome: 'success' | 'failure', extra: { reason?: string; account?: Doc; email?: string; identity?: MicrosoftIdentity }) =>
      recordLogin(audit, req, {
        accountKind: portal,
        method: 'microsoft',
        outcome,
        reason: extra.reason,
        account: extra.account,
        email: extra.email ?? extra.identity?.email,
        microsoft: extra.identity,
      });

    if (typeof req.query.error === 'string') {
      const cancelled = req.query.error === 'access_denied';
      await record('failure', { reason: cancelled ? 'cancelled' : `microsoft_${req.query.error.slice(0, 40)}` });
      return fail(res, portal, cancelled ? 'cancelled' : 'failed');
    }
    const code = typeof req.query.code === 'string' && req.query.code.length <= 4096 ? req.query.code : '';
    if (!code) return fail(res, portal, 'failed');

    let identity: MicrosoftIdentity;
    try {
      identity = await microsoft.redeem(code, pending.verifier, redirectUri, pending.nonce);
    } catch (err: any) {
      console.warn('[microsoft] sign-in rejected:', err?.message ?? err);
      await record('failure', { reason: err instanceof MicrosoftSignInError ? err.reason : 'error' });
      return fail(res, portal, err instanceof MicrosoftSignInError && err.reason === 'wrong_tenant' ? 'domain' : 'failed');
    }

    const { email } = identity;
    if (!EMAIL_PATTERN.test(email) || !email.endsWith(`@${domain}`)) {
      await record('failure', { reason: 'domain_not_allowed', identity });
      return fail(res, portal, 'domain');
    }

    let account: Doc;
    const now = nowIso();
    if (portal === 'student') {
      const existing = await users.findOne({ email });
      if (existing?.ms_oid && existing.ms_oid !== identity.oid) {
        await record('failure', { reason: 'account_mismatch', identity, account: existing });
        return fail(res, portal, 'account_mismatch');
      }
      if (existing) {
        account = (await users.findOneAndUpdate(
          { _id: existing._id },
          {
            $set: {
              ms_oid: identity.oid,
              email_verified: true,
              type: 'university',
              last_login_at: now,
              ...(existing.name ? {} : { name: identity.name || email.split('@')[0] }),
            },
            $inc: { login_count: 1 },
          },
          { returnDocument: 'after' },
        ))!;
      } else {
        account = {
          _id: newId(),
          email,
          name: identity.name || email.split('@')[0],
          avatar: null,
          role: 'USER',
          type: 'university',
          tenant_id: config.tenantId,
          is_profile_complete: false,
          email_verified: true,
          ms_oid: identity.oid,
          password_hash: null,
          token_version: 0,
          login_count: 1,
          last_login_at: now,
          created_at: now,
        };
        try {
          await users.insertOne(account);
        } catch (err: any) {
          // Two first sign-ins at the same moment: use the account the other one created.
          if (err?.code !== 11000) throw err;
          account = (await users.findOne({ email }))!;
        }
      }
    } else {
      const member = await staff.findOne({ email });
      if (!member) {
        await record('failure', { reason: 'not_staff', identity });
        return fail(res, portal, 'not_staff');
      }
      if (member.is_verified === false) {
        await record('failure', { reason: 'staff_not_verified', identity, account: member });
        return fail(res, portal, 'staff_disabled');
      }
      if (member.ms_oid && member.ms_oid !== identity.oid) {
        await record('failure', { reason: 'account_mismatch', identity, account: member });
        return fail(res, portal, 'account_mismatch');
      }
      account = (await staff.findOneAndUpdate(
        { _id: member._id },
        { $set: { ms_oid: identity.oid, email_verified: true, last_login_at: now }, $inc: { login_count: 1 } },
        { returnDocument: 'after' },
      ))!;
    }

    await record('success', { identity, account });

    const loginCode = randomToken();
    await tokens.insertOne({
      _id: sha256(loginCode),
      purpose: 'login',
      account: portal === 'staff' ? 'staff' : 'user',
      account_id: account._id,
      next: pending.next ?? null,
      expires_at: new Date(Date.now() + LOGIN_CODE_TTL_MS),
      created_at: now,
    });
    // In the fragment, so it never reaches server or proxy logs.
    res.redirect(303, `${config.publicUrl}/auth/complete#code=${loginCode}`);
  });

  router.post('/auth/microsoft/complete', async (req, res) => {
    const code = body(req).code;
    const invalid = () => badRequest('This sign-in link has expired. Please sign in again.');
    if (typeof code !== 'string' || code.length < 20 || code.length > 100) throw invalid();
    const record = await tokens.findOneAndDelete({ _id: sha256(code), purpose: 'login' });
    if (!record || record.expires_at <= new Date()) throw invalid();

    const kind = record.account === 'staff' ? 'staff' : 'user';
    const doc = await (kind === 'staff' ? staff : users).findOne({ _id: record.account_id });
    if (!doc) throw invalid();
    const token = signSession(config, { sub: doc._id, kind, email: doc.email, tokenVersion: doc.token_version ?? 0 });
    res.json({
      token,
      next: record.next ?? null,
      ...(kind === 'staff' ? { staff: publicStaff(doc) } : { user: publicUser(doc) }),
    });
  });

  return router;
}

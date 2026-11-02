import { createHash } from 'node:crypto';
import { Router, type Response } from 'express';
import { collection, newId, nowIso, type Doc } from '../db.js';
import type { Deps } from '../deps.js';
import { recordLogin } from '../lib/audit.js';
import { GoogleSignInError, type GoogleIdentity } from '../lib/google.js';
import { EMAIL_PATTERN } from '../lib/http.js';
import { pkceChallenge, randomToken } from '../lib/microsoft.js';
import { readCookie, safeNext, sameSecret } from './microsoft.js';

// "Sign in with Google" for visitors outside REVA (student portal only, general access).
//
//  1. GET /api/auth/google/start     -> redirect to Google
//  2. GET /api/auth/google/callback  <- Google sends the person back; the ID token is checked,
//     @reva.edu.in addresses are sent to Microsoft sign-in instead, the attempt is recorded in
//     the separate Google sign-in log, then the browser goes to /auth/complete#code=...
//  3. The one-time code is exchanged at POST /api/auth/microsoft/complete (shared by both
//     providers; it only turns a login code into a session).

const STATE_TTL_MS = 10 * 60 * 1000;
const LOGIN_CODE_TTL_MS = 2 * 60 * 1000;
const STATE_COOKIE = 'google_signin';
const COOKIE_PATH = '/api/auth/google';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function googleRoutes(deps: Deps): Router {
  const router = Router();
  const { db, googleAudit, config, google } = deps;
  const users = collection(db, 'users');
  const states = collection(db, 'oauth_states');
  const tokens = collection(db, 'auth_tokens');

  const redirectUri = `${config.publicUrl}/api/auth/google/callback`;
  const cookieOptions = { httpOnly: true, secure: config.publicUrl.startsWith('https://'), sameSite: 'lax' as const, path: COOKIE_PATH };
  const universityDomain = config.universityEmailDomain;
  const fail = (res: Response, error: string) => res.redirect(303, `${config.publicUrl}/login?error=${error}`);

  router.get('/auth/google/start', async (req, res) => {
    if (!google.configured) return fail(res, 'google_not_configured');
    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken();
    await states.insertOne({
      _id: sha256(state),
      provider: 'google',
      portal: 'student',
      nonce,
      verifier,
      next: safeNext(req.query.next),
      expires_at: new Date(Date.now() + STATE_TTL_MS),
      created_at: nowIso(),
    });
    res.cookie(STATE_COOKIE, state, { ...cookieOptions, maxAge: STATE_TTL_MS });
    res.redirect(303, google.authorizeUrl({ state, nonce, codeChallenge: pkceChallenge(verifier), redirectUri }));
  });

  router.get('/auth/google/callback', async (req, res) => {
    const state = typeof req.query.state === 'string' && req.query.state.length <= 100 ? req.query.state : '';
    const cookieState = readCookie(req, STATE_COOKIE);
    res.clearCookie(STATE_COOKIE, cookieOptions);

    const pending = state ? await states.findOneAndDelete({ _id: sha256(state), provider: 'google' }) : null;
    if (!pending || pending.expires_at <= new Date() || !cookieState || !sameSecret(cookieState, state)) {
      return fail(res, 'expired');
    }

    const record = (outcome: 'success' | 'failure', extra: { reason?: string; account?: Doc; identity?: GoogleIdentity }) =>
      recordLogin(googleAudit, req, {
        accountKind: 'student',
        method: 'google',
        outcome,
        reason: extra.reason,
        account: extra.account,
        email: extra.identity?.email,
        google: extra.identity,
      });

    if (typeof req.query.error === 'string') {
      const cancelled = req.query.error === 'access_denied';
      await record('failure', { reason: cancelled ? 'cancelled' : `google_${req.query.error.slice(0, 40)}` });
      return fail(res, cancelled ? 'cancelled' : 'failed');
    }
    const code = typeof req.query.code === 'string' && req.query.code.length <= 4096 ? req.query.code : '';
    if (!code) return fail(res, 'failed');

    let identity: GoogleIdentity;
    try {
      identity = await google.redeem(code, pending.verifier, redirectUri, pending.nonce);
    } catch (err: any) {
      console.warn('[google] sign-in rejected:', err?.message ?? err);
      await record('failure', { reason: err instanceof GoogleSignInError ? err.reason : 'error' });
      return fail(res, 'failed');
    }

    const { email } = identity;
    if (!identity.emailVerified) {
      await record('failure', { reason: 'email_not_verified', identity });
      return fail(res, 'google_unverified');
    }
    if (!EMAIL_PATTERN.test(email)) {
      await record('failure', { reason: 'invalid_email', identity });
      return fail(res, 'failed');
    }
    // REVA students and staff get university access through Microsoft only.
    if (email.endsWith(`@${universityDomain}`) || identity.hostedDomain === universityDomain) {
      await record('failure', { reason: 'reva_use_microsoft', identity });
      return fail(res, 'use_microsoft');
    }

    const now = nowIso();
    let account: Doc;
    const existing = await users.findOne({ email });
    if (existing?.google_sub && existing.google_sub !== identity.sub) {
      await record('failure', { reason: 'account_mismatch', identity, account: existing });
      return fail(res, 'account_mismatch');
    }
    if (existing) {
      // e.g. an old Gmail account moved from Supabase: keep its data and access level.
      account = (await users.findOneAndUpdate(
        { _id: existing._id },
        {
          $set: {
            google_sub: identity.sub,
            email_verified: true,
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
        // General access: public services only (see README_BACKEND.md).
        type: 'non-university',
        tenant_id: config.tenantId,
        is_profile_complete: false,
        email_verified: true,
        google_sub: identity.sub,
        auth_provider: 'google',
        password_hash: null,
        token_version: 0,
        login_count: 1,
        last_login_at: now,
        created_at: now,
      };
      try {
        await users.insertOne(account);
      } catch (err: any) {
        if (err?.code !== 11000) throw err;
        account = (await users.findOne({ email }))!;
      }
    }

    await record('success', { identity, account });

    const loginCode = randomToken();
    await tokens.insertOne({
      _id: sha256(loginCode),
      purpose: 'login',
      account: 'user',
      account_id: account._id,
      next: pending.next ?? null,
      expires_at: new Date(Date.now() + LOGIN_CODE_TTL_MS),
      created_at: now,
    });
    res.redirect(303, `${config.publicUrl}/auth/complete#code=${loginCode}`);
  });

  return router;
}

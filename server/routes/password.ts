import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { collection, newId, nowIso, type Doc } from '../db.js';
import type { Deps } from '../deps.js';
import { recordLogin } from '../lib/audit.js';
import { HttpError, badRequest, body, reqString } from '../lib/http.js';
import { actionEmail } from '../lib/mailer.js';
import { assertStrongPassword, checkPasswordWithLockout, hashPassword, verifyPassword } from '../lib/password.js';
import { publicUser } from '../lib/serialize.js';
import { signSession } from '../lib/session.js';
import { emailField } from './auth.js';

// Email + password accounts for the student portal, next to Microsoft and Google sign-in.
//
//  1. POST /api/auth/register { name, email, password }
//     Nothing is created yet: a confirmation link is emailed (same answer for every address).
//  2. POST /api/auth/verify-email { token, password }
//     The link only works together with the password chosen in step 1. So someone who
//     signs up with another person's address can't use the link (they never get it), and
//     the owner of the address can't be tricked into activating an account whose password
//     somebody else knows.
//  3. POST /api/auth/login { email, password }
//
// @reva.edu.in addresses get university access (the confirmation link proves the person
// has that mailbox); every other address gets general access, like Google visitors.
// Every sign-in (and wrong password) is written to its own log database.

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
// At most one confirmation email per address per minute.
const RESEND_MS = 60 * 1000;
// Wrong passwords allowed on one confirmation link before it stops working.
const VERIFY_ATTEMPTS = 5;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function passwordRoutes(deps: Deps): Router {
  const router = Router();
  const { db, passwordAudit, config, mailer } = deps;
  const users = collection(db, 'users');
  const tokens = collection(db, 'auth_tokens');
  const universityDomain = config.universityEmailDomain;

  const record = (req: Parameters<typeof recordLogin>[1], outcome: 'success' | 'failure', extra: { reason?: string; account?: Doc; email?: string }) =>
    recordLogin(passwordAudit, req, { accountKind: 'student', method: 'email', outcome, ...extra });

  const signedIn = (user: Doc) => ({
    token: signSession(config, { sub: user._id, kind: 'user', email: user.email, tokenVersion: user.token_version ?? 0 }),
    user: publicUser(user),
  });

  // Fire-and-forget so response time does not reveal whether an account exists.
  const sendLater = (promise: Promise<void>) => promise.catch((err) => console.error('[mail] send failed:', err));

  const sendConfirmation = async (email: string, name: string, passwordHash: string) => {
    const recent = await tokens.findOne({ purpose: 'verify-email', email });
    if (recent && Date.now() - new Date(recent.created_at).getTime() < RESEND_MS) return;
    const token = randomBytes(32).toString('base64url');
    // Only the newest link works.
    await tokens.deleteMany({ purpose: 'verify-email', email });
    await tokens.insertOne({
      _id: sha256(token),
      purpose: 'verify-email',
      email,
      name,
      password_hash: passwordHash,
      attempts: 0,
      expires_at: new Date(Date.now() + VERIFY_TTL_MS),
      created_at: nowIso(),
    });
    await mailer.send(
      actionEmail({
        to: email,
        subject: 'Confirm your REVA IDEA Lab account',
        greeting: `Hi ${name},`,
        body: 'Thanks for signing up. Open the link below and enter the password you chose to finish creating your account. The link is valid for 24 hours.',
        action: 'Confirm my email',
        url: `${config.publicUrl}/verify-email?token=${token}`,
      }),
    );
  };

  const sendAlreadyRegistered = async (user: Doc) => {
    const recent = await tokens.findOne({ purpose: 'already-registered', account_id: user._id });
    if (recent) return;
    await tokens.insertOne({
      _id: newId(),
      purpose: 'already-registered',
      account_id: user._id,
      expires_at: new Date(Date.now() + RESEND_MS),
      created_at: nowIso(),
    });
    await mailer.send(
      actionEmail({
        to: user.email,
        subject: 'You already have a REVA IDEA Lab account',
        greeting: `Hi ${user.name || 'there'},`,
        body: 'Someone tried to sign up with this email address, but it already has an IDEA Lab account with a password. If it was you, sign in, or reset your password if you have forgotten it.',
        action: 'Reset my password',
        url: `${config.publicUrl}/forgot-password`,
      }),
    );
  };

  /* POST /api/auth/register { name, email, password } */
  router.post('/auth/register', async (req, res) => {
    const input = body(req);
    const name = reqString(input.name, 'name', 100).trim();
    if (!name) throw badRequest('name is required');
    const email = emailField(input.email);
    const password = assertStrongPassword(input.password, email);

    // Hashed either way, so the response time does not reveal whether the address is taken.
    const [existing, passwordHash] = await Promise.all([users.findOne({ email }), hashPassword(password)]);
    if (existing?.password_hash) {
      sendLater(sendAlreadyRegistered(existing));
    } else {
      // An account from Microsoft/Google sign-in gets the password added once the owner
      // confirms from their mailbox.
      sendLater(sendConfirmation(email, name, passwordHash));
    }
    res.status(202).json({
      message: `We have sent a confirmation link to ${email}. Open it within 24 hours to finish creating your account.`,
    });
  });

  /* POST /api/auth/verify-email { token, password } — finishes sign-up and signs in */
  router.post('/auth/verify-email', async (req, res) => {
    const input = body(req);
    const token = input.token;
    const invalid = () => badRequest('This confirmation link is invalid or has expired. Please sign up again.');
    if (typeof token !== 'string' || token.length < 20 || token.length > 200) throw invalid();
    if (typeof input.password !== 'string' || !input.password || input.password.length > 128) throw badRequest('password is required');

    const pending = await tokens.findOne({ _id: sha256(token), purpose: 'verify-email' });
    if (!pending || pending.expires_at <= new Date()) throw invalid();

    if (!(await verifyPassword(input.password, pending.password_hash))) {
      const after = await tokens.findOneAndUpdate({ _id: pending._id }, { $inc: { attempts: 1 } }, { returnDocument: 'after' });
      if ((after?.attempts ?? VERIFY_ATTEMPTS) >= VERIFY_ATTEMPTS) await tokens.deleteOne({ _id: pending._id });
      await record(req, 'failure', { reason: 'verify_wrong_password', email: pending.email });
      throw new HttpError(401, 'That is not the password you chose when you signed up.');
    }
    // Single use: a second request with the same link fails.
    if (!(await tokens.findOneAndDelete({ _id: pending._id }))) throw invalid();

    const email: string = pending.email;
    const university = email.endsWith(`@${universityDomain}`);
    const now = nowIso();
    let user: Doc;
    const existing = await users.findOne({ email });
    if (existing) {
      user = (await users.findOneAndUpdate(
        { _id: existing._id },
        {
          $set: {
            password_hash: pending.password_hash,
            email_verified: true,
            failed_logins: 0,
            locked_until: null,
            last_login_at: now,
            ...(university ? { type: 'university' } : {}),
            ...(existing.name ? {} : { name: pending.name }),
          },
          // Replacing an earlier password signs out every other session.
          $inc: { login_count: 1, ...(existing.password_hash ? { token_version: 1 } : {}) },
        },
        { returnDocument: 'after' },
      ))!;
    } else {
      user = {
        _id: newId(),
        email,
        name: pending.name,
        avatar: null,
        role: 'USER',
        // University access for confirmed @reva.edu.in mailboxes, general access otherwise.
        type: university ? 'university' : 'non-university',
        tenant_id: config.tenantId,
        is_profile_complete: false,
        email_verified: true,
        auth_provider: 'password',
        password_hash: pending.password_hash,
        token_version: 0,
        failed_logins: 0,
        login_count: 1,
        last_login_at: now,
        created_at: now,
      };
      try {
        await users.insertOne(user);
      } catch (err: any) {
        // Created a moment ago by a Microsoft/Google first sign-in: add the password to it.
        if (err?.code !== 11000) throw err;
        user = (await users.findOneAndUpdate(
          { email },
          { $set: { password_hash: pending.password_hash, email_verified: true, ...(university ? { type: 'university' } : {}) } },
          { returnDocument: 'after' },
        ))!;
      }
    }

    await record(req, 'success', { account: user, reason: 'sign_up' });
    res.status(201).json(signedIn(user));
  });

  /* POST /api/auth/login { email, password } */
  router.post('/auth/login', async (req, res) => {
    const input = body(req);
    const email = emailField(input.email);
    if (typeof input.password !== 'string' || !input.password || input.password.length > 128) throw badRequest('password is required');

    const found = await users.findOne({ email });
    let user: Doc;
    try {
      user = await checkPasswordWithLockout(users, found?.password_hash ? found : null, input.password);
    } catch (err) {
      const reason = err instanceof HttpError && err.status === 429 ? 'locked' : found?.password_hash ? 'bad_password' : 'no_password_account';
      await record(req, 'failure', { reason, email, account: found?.password_hash ? found : undefined });
      throw err;
    }

    const updated = (await users.findOneAndUpdate(
      { _id: user._id },
      { $set: { last_login_at: nowIso() }, $inc: { login_count: 1 } },
      { returnDocument: 'after' },
    ))!;
    await record(req, 'success', { account: updated });
    res.json(signedIn(updated));
  });

  return router;
}

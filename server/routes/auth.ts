import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { collection, newId, nowIso, type Doc } from '../db.js';
import type { Deps } from '../deps.js';
import { recordLogin } from '../lib/audit.js';
import { isStaff, principalOf, type Guards } from '../lib/auth.js';
import {
  EMAIL_PATTERN,
  HttpError,
  badRequest,
  body,
  compact,
  forbidden,
  oneOf,
  optBoolean,
  optString,
  optUrl,
  reqString,
} from '../lib/http.js';
import { actionEmail } from '../lib/mailer.js';
import { assertStrongPassword, checkPasswordWithLockout, hashPassword, verifyPassword } from '../lib/password.js';
import { ACCESS, STAFF_ROLES, normalizeRole } from '../lib/roles.js';
import { publicStaff, publicUser } from '../lib/serialize.js';
import { signSession, type PrincipalKind } from '../lib/session.js';

const RESET_TTL_MS = 60 * 60 * 1000;
// At most one reset email per account per minute.
const RESET_RESEND_MS = 60 * 1000;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function emailField(value: unknown): string {
  const email = reqString(value, 'email', 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw badRequest('Invalid email address');
  return email;
}

function passwordField(value: unknown, field = 'password'): string {
  if (typeof value !== 'string' || !value || value.length > 128) throw badRequest(`${field} is required`);
  return value;
}

// Staff sign in with their REVA Microsoft account (routes/microsoft.ts). The only staff
// password is the emergency administrator's (created with `create-admin`), so the portal can
// still be managed if Microsoft sign-in is misconfigured or unavailable. Student-portal
// accounts may also have a password (email + password sign-up, routes/password.ts).
const canUsePassword = (doc: Doc | null | undefined): doc is Doc =>
  Boolean(doc && doc.password_hash && normalizeRole(doc.role) === 'ADMIN');

export function authRoutes(deps: Deps, guards: Guards): Router {
  const router = Router();
  const { db, audit, config, mailer } = deps;
  const users = collection(db, 'users');
  const staff = collection(db, 'staff');
  const tokens = collection(db, 'auth_tokens');
  const accounts = (kind: PrincipalKind) => (kind === 'staff' ? staff : users);

  const session = (kind: PrincipalKind, doc: Doc) =>
    signSession(config, { sub: doc._id, kind, email: doc.email, tokenVersion: doc.token_version ?? 0 });

  // Fire-and-forget so response time does not reveal whether an account exists.
  const sendLater = (promise: Promise<void>) => promise.catch((err) => console.error('[mail] send failed:', err));

  const sendReset = async (kind: PrincipalKind, account: Doc) => {
    const recent = await tokens.findOne({ purpose: 'reset-password', account: kind, account_id: account._id });
    if (recent && Date.now() - new Date(recent.created_at).getTime() < RESET_RESEND_MS) return;
    const token = randomBytes(32).toString('base64url');
    // Only the newest link works.
    await tokens.deleteMany({ purpose: 'reset-password', account: kind, account_id: account._id });
    await tokens.insertOne({
      _id: sha256(token),
      purpose: 'reset-password',
      account: kind,
      account_id: account._id,
      expires_at: new Date(Date.now() + RESET_TTL_MS),
      created_at: nowIso(),
    });
    await mailer.send(
      actionEmail({
        to: account.email,
        subject: kind === 'staff' ? 'Reset your REVA IDEA Lab administrator password' : 'Reset your REVA IDEA Lab password',
        greeting: `Hi ${account.name || 'there'},`,
        body:
          kind === 'staff'
            ? 'Someone asked to set a new password for the emergency administrator sign-in. The link is valid for 1 hour.'
            : 'Someone asked to set a new password for your IDEA Lab account. The link is valid for 1 hour.',
        action: 'Set a new password',
        url: `${config.publicUrl}/reset-password?token=${token}`,
      }),
    );
  };

  /* ---------------- emergency administrator password sign-in ---------------- */

  const passwordSignIn = async (email: string, password: string): Promise<Doc> => {
    const found = await staff.findOne({ email });
    return checkPasswordWithLockout(staff, canUsePassword(found) ? found : null, password);
  };

  /* POST /api/auth/staff-login — emergency administrator sign-in */
  router.post('/auth/staff-login', async (req, res) => {
    const input = body(req);
    const email = emailField(input.email);
    const password = passwordField(input.password);
    const fail = (reason: string) => recordLogin(audit, req, { accountKind: 'staff', method: 'password', outcome: 'failure', reason, email });

    let member: Doc;
    try {
      member = await passwordSignIn(email, password);
    } catch (err) {
      await fail(err instanceof HttpError && err.status === 429 ? 'locked' : 'bad_credentials');
      throw err;
    }
    if (member.is_verified === false) {
      await fail('staff_not_verified');
      throw new HttpError(403, 'This administrator account has been disabled.');
    }
    await staff.updateOne({ _id: member._id }, { $set: { last_login_at: nowIso() }, $inc: { login_count: 1 } });
    await recordLogin(audit, req, { accountKind: 'staff', method: 'password', outcome: 'success', account: member });
    res.json({ token: session('staff', member), staff: publicStaff(member) });
  });

  /* POST /api/auth/forgot-password { email } — password accounts only; same answer for any address */
  router.post('/auth/forgot-password', async (req, res) => {
    const email = emailField(body(req).email);
    const [member, user] = await Promise.all([staff.findOne({ email }), users.findOne({ email })]);
    if (canUsePassword(member)) sendLater(sendReset('staff', member));
    if (user?.password_hash) sendLater(sendReset('user', user));
    res.json({ message: 'If an account with a password uses that email, we have sent a link to set a new password.' });
  });

  /* POST /api/auth/reset-password { token, password } */
  router.post('/auth/reset-password', async (req, res) => {
    const input = body(req);
    const token = input.token;
    const invalid = () => badRequest('This password reset link is invalid or has expired.');
    if (typeof token !== 'string' || token.length < 20 || token.length > 200) throw invalid();
    const record = await tokens.findOne({ _id: sha256(token), purpose: 'reset-password' });
    if (!record || record.expires_at <= new Date()) throw invalid();
    const kind: PrincipalKind = record.account === 'staff' ? 'staff' : 'user';
    const doc = await accounts(kind).findOne({ _id: record.account_id });
    if (kind === 'staff' ? !canUsePassword(doc) : !doc?.password_hash) throw invalid();
    const password = assertStrongPassword(input.password, doc!.email);

    // Consume the link atomically; a second use fails.
    if (!(await tokens.findOneAndDelete({ _id: record._id }))) {
      throw badRequest('This password reset link has already been used.');
    }
    // Signs out every existing session.
    await accounts(kind).updateOne(
      { _id: doc!._id },
      { $set: { password_hash: await hashPassword(password), failed_logins: 0, locked_until: null }, $inc: { token_version: 1 } },
    );
    res.json({ message: 'Your password has been updated. You can now sign in.', account: kind });
  });

  /* POST /api/auth/change-password { currentPassword, newPassword } — emergency administrator or password account */
  router.post('/auth/change-password', guards.requireAuth, async (req, res) => {
    const principal = principalOf(req);
    if (principal.kind === 'staff' ? !canUsePassword(principal.record) : !principal.record.password_hash) {
      throw forbidden('This account signs in with Microsoft or Google and has no password here');
    }
    const input = body(req);
    const current = passwordField(input.currentPassword, 'currentPassword');
    if (!(await verifyPassword(current, principal.record.password_hash))) {
      throw new HttpError(401, 'Current password is incorrect');
    }
    const next = assertStrongPassword(input.newPassword, principal.email);
    const updated = await accounts(principal.kind).findOneAndUpdate(
      { _id: principal.id },
      { $set: { password_hash: await hashPassword(next) }, $inc: { token_version: 1 } },
      { returnDocument: 'after' },
    );
    // Other devices are signed out; this one gets a fresh session.
    res.json({ message: 'Password changed', token: session(principal.kind, updated!) });
  });

  /* POST /api/auth/logout-all — sign out on every device */
  router.post('/auth/logout-all', guards.requireAuth, async (req, res) => {
    const principal = principalOf(req);
    await accounts(principal.kind).updateOne({ _id: principal.id }, { $inc: { token_version: 1 } });
    res.json({ message: 'Signed out everywhere' });
  });

  /* POST /api/auth/create-staff — admin / tech support add a staff member (signs in with Microsoft) */
  router.post('/auth/create-staff', guards.requireStaff(...ACCESS.userManagement), async (req, res) => {
    const caller = principalOf(req);
    const input = body(req);
    const name = reqString(input.name, 'name', 100);
    const email = emailField(input.email);
    if (!email.endsWith(`@${config.universityEmailDomain}`)) {
      throw badRequest(`Staff must use their @${config.universityEmailDomain} Microsoft account`);
    }
    const role = oneOf(String(input.role ?? '').toUpperCase(), 'role', STAFF_ROLES)!;
    if (role === 'ADMIN' && caller.role !== 'ADMIN') {
      throw forbidden('Only an administrator can create administrator accounts');
    }

    const member: Doc = {
      _id: newId(),
      name,
      email,
      role,
      tenant_id: config.tenantId,
      // Created by an administrator, so active immediately.
      is_verified: true,
      password_hash: null,
      token_version: 0,
      failed_logins: 0,
      created_at: nowIso(),
      created_by: caller.id,
    };
    try {
      await staff.insertOne(member);
    } catch (err: any) {
      if (err?.code === 11000) throw new HttpError(409, 'A staff member with this email already exists');
      throw err;
    }
    res.status(201).json({ message: 'Staff created successfully', staff: publicStaff(member) });
  });

  /* GET /api/user/me — current session */
  router.get('/user/me', guards.requireAuth, (req, res) => {
    const principal = principalOf(req);
    if (principal.kind === 'staff') return res.json({ staff: publicStaff(principal.record) });
    return res.json({ user: publicUser(principal.record) });
  });

  /* PUT /api/user/profile — student updates their own profile and onboarding answers */
  router.put('/user/profile', guards.requireAuth, async (req, res) => {
    const principal = principalOf(req);
    if (isStaff(principal)) throw forbidden('Staff profiles are updated via /api/staff/profile');
    const input = body(req);
    const updates = compact({
      name: optString(input.name, 'name', 100) ?? undefined,
      avatar: optUrl(input.avatar, 'avatar'),
      is_profile_complete: optBoolean(input.isProfileComplete ?? input.is_profile_complete, 'isProfileComplete'),
      phone: optString(input.phone, 'phone', 20),
      srn: optString(input.srn, 'srn', 32),
      degree: optString(input.degree, 'degree', 100),
      program: optString(input.program, 'program', 100),
      semester: optString(input.semester, 'semester', 20),
    });
    const user = await users.findOneAndUpdate(
      { _id: principal.id },
      { $set: { ...updates, updated_at: nowIso() } },
      { returnDocument: 'after' },
    );
    res.json({ user: publicUser(user!) });
  });

  return router;
}

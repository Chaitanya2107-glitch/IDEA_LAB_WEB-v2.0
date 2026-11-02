import { Router } from 'express';
import { collection, newId, nowIso, toApi, toApiList } from '../db.js';
import type { Deps } from '../deps.js';
import { principalOf, type Guards, type Principal } from '../lib/auth.js';
import {
  badRequest,
  body,
  compact,
  forbidden,
  idParam,
  notFound,
  oneOf,
  optBoolean,
  optNumber,
  optString,
  optUrl,
  reqString,
} from '../lib/http.js';
import { ACCESS, STAFF_ROLES, USER_ROLES, normalizeRole } from '../lib/roles.js';
import { publicStaff, publicUser } from '../lib/serialize.js';

export function adminRoutes(deps: Deps, guards: Guards): Router {
  const router = Router();
  const users = collection(deps.db, 'users');
  const staff = collection(deps.db, 'staff');
  const history = collection(deps.db, 'history_logs');
  const manageUsers = guards.requireStaff(...ACCESS.userManagement);

  /* ---------------- Portal users ---------------- */

  router.get('/users', manageUsers, async (_req, res) => {
    const docs = await users.find({}).sort({ name: 1 }).toArray();
    res.json(docs.map(publicUser));
  });

  router.put('/users/:id', manageUsers, async (req, res) => {
    const id = idParam(req.params.id);
    const input = body(req);
    const role = input.role === undefined ? undefined : oneOf(normalizeRole(input.role), 'role', USER_ROLES);
    const updates = compact({
      role,
      type: oneOf(input.type, 'type', ['university', 'non-university'] as const),
    });
    if (!Object.keys(updates).length) throw badRequest('Nothing to update');
    const doc = await users.findOneAndUpdate({ _id: id }, { $set: updates }, { returnDocument: 'after' });
    if (!doc) throw notFound('User not found');
    res.json(publicUser(doc));
  });

  router.delete('/users/:id', manageUsers, async (req, res) => {
    const { deletedCount } = await users.deleteOne({ _id: idParam(req.params.id) });
    if (!deletedCount) throw notFound('User not found');
    res.json({ message: 'User removed' });
  });

  /* ---------------- Staff ---------------- */

  router.get('/staff', manageUsers, async (_req, res) => {
    const docs = await staff.find({}).sort({ name: 1 }).toArray();
    res.json(docs.map(publicStaff));
  });

  // Registered before /staff/:id so "profile" is not taken as an id.
  router.put('/staff/profile', guards.requireStaff(), async (req, res) => {
    const principal = principalOf(req);
    const input = body(req);
    const updates = compact({
      name: optString(input.name, 'name', 100) ?? undefined,
      avatar: optUrl(input.avatar, 'avatar'),
      employee_id: optString(input.employeeId ?? input.employee_id, 'employeeId', 50),
    });
    const doc = await staff.findOneAndUpdate(
      { _id: principal.id },
      { $set: { ...updates, updated_at: nowIso() } },
      { returnDocument: 'after' },
    );
    res.json(publicStaff(doc!));
  });

  // Non-admins (tech support) may not touch administrator accounts or promote anyone to
  // administrator, and nobody may change their own role, verification or account.
  const loadManagedStaff = async (caller: Principal, id: string) => {
    const target = await staff.findOne({ _id: id });
    if (!target) throw notFound('Staff member not found');
    if (target._id === caller.id) throw forbidden('You cannot change your own staff account here');
    if (normalizeRole(target.role) === 'ADMIN' && caller.role !== 'ADMIN') {
      throw forbidden('Only an administrator can manage administrator accounts');
    }
    return target;
  };

  router.put('/staff/:id/verify', manageUsers, async (req, res) => {
    const caller = principalOf(req);
    const id = idParam(req.params.id);
    const isVerified = optBoolean(body(req).is_verified, 'is_verified');
    if (isVerified === undefined) throw badRequest('is_verified is required');
    await loadManagedStaff(caller, id);
    const doc = await staff.findOneAndUpdate({ _id: id }, { $set: { is_verified: isVerified } }, { returnDocument: 'after' });
    res.json(publicStaff(doc!));
  });

  router.put('/staff/:id', manageUsers, async (req, res) => {
    const caller = principalOf(req);
    const id = idParam(req.params.id);
    const input = body(req);
    await loadManagedStaff(caller, id);

    const role = input.role === undefined ? undefined : oneOf(normalizeRole(input.role), 'role', STAFF_ROLES);
    if (role === 'ADMIN' && caller.role !== 'ADMIN') {
      throw forbidden('Only an administrator can grant the administrator role');
    }
    const updates = compact({
      role,
      name: optString(input.name, 'name', 100) ?? undefined,
      employee_id: optString(input.employeeId ?? input.employee_id, 'employeeId', 50),
      is_verified: optBoolean(input.is_verified, 'is_verified'),
    });
    if (!Object.keys(updates).length) throw badRequest('Nothing to update');
    const doc = await staff.findOneAndUpdate({ _id: id }, { $set: updates }, { returnDocument: 'after' });
    res.json(publicStaff(doc!));
  });

  router.delete('/staff/:id', manageUsers, async (req, res) => {
    const caller = principalOf(req);
    const id = idParam(req.params.id);
    await loadManagedStaff(caller, id);
    await staff.deleteOne({ _id: id });
    res.json({ message: 'Staff removed' });
  });

  /* ---------------- Activity history ---------------- */

  router.get('/history', guards.requireStaff(...ACCESS.history), async (req, res) => {
    const limit = optNumber(req.query.limit, 'limit', { min: 1, max: 500, integer: true }) ?? 100;
    res.json(toApiList(await history.find({}).sort({ timestamp: -1 }).limit(limit).toArray()));
  });

  router.post('/history', guards.requireStaff(), async (req, res) => {
    const actor = principalOf(req);
    const input = body(req);
    const doc = {
      _id: newId(),
      actor_id: actor.id,
      actor_name: actor.name,
      action: reqString(input.action, 'action', 200),
      details: optString(input.details, 'details', 2000) ?? null,
      target_type: optString(input.target_type, 'target_type', 50) ?? null,
      target_id: optString(input.target_id, 'target_id', 128) ?? null,
      target_name: optString(input.target_name, 'target_name', 200) ?? null,
      timestamp: nowIso(),
    };
    await history.insertOne(doc);
    res.status(201).json(toApi(doc));
  });

  return router;
}

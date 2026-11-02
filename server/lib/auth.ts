import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { collection, type Doc } from '../db.js';
import type { Deps } from '../deps.js';
import { HttpError, forbidden } from './http.js';
import { normalizeRole, type StaffRole } from './roles.js';
import { verifySession, type PrincipalKind, type SessionClaims } from './session.js';

// The authenticated caller, always loaded fresh from the database so role changes,
// deletions, password resets and staff de-verification take effect immediately.
export interface Principal {
  kind: PrincipalKind;
  id: string; // users._id or staff._id
  email: string;
  name: string;
  role: string; // upper-case
  tenantId: string;
  record: Doc;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      principal?: Principal | null;
    }
  }
}

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim() || undefined;
}

const sessionEnded = () => new HttpError(401, 'Your session has ended. Please sign in again.');

async function loadPrincipal(deps: Deps, claims: SessionClaims): Promise<Principal> {
  if ((claims.kind !== 'user' && claims.kind !== 'staff') || typeof claims.sub !== 'string') throw sessionEnded();
  const doc = await collection(deps.db, claims.kind === 'staff' ? 'staff' : 'users').findOne({ _id: claims.sub });
  if (!doc) throw sessionEnded();
  if ((doc.token_version ?? 0) !== (claims.tv ?? 0)) throw sessionEnded();
  if (claims.kind === 'staff' && doc.is_verified === false) {
    throw new HttpError(403, 'Account verification revoked');
  }
  return {
    kind: claims.kind,
    id: doc._id,
    email: doc.email,
    name: doc.name ?? '',
    role: normalizeRole(doc.role) || (claims.kind === 'user' ? 'USER' : ''),
    tenantId: doc.tenant_id ?? deps.config.tenantId,
    record: doc,
  };
}

async function resolvePrincipal(deps: Deps, req: Request): Promise<Principal> {
  if (req.principal) return req.principal;
  const token = bearerToken(req);
  if (!token) throw new HttpError(401, 'Authentication required');

  let claims: SessionClaims;
  try {
    claims = verifySession(deps.config, token);
  } catch {
    throw new HttpError(401, 'Invalid or expired session. Please sign in again.');
  }
  req.principal = await loadPrincipal(deps, claims);
  return req.principal;
}

export interface Guards {
  // Any signed-in user or staff member.
  requireAuth: RequestHandler;
  // Staff with one of the given roles. ADMIN is always allowed; no roles = any staff.
  requireStaff: (...roles: readonly StaffRole[]) => RequestHandler;
}

export function createGuards(deps: Deps): Guards {
  const requireAuth: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
    await resolvePrincipal(deps, req);
    next();
  };

  const requireStaff =
    (...roles: readonly StaffRole[]): RequestHandler =>
    async (req, _res, next) => {
      const principal = await resolvePrincipal(deps, req);
      if (!isStaff(principal, ...roles)) throw forbidden();
      next();
    };

  return { requireAuth, requireStaff };
}

export function isStaff(principal: Principal, ...roles: readonly StaffRole[]): boolean {
  return (
    principal.kind === 'staff' &&
    (principal.role === 'ADMIN' || roles.length === 0 || roles.includes(principal.role as StaffRole))
  );
}

// For handlers mounted behind requireAuth/requireStaff.
export function principalOf(req: Request): Principal {
  if (!req.principal) throw new HttpError(401, 'Authentication required');
  return req.principal;
}

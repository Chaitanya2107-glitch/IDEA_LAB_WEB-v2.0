import jwt from 'jsonwebtoken';
import type { Config } from '../config.js';

export type PrincipalKind = 'user' | 'staff';

export interface SessionInput {
  sub: string; // users._id or staff._id
  kind: PrincipalKind;
  email: string;
  // Bumped on password change/reset or "sign out everywhere"; older tokens stop working.
  tokenVersion: number;
}

export interface SessionClaims {
  sub?: string;
  kind?: PrincipalKind;
  email?: string;
  tv?: number;
}

export function signSession(config: Config, input: SessionInput): string {
  return jwt.sign({ kind: input.kind, email: input.email, tv: input.tokenVersion }, config.jwtSecret, {
    algorithm: 'HS256',
    subject: input.sub,
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifySession(config: Config, token: string): SessionClaims {
  const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  if (typeof decoded !== 'object' || decoded === null) throw new Error('Malformed session token');
  return decoded as SessionClaims;
}

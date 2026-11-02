import { createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Config } from '../config.js';
import { HttpError } from './http.js';

// "Sign in with Google" for visitors outside REVA (general access). OpenID Connect
// authorization-code flow with PKCE on the server; the ID token is checked against
// Google's published keys, this app's client id, the issuer and the one-time nonce, and
// the email must be verified by Google.

export interface GoogleIdentity {
  sub: string; // Google's permanent account id
  email: string; // lower-case
  emailVerified: boolean;
  name: string;
  hostedDomain: string | null; // Google Workspace domain, if any
  issuedAt: number | null;
  idTokenSha256: string;
}

export interface GoogleAuthorizeParams {
  state: string;
  nonce: string;
  codeChallenge: string;
  redirectUri: string;
}

export interface GoogleClient {
  configured: boolean;
  authorizeUrl(params: GoogleAuthorizeParams): string;
  redeem(code: string, codeVerifier: string, redirectUri: string, nonce: string): Promise<GoogleIdentity>;
}

export class GoogleSignInError extends Error {
  constructor(
    readonly reason: string,
    message: string,
  ) {
    super(message);
  }
}

// Google's real endpoints, or a local stand-in (scripts/mock-google.ts) for tests.
function endpoints(authority?: string) {
  if (authority) {
    return {
      authorize: `${authority}/o/oauth2/v2/auth`,
      token: `${authority}/token`,
      jwks: `${authority}/oauth2/v3/certs`,
      issuers: [authority],
    };
  }
  return {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    jwks: 'https://www.googleapis.com/oauth2/v3/certs',
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
  };
}

export function createGoogleClient(config: Config): GoogleClient {
  const { clientId, clientSecret, authority } = config.google;
  const configured = Boolean(clientId && clientSecret);
  const ep = endpoints(authority);
  const jwks = configured ? createRemoteJWKSet(new URL(ep.jwks)) : null;
  const notConfigured = () => new HttpError(503, 'Google sign-in is not configured');

  return {
    configured,

    authorizeUrl({ state, nonce, codeChallenge, redirectUri }) {
      if (!configured) throw notConfigured();
      const url = new URL(ep.authorize);
      url.search = new URLSearchParams({
        client_id: clientId!,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: 'openid email profile',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      }).toString();
      return url.toString();
    },

    async redeem(code, codeVerifier, redirectUri, nonce) {
      if (!configured || !jwks) throw notConfigured();
      const res = await fetch(ep.token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json().catch(() => ({}))) as { id_token?: unknown; error?: unknown };
      if (!res.ok || typeof data.id_token !== 'string') {
        throw new GoogleSignInError('token_exchange_failed', `Google token request failed (${res.status} ${String(data.error ?? '')})`);
      }

      let payload: JWTPayload;
      try {
        ({ payload } = await jwtVerify(data.id_token, jwks, {
          issuer: ep.issuers,
          audience: clientId!,
          algorithms: ['RS256'],
          clockTolerance: 60,
          maxTokenAge: '15m',
        }));
      } catch (err: any) {
        throw new GoogleSignInError('invalid_id_token', `Google ID token rejected: ${err?.code ?? err?.message ?? err}`);
      }
      if (payload.nonce !== nonce) throw new GoogleSignInError('invalid_id_token', 'Google ID token nonce mismatch');
      const sub = typeof payload.sub === 'string' ? payload.sub : '';
      const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
      if (!sub || !email) throw new GoogleSignInError('invalid_id_token', 'Google ID token has no account id or email');

      return {
        sub,
        email,
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
        name: typeof payload.name === 'string' ? payload.name.trim().slice(0, 100) : '',
        hostedDomain: typeof payload.hd === 'string' ? payload.hd.toLowerCase() : null,
        issuedAt: typeof payload.iat === 'number' ? payload.iat : null,
        idTokenSha256: createHash('sha256').update(data.id_token).digest('hex'),
      };
    },
  };
}

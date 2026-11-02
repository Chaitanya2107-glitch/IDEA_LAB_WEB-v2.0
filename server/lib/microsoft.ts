import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Config } from '../config.js';
import { HttpError } from './http.js';

// Sign-in with Microsoft Entra ID (REVA's Microsoft 365 accounts): OpenID Connect
// authorization-code flow with PKCE, handled entirely on the server. The ID token is
// checked against Microsoft's published signing keys, REVA's tenant, this app's client id
// and the one-time nonce before anyone is signed in.

export interface MicrosoftIdentity {
  oid: string; // the person's permanent object id in REVA's directory
  tid: string;
  email: string; // lower-case
  name: string;
  issuedAt: number | null; // ID token iat (seconds)
  idTokenSha256: string; // fingerprint of the exact token Microsoft issued, kept as proof
}

export interface AuthorizeParams {
  state: string;
  nonce: string;
  codeChallenge: string;
  redirectUri: string;
  domainHint?: string;
}

export interface MicrosoftClient {
  configured: boolean;
  authorizeUrl(params: AuthorizeParams): string;
  redeem(code: string, codeVerifier: string, redirectUri: string, nonce: string): Promise<MicrosoftIdentity>;
}

export const randomToken = () => randomBytes(32).toString('base64url');
export const pkceChallenge = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

export class MicrosoftSignInError extends Error {
  constructor(
    readonly reason: string,
    message: string,
  ) {
    super(message);
  }
}

export function createMicrosoftClient(config: Config): MicrosoftClient {
  const { tenantId, clientId, clientSecret, authority } = config.microsoft;
  const configured = Boolean(tenantId && clientId && clientSecret);
  const base = `${authority}/${tenantId}`;
  const issuer = `${base}/v2.0`;
  // Keys are fetched once and cached; unknown key ids trigger a (rate-limited) refresh.
  const jwks = configured ? createRemoteJWKSet(new URL(`${base}/discovery/v2.0/keys`)) : null;

  const notConfigured = () => new HttpError(503, 'Microsoft sign-in is not configured');

  return {
    configured,

    authorizeUrl({ state, nonce, codeChallenge, redirectUri, domainHint }) {
      if (!configured) throw notConfigured();
      const url = new URL(`${base}/oauth2/v2.0/authorize`);
      url.search = new URLSearchParams({
        client_id: clientId!,
        response_type: 'code',
        response_mode: 'query',
        redirect_uri: redirectUri,
        scope: 'openid profile email',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
        ...(domainHint ? { domain_hint: domainHint } : {}),
      }).toString();
      return url.toString();
    },

    async redeem(code, codeVerifier, redirectUri, nonce) {
      if (!configured || !jwks) throw notConfigured();
      const res = await fetch(`${base}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
          scope: 'openid profile email',
        }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = (await res.json().catch(() => ({}))) as { id_token?: unknown; error?: unknown };
      if (!res.ok || typeof data.id_token !== 'string') {
        throw new MicrosoftSignInError('token_exchange_failed', `Microsoft token request failed (${res.status} ${String(data.error ?? '')})`);
      }

      let payload: JWTPayload;
      try {
        ({ payload } = await jwtVerify(data.id_token, jwks, {
          issuer,
          audience: clientId!,
          algorithms: ['RS256'],
          clockTolerance: 60,
          maxTokenAge: '15m',
        }));
      } catch (err: any) {
        throw new MicrosoftSignInError('invalid_id_token', `Microsoft ID token rejected: ${err?.code ?? err?.message ?? err}`);
      }
      if (payload.nonce !== nonce) throw new MicrosoftSignInError('invalid_id_token', 'Microsoft ID token nonce mismatch');
      if (String(payload.tid ?? '').toLowerCase() !== tenantId) {
        throw new MicrosoftSignInError('wrong_tenant', 'Microsoft account is not from the university directory');
      }
      const oid = typeof payload.oid === 'string' ? payload.oid : '';
      const rawEmail = [payload.email, payload.preferred_username, payload.upn].find(
        (v): v is string => typeof v === 'string' && v.includes('@'),
      );
      if (!oid || !rawEmail) throw new MicrosoftSignInError('invalid_id_token', 'Microsoft ID token has no account id or email');

      return {
        oid,
        tid: tenantId!,
        email: rawEmail.trim().toLowerCase(),
        name: typeof payload.name === 'string' ? payload.name.trim().slice(0, 100) : '',
        issuedAt: typeof payload.iat === 'number' ? payload.iat : null,
        idTokenSha256: createHash('sha256').update(data.id_token).digest('hex'),
      };
    },
  };
}

// Stand-in for Microsoft's sign-in service, for local testing and the automated tests
// only. It speaks the same OpenID Connect flow as login.microsoftonline.com (PKCE,
// client secret, RS256-signed ID tokens, published keys) but lets you type any email.
//
//   npm run mock:microsoft          # prints the .env lines to use
//
// The server refuses an http:// MS_AUTHORITY when NODE_ENV=production, so this can never
// be used by the real deployment.
import { createHash, randomBytes } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import { SignJWT, calculateJwkThumbprint, exportJWK, generateKeyPair, type JWTPayload } from 'jose';

export const MOCK_TENANT_ID = '11111111-2222-3333-4444-555555555555';
export const MOCK_CLIENT_ID = '66666666-7777-8888-9999-000000000000';
export const MOCK_CLIENT_SECRET = 'mock-microsoft-client-secret';

export interface MockMicrosoft {
  authority: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  // Tests: change the ID token claims, or sign with a key Microsoft never published.
  tamper: { claims?: (claims: JWTPayload) => JWTPayload; foreignKey?: boolean };
  close(): Promise<void>;
}

interface PendingCode {
  email: string;
  name: string;
  nonce: string;
  challenge: string;
  redirectUri: string;
  expires: number;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const mockOid = (email: string) => {
  const h = createHash('sha256').update(email.toLowerCase()).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};

export async function startMockMicrosoft(options: { port?: number; host?: string } = {}): Promise<MockMicrosoft> {
  const tenantId = MOCK_TENANT_ID;
  const clientId = MOCK_CLIENT_ID;
  const clientSecret = MOCK_CLIENT_SECRET;
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const foreign = await generateKeyPair('RS256');
  // A new key id per key (as Microsoft does), so a restarted mock is picked up by the app.
  const publicJwk = await exportJWK(publicKey);
  const kid = await calculateJwkThumbprint(publicJwk);
  const jwk = { ...publicJwk, kid, use: 'sig', alg: 'RS256' };
  const codes = new Map<string, PendingCode>();
  const tamper: MockMicrosoft['tamper'] = {};
  let authority = '';

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://mock');
    const prefix = `/${tenantId}`;
    const send = (status: number, type: string, body: string, headers: Record<string, string> = {}) => {
      res.writeHead(status, { 'Content-Type': type, ...headers });
      res.end(body);
    };

    try {
      if (url.pathname === '/favicon.ico') return send(204, 'text/plain', '');
      if (req.method === 'GET' && url.pathname === `${prefix}/discovery/v2.0/keys`) {
        return send(200, 'application/json', JSON.stringify({ keys: [jwk] }));
      }

      if (req.method === 'GET' && url.pathname === `${prefix}/oauth2/v2.0/authorize`) {
        const p = url.searchParams;
        const redirectUri = p.get('redirect_uri') ?? '';
        if (p.get('client_id') !== clientId || !redirectUri || p.get('code_challenge_method') !== 'S256') {
          return send(400, 'text/plain', 'invalid authorize request');
        }
        const back = new URL(redirectUri);
        back.searchParams.set('state', p.get('state') ?? '');
        if (p.get('cancel')) {
          back.searchParams.set('error', 'access_denied');
          return send(302, 'text/plain', '', { Location: back.toString() });
        }
        const email = p.get('login_email')?.trim();
        if (email) {
          const code = randomBytes(24).toString('base64url');
          codes.set(code, {
            email,
            name: p.get('login_name')?.trim() || email.split('@')[0],
            nonce: p.get('nonce') ?? '',
            challenge: p.get('code_challenge') ?? '',
            redirectUri,
            expires: Date.now() + 5 * 60_000,
          });
          back.searchParams.set('code', code);
          return send(302, 'text/plain', '', { Location: back.toString() });
        }
        const hidden = [...p.entries()]
          .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
          .join('');
        return send(
          200,
          'text/html; charset=utf-8',
          `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Mock Microsoft sign-in</title>
<body style="font-family:system-ui;max-width:420px;margin:60px auto;padding:0 16px">
<h2>Mock Microsoft sign-in</h2>
<p style="color:#b45309">Local testing only. The real site uses login.microsoftonline.com.</p>
<form method="get">${hidden}
<label>Email<br><input name="login_email" type="email" required value="student@reva.edu.in" style="width:100%;padding:8px"></label><br><br>
<label>Name<br><input name="login_name" value="Test Student" style="width:100%;padding:8px"></label><br><br>
<button style="padding:8px 16px">Sign in</button>
<button name="cancel" value="1" formnovalidate style="padding:8px 16px">Cancel</button>
</form></body>`,
        );
      }

      if (req.method === 'POST' && url.pathname === `${prefix}/oauth2/v2.0/token`) {
        let raw = '';
        for await (const chunk of req) raw += chunk;
        const p = new URLSearchParams(raw);
        const code = codes.get(p.get('code') ?? '');
        codes.delete(p.get('code') ?? '');
        const verifierOk =
          code && createHash('sha256').update(p.get('code_verifier') ?? '').digest('base64url') === code.challenge;
        if (
          p.get('client_id') !== clientId ||
          p.get('client_secret') !== clientSecret ||
          p.get('grant_type') !== 'authorization_code' ||
          !code ||
          code.expires < Date.now() ||
          code.redirectUri !== p.get('redirect_uri') ||
          !verifierOk
        ) {
          return send(400, 'application/json', JSON.stringify({ error: 'invalid_grant' }));
        }
        const now = Math.floor(Date.now() / 1000);
        let claims: JWTPayload = {
          iss: `${authority}/${tenantId}/v2.0`,
          aud: clientId,
          iat: now,
          nbf: now,
          exp: now + 3600,
          tid: tenantId,
          oid: mockOid(code.email),
          email: code.email,
          preferred_username: code.email,
          name: code.name,
          nonce: code.nonce,
          ver: '2.0',
        };
        if (tamper.claims) claims = tamper.claims(claims);
        const idToken = await new SignJWT(claims)
          .setProtectedHeader({ alg: 'RS256', kid, typ: 'JWT' })
          .sign(tamper.foreignKey ? foreign.privateKey : privateKey);
        return send(200, 'application/json', JSON.stringify({ token_type: 'Bearer', id_token: idToken, expires_in: 3600 }));
      }

      send(404, 'text/plain', 'not found');
    } catch (err) {
      send(500, 'text/plain', String(err));
    }
  });

  await new Promise<void>((resolve) => server.listen(options.port ?? 0, options.host ?? '127.0.0.1', resolve));
  authority = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    authority,
    tenantId,
    clientId,
    clientSecret,
    tamper,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mock = await startMockMicrosoft({ port: Number(process.env.MOCK_MS_PORT) || 3999 });
  console.log(`Mock Microsoft sign-in running at ${mock.authority}

Put these in .env (local testing only; NODE_ENV must not be "production"):
  MS_AUTHORITY=${mock.authority}
  MS_TENANT_ID=${mock.tenantId}
  MS_CLIENT_ID=${mock.clientId}
  MS_CLIENT_SECRET=${mock.clientSecret}

Keep this running while you test. Ctrl+C to stop.`);
}

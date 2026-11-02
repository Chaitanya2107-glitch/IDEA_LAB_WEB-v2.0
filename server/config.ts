// Runtime configuration, read once from the environment and validated up front so a
// misconfigured server fails at boot instead of on the first request.

export interface Config {
  isProd: boolean;
  port: number;
  host: string;
  // Public origin of the site, used in emailed links (e.g. https://idealab.reva.edu.in).
  publicUrl: string;
  tenantId: string;
  universityEmailDomain: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  mongodbUri: string;
  mongodbDb: string;
  // Separate database for the sign-in audit log (append-only for the app's MongoDB user).
  mongodbAuditDb: string;
  // Microsoft Entra ID (REVA's Microsoft 365) sign-in for students and staff.
  microsoft: {
    tenantId?: string; // directory (tenant) id, a GUID
    clientId?: string; // application (client) id
    clientSecret?: string;
    // https://login.microsoftonline.com, or a local stand-in for testing.
    authority: string;
  };
  // Separate database for the Google sign-in log (same append-only rules).
  mongodbGoogleAuditDb: string;
  // Separate database for the email + password sign-in log (same append-only rules).
  mongodbPasswordAuditDb: string;
  // Google sign-in for visitors outside REVA (general access, student portal only).
  google: {
    clientId?: string;
    clientSecret?: string;
    // Google's endpoints; only set to a local stand-in for testing.
    authority?: string;
  };
  // Uploaded files (site media and student STL files) live here, on the server's disk.
  storageDir: string;
  email: {
    // Sender address verified in Amazon SES. Unset = emails are written to the log.
    from?: string;
    region?: string;
  };
  corsOrigins: string[];
  trustProxy: boolean | number | string;
  // Per client IP, per minute. Campus users often share one NAT address, so keep these generous.
  rateLimitPerMinute: number;
  authRateLimitPerMinute: number;
  // Email + password sign-in, sign-up and email confirmation, per client IP.
  passwordRateLimitPerMinute: number;
  serveStatic: boolean;
  staticDir: string;
  razorpay: {
    keyId?: string;
    keySecret?: string;
    webhookSecret?: string;
    // Only changed for automated tests against a stand-in server.
    apiBase: string;
  };
}

export class ConfigError extends Error {}

const MIN_SECRET_LENGTH = 32;

function parseTrustProxy(raw: string | undefined): boolean | number | string {
  // Default trusts only proxies on private/loopback addresses (nginx on the same host,
  // an AWS load balancer inside the VPC), so clients cannot spoof X-Forwarded-For.
  if (raw === undefined || raw === '') return 'loopback, linklocal, uniquelocal';
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}

function positiveInt(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new ConfigError(`${name} must be a positive integer`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const isProd = env.NODE_ENV === 'production';
  const missing: string[] = [];
  const need = (key: string) => {
    const value = env[key];
    if (!value) missing.push(key);
    return value ?? '';
  };

  const jwtSecret = need('JWT_SECRET');
  const mongodbUri = need('MONGODB_URI');
  const port = positiveInt(env.PORT, 3001, 'PORT');
  const publicUrl = (env.PUBLIC_URL || (isProd ? '' : `http://localhost:${port}`)).replace(/\/+$/, '');
  if (!publicUrl) missing.push('PUBLIC_URL');

  if (missing.length) {
    throw new ConfigError(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (jwtSecret.length < MIN_SECRET_LENGTH) {
    throw new ConfigError(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  if (!/^https?:\/\/[^/]+$/.test(publicUrl)) {
    throw new ConfigError('PUBLIC_URL must be an origin like https://idealab.reva.edu.in');
  }
  if (port > 65535) throw new ConfigError('PORT must be a valid TCP port');

  const authority = (env.MS_AUTHORITY || 'https://login.microsoftonline.com').replace(/\/+$/, '');
  // Plain http is only accepted outside production, for the local stand-in
  // (scripts/mock-microsoft.ts) used when testing.
  const localAuthority = !isProd && /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(authority);
  if (!/^https:\/\/[^/]+$/.test(authority) && !localAuthority) {
    throw new ConfigError('MS_AUTHORITY must be an https origin');
  }
  const msTenantId = env.MS_TENANT_ID || undefined;
  if (msTenantId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(msTenantId)) {
    throw new ConfigError('MS_TENANT_ID must be the directory (tenant) ID, a GUID like 00000000-0000-0000-0000-000000000000');
  }
  const mongodbDb = env.MONGODB_DB || 'idealab';

  const googleAuthority = env.GOOGLE_AUTHORITY ? env.GOOGLE_AUTHORITY.replace(/\/+$/, '') : undefined;
  if (googleAuthority && (isProd || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(googleAuthority))) {
    throw new ConfigError('GOOGLE_AUTHORITY is only for the local test stand-in (http://127.0.0.1:<port>, not in production)');
  }

  return {
    isProd,
    port,
    host: env.HOST || '0.0.0.0',
    publicUrl,
    tenantId: env.TENANT_ID || 'reva-idea-lab',
    universityEmailDomain: (env.UNIVERSITY_EMAIL_DOMAIN || 'reva.edu.in').toLowerCase().replace(/^@/, ''),
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
    mongodbUri,
    mongodbDb,
    mongodbAuditDb: env.MONGODB_AUDIT_DB || `${mongodbDb}_audit`,
    mongodbGoogleAuditDb: env.MONGODB_GOOGLE_AUDIT_DB || `${mongodbDb}_audit_google`,
    mongodbPasswordAuditDb: env.MONGODB_PASSWORD_AUDIT_DB || `${mongodbDb}_audit_password`,
    google: {
      clientId: env.GOOGLE_CLIENT_ID || undefined,
      clientSecret: env.GOOGLE_CLIENT_SECRET || undefined,
      authority: googleAuthority,
    },
    microsoft: {
      tenantId: msTenantId?.toLowerCase(),
      clientId: env.MS_CLIENT_ID || undefined,
      clientSecret: env.MS_CLIENT_SECRET || undefined,
      authority,
    },
    storageDir: env.STORAGE_DIR || './data/uploads',
    email: {
      from: env.EMAIL_FROM || undefined,
      region: env.AWS_REGION || env.AWS_DEFAULT_REGION || undefined,
    },
    corsOrigins: (env.CORS_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    rateLimitPerMinute: positiveInt(env.RATE_LIMIT_PER_MINUTE, 6000, 'RATE_LIMIT_PER_MINUTE'),
    authRateLimitPerMinute: positiveInt(env.AUTH_RATE_LIMIT_PER_MINUTE, 60, 'AUTH_RATE_LIMIT_PER_MINUTE'),
    passwordRateLimitPerMinute: positiveInt(env.PASSWORD_RATE_LIMIT_PER_MINUTE, 300, 'PASSWORD_RATE_LIMIT_PER_MINUTE'),
    serveStatic: env.SERVE_STATIC !== 'false',
    staticDir: env.STATIC_DIR || 'dist',
    razorpay: {
      keyId: env.RAZORPAY_KEY_ID || undefined,
      keySecret: env.RAZORPAY_KEY_SECRET || undefined,
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || undefined,
      apiBase: (env.RAZORPAY_API_BASE || 'https://api.razorpay.com/v1').replace(/\/+$/, ''),
    },
  };
}

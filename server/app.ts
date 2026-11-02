import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import type { Deps } from './deps.js';
import { createGuards } from './lib/auth.js';
import { errorHandler } from './lib/http.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { contentRoutes } from './routes/content.js';
import { googleRoutes } from './routes/google.js';
import { labRoutes } from './routes/lab.js';
import { microsoftRoutes } from './routes/microsoft.js';
import { passwordRoutes } from './routes/password.js';
import { paymentRoutes, paymentWebhook } from './routes/payments.js';
import { printRoutes } from './routes/print.js';
import { signInRoutes } from './routes/signins.js';
import { storageRoutes, uploadReceiver } from './routes/storage.js';

export interface AppOptions {
  // Disable in tests to exercise many requests from one address.
  rateLimit?: boolean;
}

export function createApp(deps: Deps, options: AppOptions = {}): Express {
  const { config } = deps;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      // Everything is served from this server except Razorpay Checkout (payments).
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'data:'],
          // Content editors may link images/videos hosted elsewhere over https.
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          mediaSrc: ["'self'", 'blob:', 'https:'],
          connectSrc: ["'self'", 'blob:', 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
          frameSrc: ['https://api.razorpay.com', 'https://checkout.razorpay.com'],
          workerSrc: ["'self'", 'blob:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
          ...(config.publicUrl.startsWith('https://') ? { upgradeInsecureRequests: [] } : {}),
        },
      },
      crossOriginEmbedderPolicy: false,
      // Razorpay Checkout opens a popup for some payment methods and needs window.opener.
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    }),
  );

  /* ---------------- API ---------------- */

  const api = express.Router();

  if (config.corsOrigins.length) {
    api.use(
      cors({
        origin: config.corsOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 600,
      }),
    );
  }

  if (options.rateLimit !== false) {
    const limiter = (limit: number, windowMs = 60_000) =>
      rateLimit({
        windowMs,
        limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        message: { error: 'Too many requests, please try again later.' },
      });
    api.use(limiter(config.rateLimitPerMinute));
    // Strict limit only where guessing or abuse is possible: the emergency-admin password
    // routes and payment order creation. Microsoft/Google sign-in is protected by the
    // provider, and a whole campus often shares one public IP, so it must not be throttled
    // to a few sign-ins a minute.
    api.use(
      ['/auth/staff-login', '/auth/forgot-password', '/auth/reset-password', '/auth/change-password', '/payments'],
      limiter(config.authRateLimitPerMinute),
    );
    // Email + password sign-in: each account also locks after 10 wrong passwords, so the
    // per-IP limit can stay high enough for a classroom signing in from one campus IP.
    api.use(['/auth/login', '/auth/register', '/auth/verify-email'], limiter(config.passwordRateLimitPerMinute));
  }

  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  const guards = createGuards(deps);

  // Raw-body routes, before the JSON parser.
  api.post('/payments/razorpay/webhook', ...paymentWebhook(deps));
  api.put('/uploads/:token', ...uploadReceiver(deps, guards));
  api.use(express.json({ limit: '2mb' }));

  // Liveness plus a database round trip, for the load balancer / Docker health check.
  api.get('/health', async (_req, res) => {
    try {
      await deps.db.command({ ping: 1 });
      res.json({ status: 'ok', database: 'ok' });
    } catch {
      res.status(503).json({ status: 'error', database: 'unreachable' });
    }
  });

  api.use(authRoutes(deps, guards));
  api.use(microsoftRoutes(deps));
  api.use(googleRoutes(deps));
  api.use(passwordRoutes(deps));
  api.use(signInRoutes(deps, guards));
  api.use(adminRoutes(deps, guards));
  api.use(labRoutes(deps, guards));
  api.use(contentRoutes(deps, guards));
  api.use(paymentRoutes(deps, guards));
  api.use(printRoutes(deps, guards));
  api.use(storageRoutes(deps, guards));

  api.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  api.use(errorHandler);

  app.use('/api', api);

  /* ---------------- Uploaded site media (public) ---------------- */

  // Only types checked at upload are stored here. The locked-down CSP means a file can
  // never run script in the site's origin, even if opened directly.
  app.use(
    '/files/projects',
    express.static(path.join(deps.files.root, 'projects'), {
      index: false,
      dotfiles: 'deny',
      maxAge: '7d',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'");
      },
    }),
    (_req: express.Request, res: express.Response) => {
      res.status(404).json({ error: 'Not found' });
    },
  );

  /* ---------------- Frontend (built SPA) ---------------- */

  const staticDir = path.resolve(config.staticDir);
  const indexHtml = path.join(staticDir, 'index.html');
  if (config.serveStatic && fs.existsSync(indexHtml)) {
    app.use(
      '/assets',
      express.static(path.join(staticDir, 'assets'), { immutable: true, maxAge: '1y', index: false }),
      // A missing hashed bundle (old page after a redeploy) must 404, not get index.html.
      (_req: express.Request, res: express.Response) => {
        res.status(404).json({ error: 'Not found' });
      },
    );
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    // Client-side routes (/dashboard, /events/123, ...) all serve the SPA shell.
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.set('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);

  return app;
}

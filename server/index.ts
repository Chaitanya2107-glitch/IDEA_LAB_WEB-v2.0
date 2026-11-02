import 'dotenv/config';
import { createApp } from './app.js';
import { ConfigError, loadConfig } from './config.js';
import { createDeps } from './deps.js';

async function start() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(`[config] ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  const ms = config.microsoft;
  if (!ms.tenantId || !ms.clientId || !ms.clientSecret) {
    console.warn('[config] MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET are not all set: Microsoft sign-in is off; only the emergency administrator can sign in.');
  }
  if (!config.google.clientId || !config.google.clientSecret) {
    console.log('[config] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set: Google sign-in (visitors) is off.');
  }
  if (config.isProd && !config.email.from) {
    console.warn('[config] EMAIL_FROM is not set: password-reset emails will only be logged.');
  }
  if (!config.razorpay.keyId || !config.razorpay.keySecret) {
    console.warn('[config] Razorpay keys are not set: 3D print checkout will be unavailable.');
  }

  const { deps, client } = await createDeps(config);
  const app = createApp(deps);
  const server = app.listen(config.port, config.host, () => {
    console.log(`[server] listening on http://${config.host}:${config.port} (${config.isProd ? 'production' : 'development'})`);
  });

  // Behind a load balancer, keep idle sockets open longer than the balancer does.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  const shutdown = (signal: string) => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(async () => {
      await client.close().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    console.error('[server] unhandled rejection:', reason);
  });
}

start().catch((err) => {
  console.error('[server] failed to start:', err?.message ?? err);
  process.exit(1);
});

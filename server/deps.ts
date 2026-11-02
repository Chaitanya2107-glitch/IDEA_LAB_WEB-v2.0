import type { Db, MongoClient } from 'mongodb';
import type { Config } from './config.js';
import { connectMongo } from './db.js';
import { createMailer, type Mailer } from './lib/mailer.js';
import { createGoogleClient, type GoogleClient } from './lib/google.js';
import { createMicrosoftClient, type MicrosoftClient } from './lib/microsoft.js';
import { createRazorpayGateway, type PaymentGateway } from './lib/razorpay.js';
import { createFileStore, type FileStore } from './lib/storage.js';

// Everything the routes need from the outside world. Tests swap the mailer and payment
// gateway for fakes and point the database at a throwaway MongoDB database.
export interface Deps {
  config: Config;
  db: Db;
  // Sign-in audit log (separate database).
  audit: Db;
  // Google sign-in log (separate database).
  googleAudit: Db;
  // Email + password sign-in log (separate database).
  passwordAudit: Db;
  files: FileStore;
  mailer: Mailer;
  payments: PaymentGateway;
  microsoft: MicrosoftClient;
  google: GoogleClient;
}

export async function createDeps(config: Config): Promise<{ deps: Deps; client: MongoClient }> {
  const { client, db, audit, googleAudit, passwordAudit } = await connectMongo(
    config.mongodbUri,
    config.mongodbDb,
    config.mongodbAuditDb,
    config.mongodbGoogleAuditDb,
    config.mongodbPasswordAuditDb,
  );
  return {
    client,
    deps: {
      config,
      db,
      audit,
      googleAudit,
      passwordAudit,
      files: createFileStore(config.storageDir),
      mailer: createMailer(config),
      payments: createRazorpayGateway(config),
      microsoft: createMicrosoftClient(config),
      google: createGoogleClient(config),
    },
  };
}

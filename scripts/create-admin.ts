// Creates (or resets) the emergency administrator: the one account that can sign in with a
// password (everyone else uses their REVA Microsoft account). Use it for the first
// sign-in after deployment, to add staff, and if Microsoft sign-in ever stops working.
//
//   node build/scripts/create-admin.js --email admin@reva.edu.in --name "Lab Admin"
//
// The password is asked for interactively (not shown), or read from ADMIN_PASSWORD.
// Reads MONGODB_URI / MONGODB_DB from the environment or .env.
import 'dotenv/config';
import readline from 'node:readline';
import { collection, connectMongo, newId, nowIso } from '../server/db.js';
import { assertStrongPassword, hashPassword } from '../server/lib/password.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = (rl as any)._writeToOutput.bind(rl);
    (rl as any)._writeToOutput = (s: string) => write(s.startsWith(question) ? s : '');
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const email = arg('email')?.trim().toLowerCase();
  const name = arg('name')?.trim() || 'Administrator';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Usage: create-admin --email admin@example.com [--name "Full Name"]');
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await askHidden('Password for the new administrator: ');
    const again = await askHidden('Repeat the password: ');
    if (password !== again) throw new Error('Passwords do not match');
  }
  assertStrongPassword(password, email);

  const { client, db } = await connectMongo(uri, process.env.MONGODB_DB || 'idealab', process.env.MONGODB_AUDIT_DB || undefined);
  try {
    const staff = collection(db, 'staff');
    const result = await staff.updateOne(
      { email },
      {
        $set: {
          name,
          role: 'ADMIN',
          is_verified: true,
          password_hash: await hashPassword(password),
          failed_logins: 0,
          locked_until: null,
          updated_at: nowIso(),
        },
        $inc: { token_version: 1 },
        $setOnInsert: {
          _id: newId(),
          email,
          tenant_id: process.env.TENANT_ID || 'reva-idea-lab',
          email_verified: false,
          created_at: nowIso(),
        },
      },
      { upsert: true },
    );
    console.log(result.upsertedCount ? `Created administrator ${email}` : `Updated ${email}: now an administrator with the new password`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

// Fills a LOCAL/TEST database with demo accounts and sample content so every page can be
// tried after a fresh checkout. Refuses to run when NODE_ENV=production.
//
//   npm run seed:demo            (reads MONGODB_URI / MONGODB_DB from .env)
//
// Demo logins:
//   Emergency admin (password Demo-Pass-2026, "Emergency administrator" on /staff-login):
//     admin@demo.local
//   Email + password visitor (password Demo-Pass-2026, on /login): visitor@demo.local
//   Microsoft sign-in (with `npm run mock:microsoft` running, type the email there):
//     staff:   demo-lab@ demo-ambassador@ demo-events@ demo-tech@ demo-admin@  ...reva.edu.in
//     student: student@reva.edu.in (or any other @reva.edu.in address, which creates one)
import 'dotenv/config';
import { collection, connectMongo, nowIso, type CollectionName, type Doc } from '../server/db.js';
import { hashPassword } from '../server/lib/password.js';

export const DEMO_PASSWORD = 'Demo-Pass-2026';

export async function seedDemo(uri: string, dbName: string): Promise<void> {
  const { client, db } = await connectMongo(uri, dbName, process.env.MONGODB_AUDIT_DB || undefined);
  try {
    const hash = await hashPassword(DEMO_PASSWORD);
    const now = nowIso();
    // Staff sign in with Microsoft, so they have no password.
    const staff = (id: string, name: string, role: string) => ({
      _id: id, name, email: `demo-${id.slice(2)}@reva.edu.in`, role, is_verified: true, password_hash: null,
      token_version: 0, failed_logins: 0, tenant_id: 'reva-idea-lab', created_at: now,
    });
    const upcoming = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

    const data: Partial<Record<CollectionName, Doc[]>> = {
      staff: [
        // The emergency administrator: the only staff password account.
        { ...staff('s-emergency', 'Emergency Admin', 'ADMIN'), email: 'admin@demo.local', password_hash: hash },
        staff('s-admin', 'Demo Admin', 'ADMIN'),
        staff('s-lab', 'Demo Lab Staff', 'LAB'),
        { ...staff('s-ambassador', 'Demo Ambassador', 'AMBASSADOR') },
        { ...staff('s-events', 'Demo Event Manager', 'EVENT_MANAGER') },
        { ...staff('s-tech', 'Demo Tech Support', 'TECH_SUPPORT') },
      ],
      users: [
        {
          _id: 'u-student', name: 'Demo Student', email: 'student@reva.edu.in', role: 'USER', type: 'university',
          email_verified: true, is_profile_complete: true, password_hash: null, token_version: 0, failed_logins: 0,
          tenant_id: 'reva-idea-lab', degree: 'B.Tech', program: 'Computer Science', created_at: now,
        },
        {
          // Email + password account (general access), for trying the password sign-in.
          _id: 'u-visitor', name: 'Demo Visitor', email: 'visitor@demo.local', role: 'USER', type: 'non-university',
          email_verified: true, is_profile_complete: true, password_hash: hash, auth_provider: 'password', token_version: 0,
          failed_logins: 0, tenant_id: 'reva-idea-lab', created_at: now,
        },
      ],
      print_materials_config: [
        { _id: 'mat-pla', name: 'PLA', density: 1.24, price_per_gram: 5, colors: [{ name: 'Orange', hex: '#ea580c' }, { name: 'Black', hex: '#0f172a' }, { name: 'White', hex: '#f8fafc' }] },
        { _id: 'mat-petg', name: 'PETG', density: 1.27, price_per_gram: 6, colors: [{ name: 'Clear', hex: '#e2e8f0' }, { name: 'Blue', hex: '#2563eb' }] },
      ],
      inventory: [
        { _id: 'inv-uno', name: 'Arduino Uno R3', category: 'Microcontrollers', type: 'component', total_quantity: 20, available_quantity: 14, cost_per_unit: 450, status: 'operational', location: 'Main Lab', created_at: now },
        { _id: 'inv-esp32', name: 'ESP32 DevKit', category: 'Microcontrollers', type: 'component', total_quantity: 15, available_quantity: 3, cost_per_unit: 380, status: 'operational', location: 'Main Lab', created_at: now },
        { _id: 'inv-servo', name: 'SG90 Servo Motor', category: 'Motors', type: 'component', total_quantity: 40, available_quantity: 32, cost_per_unit: 90, status: 'operational', location: 'Store', created_at: now },
      ],
      events: [
        { _id: 'ev-robotics', title: 'Robotics Workshop', description: 'Hands-on introduction to building and programming robots.', type: 'Workshop', category: 'Workshop', status: 'upcoming', start_date: upcoming(10), end_date: upcoming(10), start_time: '10:00', end_time: '16:00', location: 'IDEA Lab', max_attendees: 30, registered_count: 0, created_at: now },
        { _id: 'ev-hack', title: 'Idea-thon: Smart Campus', description: '24-hour hackathon on campus sustainability.', type: 'Hackathon', category: 'Hackathon', status: 'upcoming', start_date: upcoming(25), end_date: upcoming(26), start_time: '09:00', end_time: '09:00', location: 'Innovation Hub', max_attendees: 100, registered_count: 0, created_at: now },
      ],
      lab_projects: [
        { _id: 'proj-rover', title: 'Autonomous Campus Rover', category: 'Robotics', description: 'A rover that maps campus paths.', author: 'Team Rover', technologies: ['ROS', 'LiDAR'], image_url: '/img/homepage/DSC_4770.JPG', created_at: now },
      ],
      gallery: [
        { _id: 'gal-1', type: 'image', title: 'Lab session', src: '/img/homepage/DSC_4720.JPG', size: 'medium', created_at: now },
        { _id: 'gal-2', type: 'image', title: 'PCB assembly', src: '/img/homepage/pcb.JPG', size: 'small', created_at: now },
      ],
      lab_closures: [{ _id: 'cl-1', date: upcoming(40), reason: 'Maintenance day', closure_type: 'maintenance', created_at: now }],
      history_logs: [{ _id: 'h-1', actor_name: 'Demo Admin', action: 'Seeded demo data', timestamp: now }],
    };

    for (const [name, docs] of Object.entries(data) as [CollectionName, Doc[]][]) {
      for (const doc of docs) {
        const { _id, ...fields } = doc;
        await collection(db, name).updateOne({ _id }, { $set: fields }, { upsert: true });
      }
      console.log(`  ${name}: ${docs.length}`);
    }
  } finally {
    await client.close();
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--i-know-this-is-not-production')) {
    throw new Error('Refusing to add demo accounts with a known password to a production database.');
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  console.log('Seeding demo data...');
  await seedDemo(uri, process.env.MONGODB_DB || 'idealab');
  console.log(`Done. Emergency admin: admin@demo.local / ${DEMO_PASSWORD}. Email + password visitor: visitor@demo.local / ${DEMO_PASSWORD}. Everyone else signs in with Microsoft (npm run mock:microsoft).`);
}

if (process.argv[1] && /seed-demo\.(ts|js)$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

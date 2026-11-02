// Copies the About page team photos into public/img/team so the site does not load
// them from other websites. Run once (needs internet), then commit the images:
//
//   node scripts/fetch-team-photos.mjs && git add public/img/team
//
// Until a photo is present, the About page shows the person's initials instead.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sources = JSON.parse(await fs.readFile(path.join(root, 'scripts/team-photos.json'), 'utf8'));

let failed = 0;
for (const [target, url] of Object.entries(sources)) {
  const file = path.join(root, 'public', target);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
    console.log(`saved ${target}`);
  } catch (err) {
    failed++;
    console.error(`could not download ${url}: ${err.message}`);
  }
}
process.exit(failed ? 1 : 0);

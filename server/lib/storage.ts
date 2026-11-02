import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { HttpError, badRequest } from './http.js';

// Uploaded files live on the server's disk (an EBS volume on AWS) under
// STORAGE_DIR/<bucket>/<key>:
//   projects/   site images, videos and PDFs (public, served at /files/projects/...)
//   stl-files/  students' 3D models (private, downloaded through signed links)
//   pcb-files/  students' PCB design files: Gerber zip etc. (private, same as stl-files)

export const BUCKETS = ['projects', 'stl-files', 'pcb-files'] as const;
export type Bucket = (typeof BUCKETS)[number];

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

export function assertKey(key: string): string {
  const segments = key.split('/');
  // Each segment must start with a letter or digit, so "." and ".." can never appear.
  if (segments.length > 4 || segments.some((s) => !SEGMENT.test(s))) {
    throw badRequest('Invalid file path');
  }
  return key;
}

export interface FileStore {
  readonly root: string;
  write(bucket: Bucket, key: string, source: Readable, maxBytes: number): Promise<number>;
  read(bucket: Bucket, key: string, maxBytes: number): Promise<Buffer | null>;
  size(bucket: Bucket, key: string): Promise<number | null>;
  stream(bucket: Bucket, key: string): fs.ReadStream;
  remove(bucket: Bucket, key: string): Promise<void>;
}

export function createFileStore(storageDir: string): FileStore {
  const root = path.resolve(storageDir);
  const resolve = (bucket: Bucket, key: string) => {
    assertKey(key);
    const full = path.resolve(root, bucket, key);
    if (!full.startsWith(path.join(root, bucket) + path.sep)) throw badRequest('Invalid file path');
    return full;
  };

  return {
    root,
    async write(bucket, key, source, maxBytes) {
      const target = resolve(bucket, key);
      await fsp.mkdir(path.dirname(target), { recursive: true });
      // Write to a temp file and rename, so a half-written upload is never visible.
      const temp = `${target}.${randomBytes(6).toString('hex')}.part`;
      let bytes = 0;
      const limiter = new Transform({
        transform(chunk: Buffer, _enc, done) {
          bytes += chunk.length;
          if (bytes > maxBytes) return done(new HttpError(413, `File must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller`));
          done(null, chunk);
        },
      });
      try {
        await pipeline(source, limiter, fs.createWriteStream(temp, { flags: 'wx', mode: 0o640 }));
        if (bytes === 0) throw badRequest('The file is empty');
        await fsp.rename(temp, target);
        return bytes;
      } catch (err) {
        await fsp.rm(temp, { force: true });
        throw err;
      }
    },
    async read(bucket, key, maxBytes) {
      const full = resolve(bucket, key);
      const stat = await fsp.stat(full).catch(() => null);
      if (!stat?.isFile()) return null;
      if (stat.size > maxBytes) throw badRequest('File is too large');
      return fsp.readFile(full);
    },
    async size(bucket, key) {
      const stat = await fsp.stat(resolve(bucket, key)).catch(() => null);
      return stat?.isFile() ? stat.size : null;
    },
    stream(bucket, key) {
      return fs.createReadStream(resolve(bucket, key));
    },
    async remove(bucket, key) {
      await fsp.rm(resolve(bucket, key), { force: true });
    },
  };
}

/* ------------------------------------------------------------------ */
/* Signed download links for private files                             */
/* ------------------------------------------------------------------ */

function signature(secret: string, bucket: string, key: string, expires: number): string {
  return createHmac('sha256', secret).update(`download:${bucket}/${key}:${expires}`).digest('base64url');
}

export function signedDownloadPath(secret: string, bucket: Bucket, key: string, ttlSeconds = 300): string {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = signature(secret, bucket, key, expires);
  return `/api/files/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}?expires=${expires}&sig=${sig}`;
}

export function verifyDownloadSignature(secret: string, bucket: string, key: string, expires: unknown, sig: unknown): boolean {
  const exp = Number(expires);
  if (!Number.isInteger(exp) || exp < Math.floor(Date.now() / 1000) || typeof sig !== 'string') return false;
  const expected = Buffer.from(signature(secret, bucket, key, exp));
  const actual = Buffer.from(sig);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/* ------------------------------------------------------------------ */
/* Content checks                                                      */
/* ------------------------------------------------------------------ */

// First bytes of each allowed type, so a renamed HTML/script file is rejected.
const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/gif': (b) => b.subarray(0, 4).toString('latin1') === 'GIF8',
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  'image/avif': (b) => b.subarray(4, 8).toString('latin1') === 'ftyp',
  'video/mp4': (b) => b.subarray(4, 8).toString('latin1') === 'ftyp',
  'video/quicktime': (b) => ['ftyp', 'moov', 'mdat', 'wide', 'free'].includes(b.subarray(4, 8).toString('latin1')),
  'video/webm': (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
  'application/pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
};

export async function matchesContentType(store: FileStore, bucket: Bucket, key: string, contentType: string): Promise<boolean> {
  const check = SIGNATURES[contentType];
  if (!check) return true;
  const handle = await fsp.open(path.resolve(store.root, bucket, assertKey(key)), 'r');
  try {
    const head = Buffer.alloc(16);
    await handle.read(head, 0, 16, 0);
    return check(head);
  } finally {
    await handle.close();
  }
}

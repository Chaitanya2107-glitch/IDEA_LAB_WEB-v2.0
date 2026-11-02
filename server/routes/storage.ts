import { createHash, randomBytes } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Router, type RequestHandler } from 'express';
import { collection, nowIso } from '../db.js';
import type { Deps } from '../deps.js';
import { isStaff, principalOf, type Guards } from '../lib/auth.js';
import { HttpError, badRequest, body, forbidden, notFound, oneOf, optNumber, reqString } from '../lib/http.js';
import { assertKey, matchesContentType, verifyDownloadSignature, type Bucket } from '../lib/storage.js';

// Uploads are two steps, like S3 pre-signed URLs:
//   1. POST /api/uploads        -> the API checks who may upload what and returns a one-time
//                                  upload URL valid for 15 minutes
//   2. PUT  /api/uploads/:token -> the browser sends the raw file; it is streamed to disk
//                                  with the size limit enforced while it arrives

const MB = 1024 * 1024;
const TICKET_TTL_MS = 15 * 60 * 1000;
// Students (not staff) may start this many uploads per day: plenty for real use, but one
// account cannot fill the server's disk.
export const DAILY_UPLOADS_PER_STUDENT = 40;

const PROJECT_FOLDERS = ['events', 'highlights', 'inventory', 'cms', 'photos', 'videos', 'posters', 'covers', 'gallery', 'reviews'] as const;

// Allowed site media: content type -> [stored extension, size limit].
const PROJECT_TYPES: Record<string, [string, number]> = {
  'image/png': ['png', 10 * MB],
  'image/jpeg': ['jpg', 10 * MB],
  'image/webp': ['webp', 10 * MB],
  'image/gif': ['gif', 10 * MB],
  'image/avif': ['avif', 10 * MB],
  'video/mp4': ['mp4', 50 * MB],
  'video/webm': ['webm', 50 * MB],
  'video/quicktime': ['mov', 50 * MB],
  'application/pdf': ['pdf', 20 * MB],
};

export const MAX_STL_BYTES = 50 * MB;
export const MAX_PCB_BYTES = 50 * MB;
// PCB design files as the PCB page accepts them (Gerber archives and CAD boards).
const PCB_EXTENSIONS = /\.(zip|rar|7z|gbr|gerber|pcb|kicad_pcb|brd)$/i;

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function storageRoutes(deps: Deps, guards: Guards): Router {
  const router = Router();
  const tickets = collection(deps.db, 'upload_tickets');

  router.post('/uploads', guards.requireAuth, async (req, res) => {
    const principal = principalOf(req);
    const input = body(req);
    const bucket = oneOf(input.bucket, 'bucket', ['projects', 'stl-files', 'pcb-files'] as const);
    if (!bucket) throw badRequest('bucket is required');
    const fileName = reqString(input.fileName, 'fileName', 255);
    const size = optNumber(input.size, 'size', { min: 1, max: 100 * MB, integer: true });

    let key: string;
    let contentType: string;
    let maxBytes: number;
    if (bucket === 'stl-files') {
      if (!/\.stl$/i.test(fileName)) throw badRequest('Only .stl files can be uploaded');
      const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(-150);
      // Scoped to the uploader so print orders can check ownership of the path.
      key = `${principal.id}/${Date.now()}_${safeName}`;
      contentType = 'model/stl';
      maxBytes = MAX_STL_BYTES;
    } else if (bucket === 'pcb-files') {
      if (!PCB_EXTENSIONS.test(fileName)) throw badRequest('Upload a .zip, .rar, .7z, Gerber or PCB design file');
      const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, '_').slice(-150);
      // Private and scoped to the uploader, like 3D models.
      key = `${principal.id}/${Date.now()}_${safeName}`;
      contentType = 'application/octet-stream';
      maxBytes = MAX_PCB_BYTES;
    } else {
      const folder = oneOf(input.folder ?? 'cms', 'folder', [...PROJECT_FOLDERS, 'avatars'] as const)!;
      // Everyone may upload their own profile photo; everything else is staff-only.
      const isAvatar = folder === 'avatars';
      if (!isAvatar && !isStaff(principal)) throw forbidden('Only staff can upload site content');
      contentType = String(input.contentType ?? '').toLowerCase();
      const rule = PROJECT_TYPES[contentType];
      if (!rule || (isAvatar && !contentType.startsWith('image/'))) {
        throw badRequest(`Unsupported file type: ${contentType || 'unknown'}`);
      }
      // Stored extension comes from the checked type, never from the client's file name.
      const name = `${randomBytes(8).toString('hex')}-${Date.now()}.${rule[0]}`;
      key = isAvatar ? `avatars/${principal.id}-${name}` : `${folder}/${name}`;
      maxBytes = isAvatar ? 2 * MB : rule[1];
    }
    if (size && size > maxBytes) throw badRequest(`File must be ${maxBytes / MB} MB or smaller`);
    assertKey(key);

    if (!isStaff(principal)) {
      const day = new Date().toISOString().slice(0, 10);
      const quota = await collection(deps.db, 'upload_quota').findOneAndUpdate(
        { _id: `${principal.id}|${day}` },
        { $inc: { count: 1 }, $setOnInsert: { expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) } },
        { upsert: true, returnDocument: 'after' },
      );
      if ((quota?.count ?? 0) > DAILY_UPLOADS_PER_STUDENT) {
        throw new HttpError(429, 'Daily upload limit reached. Please try again tomorrow or contact the lab.');
      }
    }

    const token = randomBytes(24).toString('base64url');
    await tickets.insertOne({
      _id: sha256(token),
      bucket,
      key,
      content_type: contentType,
      max_bytes: maxBytes,
      owner_id: principal.id,
      expires_at: new Date(Date.now() + TICKET_TTL_MS),
      created_at: nowIso(),
    });
    res.json({
      bucket,
      path: key,
      uploadUrl: `/api/uploads/${token}`,
      contentType,
      publicUrl: bucket === 'projects' ? `/files/projects/${key}` : null,
    });
  });

  // Signed, expiring download links for private files (staff downloading student models).
  router.get('/files/:bucket/*key', async (req, res) => {
    const bucket = oneOf(req.params.bucket, 'bucket', ['stl-files', 'pcb-files'] as const) as Bucket;
    const key = assertKey((req.params as unknown as { key: string[] }).key.join('/'));
    if (!verifyDownloadSignature(deps.config.jwtSecret, bucket, key, req.query.expires, req.query.sig)) {
      throw forbidden('This download link is invalid or has expired');
    }
    const size = await deps.files.size(bucket, key);
    if (size === null) throw notFound('File not found');
    const downloadName = key.split('/').pop()!.replace(/^\d+_/, '');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(size));
    res.attachment(downloadName);
    await pipeline(deps.files.stream(bucket, key), res);
  });

  return router;
}

// PUT /api/uploads/:token — mounted before the JSON body parser so the raw file stream
// reaches the handler untouched.
export function uploadReceiver(deps: Deps, guards: Guards): RequestHandler[] {
  const tickets = collection(deps.db, 'upload_tickets');
  const handler: RequestHandler = async (req, res) => {
    const principal = principalOf(req);
    const token = String(req.params.token ?? '');
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw notFound('Upload link not found');
    const ticket = await tickets.findOne({ _id: sha256(token) });
    if (!ticket || ticket.expires_at < new Date()) throw notFound('This upload link is invalid or has expired');
    if (ticket.owner_id !== principal.id) throw forbidden();
    // Single use: claim it before writing.
    if (!(await tickets.findOneAndDelete({ _id: ticket._id }))) throw notFound('This upload link was already used');

    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > ticket.max_bytes) {
      throw new HttpError(413, `File must be ${Math.floor(ticket.max_bytes / MB)} MB or smaller`);
    }
    const bucket = ticket.bucket as Bucket;
    const bytes = await deps.files.write(bucket, ticket.key, req, ticket.max_bytes);
    if (!(await matchesContentType(deps.files, bucket, ticket.key, ticket.content_type))) {
      await deps.files.remove(bucket, ticket.key);
      throw badRequest('The file content does not match its type');
    }
    res.status(201).json({
      path: ticket.key,
      size: bytes,
      publicUrl: bucket === 'projects' ? `/files/projects/${ticket.key}` : null,
    });
  };
  return [guards.requireAuth, handler];
}

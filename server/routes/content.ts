import { Router } from 'express';
import { collection, newId, nowIso, toApi, toApiList } from '../db.js';
import type { Deps } from '../deps.js';
import { principalOf, type Guards } from '../lib/auth.js';
import {
  HttpError,
  assertSafeValue,
  badRequest,
  body,
  idParam,
  isPlainObject,
  notFound,
  optString,
  reqString,
  stripProtected,
} from '../lib/http.js';
import { ACCESS } from '../lib/roles.js';

// Content is edited only by trusted staff and its fields are managed from the dashboard,
// so the API forwards fields except ones that must stay server-controlled.
const SERVER_FIELDS = ['id', 'created_at'];
const EVENT_SERVER_FIELDS = [...SERVER_FIELDS, 'registered_count'];

function eventPayload(input: Record<string, any>) {
  const out = stripProtected(input, EVENT_SERVER_FIELDS);
  // The dashboard sends banner_url; the field is banner_image.
  if (out.banner_url !== undefined) {
    if (out.banner_image === undefined) out.banner_image = out.banner_url;
    delete out.banner_url;
  }
  return out;
}

export function contentRoutes(deps: Deps, guards: Guards): Router {
  const router = Router();
  const { db } = deps;
  const gallery = collection(db, 'gallery');
  const projects = collection(db, 'lab_projects');
  const events = collection(db, 'events');
  const registrations = collection(db, 'event_registrations');
  const cmsPages = collection(db, 'cms_pages');
  const pdfReviews = collection(db, 'pdf_reviews');
  const contentWrite = guards.requireStaff(...ACCESS.contentWrite);
  const eventsWrite = guards.requireStaff(...ACCESS.eventsWrite);

  const created = (fields: Record<string, any>) => ({ _id: newId(), ...fields, created_at: nowIso() });

  /* ---------------- Gallery ---------------- */

  router.get('/gallery', async (_req, res) => {
    res.json(toApiList(await gallery.find({}).sort({ created_at: -1 }).toArray()));
  });

  router.post('/gallery', contentWrite, async (req, res) => {
    if (Array.isArray(req.body)) {
      if (req.body.length === 0 || req.body.length > 100) throw badRequest('Upload 1 to 100 items at a time');
      const docs = req.body.map((item: unknown) => {
        if (!isPlainObject(item)) throw badRequest('Each gallery item must be an object');
        return created(stripProtected(item, SERVER_FIELDS));
      });
      await gallery.insertMany(docs);
      return res.status(201).json(toApiList(docs));
    }
    const doc = created(stripProtected(body(req), SERVER_FIELDS));
    await gallery.insertOne(doc);
    res.status(201).json(toApi(doc));
  });

  router.put('/gallery/:id', contentWrite, async (req, res) => {
    const doc = await gallery.findOneAndUpdate(
      { _id: idParam(req.params.id) },
      { $set: stripProtected(body(req), SERVER_FIELDS) },
      { returnDocument: 'after' },
    );
    if (!doc) throw notFound('Gallery item not found');
    res.json(toApi(doc));
  });

  router.delete('/gallery/:id', contentWrite, async (req, res) => {
    const { deletedCount } = await gallery.deleteOne({ _id: idParam(req.params.id) });
    if (!deletedCount) throw notFound('Gallery item not found');
    res.json({ message: 'Deleted' });
  });

  /* ---------------- Projects ---------------- */

  router.get('/projects', async (_req, res) => {
    res.json(toApiList(await projects.find({}).sort({ created_at: -1 }).toArray()));
  });

  router.get('/projects/:id', async (req, res) => {
    const doc = await projects.findOne({ _id: idParam(req.params.id) });
    if (!doc) throw notFound('Project not found');
    res.json(toApi(doc));
  });

  router.post('/projects', contentWrite, async (req, res) => {
    const payload = stripProtected(body(req), SERVER_FIELDS);
    if (payload.image && !payload.image_url) payload.image_url = payload.image;
    const doc = created(payload);
    await projects.insertOne(doc);
    res.status(201).json(toApi(doc));
  });

  router.put('/projects/:id', contentWrite, async (req, res) => {
    const doc = await projects.findOneAndUpdate(
      { _id: idParam(req.params.id) },
      { $set: stripProtected(body(req), SERVER_FIELDS) },
      { returnDocument: 'after' },
    );
    if (!doc) throw notFound('Project not found');
    res.json(toApi(doc));
  });

  router.delete('/projects/:id', contentWrite, async (req, res) => {
    const { deletedCount } = await projects.deleteOne({ _id: idParam(req.params.id) });
    if (!deletedCount) throw notFound('Project not found');
    res.json({ message: 'Deleted' });
  });

  /* ---------------- Events ---------------- */

  router.get('/events', async (_req, res) => {
    res.json(toApiList(await events.find({}).sort({ created_at: -1 }).toArray()));
  });

  router.post('/events', eventsWrite, async (req, res) => {
    const payload = eventPayload(body(req));
    reqString(payload.title, 'title', 300);
    const doc = created({ ...payload, registered_count: 0 });
    await events.insertOne(doc);
    res.status(201).json(toApi(doc));
  });

  // Declared before /events/:id.
  router.post('/events/register', guards.requireAuth, async (req, res) => {
    const principal = principalOf(req);
    const input = body(req);
    const eventId = idParam(input.event_id, 'event_id');

    const event = await events.findOne({ _id: eventId });
    if (!event) throw notFound('Event not found');
    // No sign-ups for events that are over or called off.
    const lastDay = String(event.end_date || event.start_date || event.date || '').slice(0, 10);
    const todayInIndia = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (['cancelled', 'completed', 'past'].includes(String(event.status ?? '').toLowerCase()) || (lastDay && lastDay < todayInIndia)) {
      throw new HttpError(409, 'Registration for this event has closed');
    }
    const email = principal.email.toLowerCase();
    if (await registrations.findOne({ event_id: eventId, $or: [{ user_id: principal.id }, { email }] })) {
      throw new HttpError(409, 'You are already registered for this event');
    }

    const registration = created({
      event_id: eventId,
      user_id: principal.id,
      email,
      name: reqString(input.name ?? principal.name, 'name', 100),
      degree: optString(input.degree, 'degree', 100) ?? null,
      program: optString(input.program, 'program', 100) ?? null,
      srn: optString(input.srn, 'srn', 32) ?? null,
      phone_number: optString(input.phone_number, 'phone_number', 20) ?? null,
    });

    // Reserve a seat atomically so two people cannot take the last one.
    const max = Number(event.max_attendees) || 0;
    const reserved = await events.findOneAndUpdate(
      max > 0
        ? { _id: eventId, $or: [{ registered_count: { $lt: max } }, { registered_count: { $exists: false } }, { registered_count: null }] }
        : { _id: eventId },
      { $inc: { registered_count: 1 } },
    );
    if (!reserved) throw new HttpError(409, 'This event is full');
    try {
      await registrations.insertOne(registration);
    } catch (err: any) {
      await events.updateOne({ _id: eventId }, { $inc: { registered_count: -1 } });
      if (err?.code === 11000) throw new HttpError(409, 'You are already registered for this event');
      throw err;
    }
    res.status(201).json(toApi(registration));
  });

  // Registration totals per event for the event manager dashboard.
  router.get('/events/registration-counts', eventsWrite, async (_req, res) => {
    const rows = await registrations
      .aggregate<{ _id: string; count: number }>([{ $group: { _id: '$event_id', count: { $sum: 1 } } }])
      .toArray();
    res.json(Object.fromEntries(rows.map((r) => [r._id, r.count])));
  });

  // Whether the signed-in user is registered for this event.
  router.get('/events/:id/registration', guards.requireAuth, async (req, res) => {
    const principal = principalOf(req);
    const found = await registrations.findOne({
      event_id: idParam(req.params.id),
      $or: [{ user_id: principal.id }, { email: principal.email.toLowerCase() }],
    });
    res.json({ registered: Boolean(found) });
  });

  router.get('/events/:id/registrations', eventsWrite, async (req, res) => {
    const docs = await registrations.find({ event_id: idParam(req.params.id) }).sort({ created_at: -1 }).toArray();
    res.json(toApiList(docs));
  });

  router.get('/events/:id', async (req, res) => {
    const doc = await events.findOne({ _id: idParam(req.params.id) });
    if (!doc) throw notFound('Event not found');
    res.json(toApi(doc));
  });

  router.put('/events/:id', eventsWrite, async (req, res) => {
    const doc = await events.findOneAndUpdate(
      { _id: idParam(req.params.id) },
      { $set: { ...eventPayload(body(req)), updated_at: nowIso() } },
      { returnDocument: 'after' },
    );
    if (!doc) throw notFound('Event not found');
    res.json(toApi(doc));
  });

  router.delete('/events/:id', eventsWrite, async (req, res) => {
    const id = idParam(req.params.id);
    const { deletedCount } = await events.deleteOne({ _id: id });
    if (!deletedCount) throw notFound('Event not found');
    await registrations.deleteMany({ event_id: id });
    res.json({ message: 'Deleted' });
  });

  /* ---------------- CMS pages ---------------- */

  router.get('/cms-pages', async (req, res) => {
    const name = optString(req.query.name, 'name', 100);
    if (name) {
      const doc = await cmsPages.findOne({ page_name: name }, { projection: { content: 1 } });
      return res.json({ content: doc?.content ?? {} });
    }
    res.json(toApiList(await cmsPages.find({}).toArray()));
  });

  router.post('/cms-pages', contentWrite, async (req, res) => {
    const editor = principalOf(req);
    const input = body(req);
    const pageName = reqString(input.page_name, 'page_name', 100);
    if (!isPlainObject(input.content) && !Array.isArray(input.content)) {
      throw badRequest('content must be a JSON object');
    }
    assertSafeValue(input.content, 'content');
    const doc = await cmsPages.findOneAndUpdate(
      { page_name: pageName },
      {
        $set: { content: input.content, updated_by: editor.id, updated_at: nowIso() },
        $setOnInsert: { _id: newId(), created_at: nowIso() },
      },
      { upsert: true, returnDocument: 'after' },
    );
    res.json(toApi(doc));
  });

  /* ---------------- PDF reviews ---------------- */

  router.get('/pdf-reviews', contentWrite, async (req, res) => {
    const principal = principalOf(req);
    // Admins review everything; ambassadors see what they submitted. The client's
    // isAdmin/staffId query parameters are ignored.
    const filter = principal.role === 'ADMIN' ? {} : { uploaded_by: principal.id };
    res.json(toApiList(await pdfReviews.find(filter).sort({ created_at: -1 }).toArray()));
  });

  router.post('/pdf-reviews', contentWrite, async (req, res) => {
    const uploader = principalOf(req);
    const payload = stripProtected(body(req), [
      ...SERVER_FIELDS,
      'status',
      'admin_notes',
      'reviewed_at',
      'reviewed_by',
      'uploaded_by',
      'uploader_name',
    ]);
    const doc = created({ ...payload, uploaded_by: uploader.id, uploader_name: uploader.name, status: 'pending' });
    await pdfReviews.insertOne(doc);
    res.status(201).json(toApi(doc));
  });

  router.put('/pdf-reviews/:id', guards.requireStaff(), async (req, res) => {
    const reviewer = principalOf(req);
    if (reviewer.role !== 'ADMIN') throw new HttpError(403, 'Only administrators can review documents');
    const input = body(req);
    const status = reqString(input.status, 'status', 32);
    if (!/^[a-z_]+$/.test(status)) throw badRequest('Invalid status');
    const doc = await pdfReviews.findOneAndUpdate(
      { _id: idParam(req.params.id) },
      {
        $set: {
          status,
          admin_notes: optString(input.admin_notes, 'admin_notes', 5000) ?? null,
          reviewed_at: nowIso(),
          reviewed_by: reviewer.id,
        },
      },
      { returnDocument: 'after' },
    );
    if (!doc) throw notFound('Review not found');
    res.json(toApi(doc));
  });

  return router;
}

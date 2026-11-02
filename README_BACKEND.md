# Backend (API)

An Express server in `server/` serves `/api/*`, uploaded files under `/files/projects/*`,
and the built frontend. Data is in MongoDB; uploaded files are on the server's disk.
Deployment: [DEPLOYMENT.md](./DEPLOYMENT.md). Testing: [TESTING.md](./TESTING.md).

```
server/
  index.ts            entry point (config check, MongoDB connection, graceful shutdown)
  app.ts              middleware (helmet + CSP, CORS, rate limits, body limits) + static hosting
  config.ts           environment variables
  db.ts               MongoDB connection, collections, indexes
  deps.ts             database, file store, mailer (Amazon SES), Razorpay
  lib/                auth guards, sessions, passwords, storage, STL pricing, validation
  routes/             auth, microsoft + google (sign-in), signins (log), admin, lab, content, print, payments, storage
  test/               API, security and migration tests (real MongoDB)
scripts/
  create-admin.ts     create or reset the emergency administrator (password) login
  mock-microsoft.ts   local stand-in for Microsoft sign-in (testing only)
  seed-demo.ts        demo accounts + sample content for local testing (refuses production)
  migrate-from-supabase.ts   one-time copy of the old Supabase data and files
```

## Accounts and sign-in

- **Everyone signs in with Microsoft** (REVA's tenant, `@reva.edu.in` only), in
  `routes/microsoft.ts`: `GET /api/auth/microsoft/start?portal=student|staff` → Microsoft →
  `GET /api/auth/microsoft/callback` → `/auth/complete#code=…` →
  `POST /api/auth/microsoft/complete`. Authorization-code flow with PKCE, a state cookie
  bound to the browser, and the ID token checked against Microsoft's keys, issuer, tenant,
  client id and nonce (`lib/microsoft.ts`).
- **Students** get an account on their first sign-in (existing accounts are matched by
  email). **Staff** must first be added by an admin (`POST /api/auth/create-staff`,
  `@reva.edu.in` only, no password).
- **Emergency administrator**: the only password account, created with `create-admin`.
  `POST /api/auth/staff-login` (ADMIN accounts with a password only; scrypt; 10 wrong
  passwords lock it for 15 minutes), `forgot-password` / `reset-password` (1 hour, single
  use), `change-password`.
- **Google sign-in (visitors)**, in `routes/google.ts`: `GET /api/auth/google/start` →
  Google → `GET /api/auth/google/callback` → `/auth/complete#code=…` (same completion step as
  Microsoft). Any Google account with a verified email, student page only, **general access**
  (`type: non-university`: no component borrowing, enforced on `POST /api/indents`).
  `@reva.edu.in` addresses are sent to Microsoft. Off unless `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET` are set.
- **Sign-in log**: every attempt, successful or refused, is written to `login_events` in a
  separate audit database with time, email, account, role, IP, browser and a SHA-256
  fingerprint of the provider's ID token: Microsoft and password sign-ins in
  `MONGODB_AUDIT_DB` (default `idealab_audit`), Google sign-ins in `MONGODB_GOOGLE_AUDIT_DB`
  (default `idealab_audit_google`). The app's MongoDB user can only insert and read there;
  the admin views combine both (filter `method=microsoft|google|password`). `GET /api/admin/sign-ins/summary`, `GET /api/admin/sign-ins` and
  `GET /api/admin/sign-ins/export` (CSV) for ADMIN and TECH_SUPPORT.
- Sessions are HS256 tokens (`JWT_SECRET`). `POST /api/auth/logout-all` (and an admin
  password change) ends all other sessions. The caller is reloaded from the database on
  every request, so role changes and removals apply immediately.

## Who can call what

ADMIN can do everything. "Any" means any signed-in user or staff member; "own" means
students only see their own records.

| Area | Read | Write |
| --- | --- | --- |
| Events, projects, gallery, CMS pages, lab closures, print materials | public | events and closures: LAB, EVENT_MANAGER · content: AMBASSADOR · materials: LAB |
| Event registration | own status: any · participant lists and counts: LAB, EVENT_MANAGER | register: any (seats reserved atomically) |
| Slot bookings | any (own) · staff see all · public calendar shows date, times, status and purpose but not who booked | create: any (**one booking per time slot for the whole lab**) · cancel own upcoming: owner · approve/reject: LAB, EVENT_MANAGER |
| Indents | any (own) · staff see all | create: university accounts (priced on the server) |
| PCB orders | any (own) · staff see all | create: any (priced on the server; pay online or at the lab) · status, record lab payment, download design files: LAB |
| 3D print orders | any (own) · LAB sees all | create: any (priced on the server from the STL) · status, STL download: LAB |
| Inventory | any | LAB |
| Users and staff | TECH_SUPPORT | TECH_SUPPORT (only ADMIN can create or manage admins) |
| Sign-in log (counts, list, CSV) | TECH_SUPPORT | nobody (append-only, written by the server) |
| Activity history | TECH_SUPPORT, LAB | any staff |
| PDF reviews | AMBASSADOR (own) · ADMIN all | submit: AMBASSADOR · review: ADMIN |
| Uploads (`POST /api/uploads`) | | 3D models and PCB design files: any (private, stored under the uploader) · own profile photo: any · site media: staff |
| Payments (3D prints, PCB orders) | | create order and verify: the order's owner · webhook: Razorpay signature |

**Double booking.** Lab slots: each booking claims its half-hour cells in `slot_cells`,
whose unique ids make overlapping bookings impossible even when requests arrive at the
same moment (Full Day overlaps Morning/Afternoon/Evening; rejecting or cancelling frees
the time; re-opening a booking must win the time back). Events: one registration per
student (unique index) and seats reserved atomically; no sign-ups after the event ends or
if it is cancelled.

**Payments.** 3D print and PCB orders are priced on the server. Online orders wait in
`pending_payment` for up to 30 minutes, then are cancelled. `POST /api/payments/print-orders/:id/order`
or `/pcb-orders/:id/order` creates the Razorpay order for the stored amount (notes carry
`print_order_id` / `pcb_order_id`); `/api/payments/verify` and the webhook check Razorpay's
signature and the amount, and mark the order paid exactly once (a paid PCB order moves to
`queued`). "Pay at Lab" PCB orders are queued unpaid and staff record the payment.

## Files

`POST /api/uploads` checks who may upload what and returns a one-time upload URL
(15 minutes). The browser then `PUT`s the raw file to it; size limits are enforced while
streaming and images/PDFs/videos must match their declared type. Site media is public
at `/files/projects/...` (served with `nosniff` and a locked-down CSP); student 3D models
are private and staff download them through signed links that expire after 5 minutes.

## Development

```bash
npm run dev:server   # API on :3001 with reload (needs .env and a MongoDB)
npm run dev          # Vite on :3000, proxies /api to :3001
npm test             # tests against TEST_MONGODB_URI (default mongodb://127.0.0.1:27017)
npm run typecheck
```

# Security review

Scope: the whole repository after the move to AWS + MongoDB (API in `server/`, frontend in
`src/`, deployment files in `deploy/`, `Dockerfile`, `docker-compose.yml`). How to repeat the
checks yourself: [TESTING.md](./TESTING.md).

## Result

No known open vulnerabilities. Everything the site needs (web server, API, database, file
storage, email) runs on the AWS server or in AWS (Amazon SES). Outside AWS there are only
REVA's own Microsoft 365, for sign-in, and Razorpay, when a student pays for a print.

| Check | Result |
| --- | --- |
| `npm audit` (all dependencies) | 0 vulnerabilities |
| Automated tests (`npm test`, real MongoDB + Postgres, 113 tests) | all pass: Microsoft sign-in (against a mock that signs real tokens), sign-in log, emergency admin, per-role permissions, data isolation, injection, uploads, payments, rate limits, headers, DoS, migration |
| Static analysis (Semgrep rules for Express/Node/JWT/NoSQL, eslint-plugin-security) | 1 real finding (regex DoS in PCB dimensions), fixed and tested; the rest false positives (validated file paths, test fixtures, the mock's test-only client secret) |
| API fuzzing: 7,425 hostile requests across every route + 5,325 against the sign-in and sign-in-log routes (anonymous, student, and staff roles) | 0 server errors, 0 permission bypasses, 0 open redirects |
| Browser end-to-end runs (every page and role, then the Microsoft sign-in flows and the Sign-in Log) | all pass; no requests leave the server except Razorpay checkout and Microsoft sign-in |
| Docker Compose / MongoDB permissions | MongoDB requires a password and is not published; the app user can read/write the portal database, and on the sign-in log database can only add and read (update, delete, drop all refused, tested) |

## What is in place

**Sign-in (Microsoft for REVA, Google for visitors, or email + password)**
- Staff sign in with their REVA Microsoft account only. Students can use Microsoft, and
  anyone can use Google (visitors) or an email + password account on the student portal.
- **Email + password accounts** (student portal only, never staff):
  - Sign-up creates nothing until the person opens the link emailed to them (24 hours,
    single use, stored as SHA-256) **and** types the password they chose. So nobody can
    sign up with someone else's address, and the owner of an address can't be tricked into
    activating an account whose password another person knows.
  - A confirmed `@reva.edu.in` mailbox gets university access; any other address gets
    general access, like Google visitors.
  - Sign-up gives the same answer for new and taken addresses (the owner of a taken one is
    emailed instead), and takes the same time; at most one email per address per minute;
    5 wrong passwords kill a sign-up link.
  - scrypt hashing; at least 8 characters, common passwords and the email itself refused;
    10 wrong passwords lock the account for 15 minutes; wrong password, unknown email and
    Microsoft/Google-only accounts get the same answer.
  - Forgot password: single use 1-hour link, only for accounts that have a password, same
    answer for every address; a reset or password change signs out every other session.
  - A student password never works on the staff sign-in, even for an address on the staff list.
- **Google sign-in** (student page only) is for visitors from outside REVA and gives
  **general access**: public services, 3D printing and PCB orders, but not component
  borrowing (refused by the server, not just hidden). Same protections as Microsoft: server
  side code flow with PKCE and client secret; the ID token must be signed by Google's keys,
  issued by Google, for this app, fresh, with the one-time nonce, and with an email Google
  has verified. `@reva.edu.in` addresses (and REVA Google Workspace accounts) are refused
  and sent to Microsoft, so university access only ever comes from Microsoft. Existing
  accounts are matched by email and pinned to the Google account id (`sub`).
- OpenID Connect authorization-code flow with PKCE, handled on the server with a client
  secret. The ID token must be signed by one of Microsoft's published keys (RS256), be for this
  app (audience), come from REVA's tenant (issuer and `tid`), be fresh, and carry the one-time
  nonce. The email must end in `@reva.edu.in`.
- Login CSRF protection: the sign-in state is single use, expires after 10 minutes and must
  match an HttpOnly, SameSite cookie set in the same browser. The session is handed over as a
  one-time, 2-minute code in the URL fragment (never in server or proxy logs).
  Only same-site `next` paths are accepted (no open redirects).
- Students get an account on first sign-in; existing (migrated) accounts are matched by email
  and then pinned to that Microsoft identity (`oid`), so a re-used email cannot take over an
  old account. Staff must be added by an administrator, and disabled staff are refused.
- **Emergency administrator**: the only staff password account (made with `create-admin`),
  so the portal stays manageable if Microsoft sign-in breaks. scrypt hashing; 10 wrong
  passwords lock it for 15 minutes; the form gives the same answer for unknown emails,
  students and non-admin staff; reset links are single use, 1 hour, stored as SHA-256.
- Session tokens: HS256 only (algorithm pinned), `JWT_SECRET` of 32+ characters required,
  7 day expiry. "Sign out everywhere" (and an admin password change) invalidates every older
  token. The user is re-read from the database on every request, so a deleted, demoted or
  un-verified staff account loses access immediately.

**Sign-in log (count and proof of use)**
- Every attempt, successful or refused, is written to `login_events` in a separate database
  before a session is issued (Microsoft and emergency-password sign-ins in `idealab_audit`,
  Google sign-ins in their own `idealab_audit_google`, email + password sign-ins and sign-ups in
  `idealab_audit_password`, for separate monitoring): time, student/staff, method, result and
  reason, email, name, role, account id, IP address and browser, and for Microsoft sign-ins
  the person's directory object id, the tenant, the token's issue time and a SHA-256
  fingerprint of the exact ID token Microsoft issued (for Google: the Google account id,
  whether Google verified the email, the Workspace domain if any, and the token fingerprint).
- The app's MongoDB user can only **insert and read** in those databases; update, delete and
  drop are refused by MongoDB itself, so the portal (or anyone who compromised it) cannot
  alter the record. Only the MongoDB root account, which the app does not use, could.
- Admins and tech support see counts (unique students/staff, sign-ins per day, refused
  attempts), a searchable list and a CSV export. CSV cells that look like spreadsheet
  formulas are neutralised.

**Permissions**
- Every write route checks the role on the server (table in README_BACKEND.md). Students only
  ever receive their own bookings, indents, orders and registrations; the public slot
  calendar hides who booked. Only ADMIN can create or change ADMIN accounts.
- Prices (3D prints from the uploaded STL, PCB orders, indents) are calculated on the server;
  amounts sent by the browser are ignored.
- Payments (3D prints and PCB orders): Razorpay orders are created on the server for the
  stored amount and verified on the server (HMAC signature and amount); the webhook checks
  its own signature; an order can only be marked paid once; unpaid online orders expire
  after 30 minutes. PCB design files are private uploads, downloaded by lab staff only
  through 5-minute signed links.
- No double booking: a lab time slot can only be held by one booking, enforced by unique
  database keys (safe against simultaneous requests); event seats are reserved atomically
  and each student can register once.
- Fair use: only REVA students and staff can book the lab (visitors signed in with Google
  cannot); a student can hold at most 3 upcoming bookings, at most 60 days ahead.
- Staff cannot move an unpaid online order (3D print or PCB) into the queue or mark it
  paid by hand; it can only be rejected. Payment comes only from Razorpay's verified
  callback or webhook.

**Input handling**
- MongoDB injection: request bodies and query strings are rejected if any key starts with `$`,
  contains `.`, or is `__proto__`/`constructor`/`prototype`; ids must match a fixed pattern;
  fields are checked for type and length. Protected fields (`_id`, owner, role, status,
  price...) cannot be set by clients.
- JSON bodies are limited to 2 MB. Regexes are bounded (the PCB one was the only unsafe one).

**Files**
- Uploads go through a one-time, 15 minute ticket that fixes the folder, file type and
  maximum size (images 10 MB, profile photos 2 MB, PDFs 20 MB, video 50 MB, STL 50 MB).
  Size is enforced while streaming; images, PDFs and videos must match their real file
  signature. File names are generated by the server (no path traversal).
- Each student can upload at most 40 files a day (staff unlimited), so the disk cannot be
  filled by one account.
- Public site media is served with `nosniff` and a CSP that blocks scripts. Student STL files
  are private; staff download them through signed links that expire after 5 minutes.

**HTTP**
- helmet: strict Content-Security-Policy (scripts only from this site and Razorpay checkout;
  no inline scripts, no plugins, no framing by other sites), HSTS, `X-Frame-Options`,
  `nosniff`, `Referrer-Policy`, no `X-Powered-By`. API responses are `no-store`.
- Rate limits per client IP: 6,000 API requests/minute (high on purpose: the whole campus
  Wi-Fi reaches the site from a few shared IPs), 60/minute on the emergency-admin sign-in, password
  reset and payment routes, 300/minute on email + password sign-in and sign-up (both configurable). Microsoft/Google sign-in is not throttled
  per IP, so one busy classroom cannot lock out the rest of campus. nginx forwards the real client IP, and only proxies on the
  server's own/private network are trusted, so clients cannot fake their IP.
- nginx does not reveal its version (`server_tokens off`).
- CORS is closed by default (the site and API share one origin).
- Errors return generic messages; stack traces are only logged on the server.

**Server**
- Docker image runs as the unprivileged `node` user; MongoDB is only reachable inside the
  Docker network and uses a least-privilege application user (append-only on the sign-in
  log); the app listens on
  127.0.0.1 behind nginx with TLS (Let's Encrypt).
- Email uses the EC2 instance's IAM role for SES, so no AWS keys are stored on disk.
- Nightly backups of MongoDB and uploads (`deploy/backup.sh`), optionally copied to S3.

## Things you must do

1. **Rotate the old secrets.** The tracked `.env` file (and git history) still holds values
   from the old setup: `JWT_SECRET`, `SUPABASE_URL`, `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `DATABASE_URL`, `VITE_FIREBASE_*` and
   `FIREBASE_SERVICE_ACCOUNT_KEY`. The new code uses none of them, except the names
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: use a **new** Google OAuth client (or at least
   a new secret) for Google sign-in, never the exposed old values. After running the data
   migration (DEPLOYMENT.md section 7): delete the Supabase project, the Firebase service
   account and the Google OAuth client, then `git rm --cached .env` and commit. On the
   server, generate a new `JWT_SECRET` (`openssl rand -hex 32`); never reuse the old one.
2. Keep `.env` on the server at `chmod 600`, and keep ports 22 (your IP only), 80 and 443 as
   the only open ports in the EC2 security group.
3. Register the portal in REVA's Microsoft Entra ID as a **single-tenant** app (DEPLOYMENT.md
   section 3), keep `MS_CLIENT_SECRET` only in the server's `.env`, and renew it before it
   expires. Keep the emergency administrator's password in a password manager.
4. Set `EMAIL_FROM` to an SES-verified address (used for the emergency administrator's
   password-reset link); otherwise that email is only written to the server log.

## Known limitations (accepted)

- Session tokens are kept in the browser's `localStorage`. The strict CSP makes script
  injection very hard, but a successful one could read the token. Tokens expire after 7 days
  (`JWT_EXPIRES_IN`) and "Sign out everywhere" revokes them.
- Two-factor authentication is whatever REVA's Microsoft 365 enforces (MFA / conditional
  access policies apply to this sign-in automatically). The emergency administrator
  password has no second factor, so keep it long, secret and rarely used; its use is logged.
- The CSP allows images/video from any `https:` address (event banners and project links
  may point to other sites) and inline styles (used by the UI library). Neither allows
  running scripts.
- Rate limits are counted per app process. That is correct for the single container this
  project runs; if you ever run several, put the limit in nginx instead.
- Users moved from Supabase keep their accounts and data; they sign in with Microsoft and are
  matched by email. Old accounts with non-REVA emails (e.g. Gmail) stay in the database but
  can no longer sign in.
- The sign-in log records IP addresses and browsers of students and staff; that is personal
  data, so limit who has ADMIN/TECH_SUPPORT roles and agree a retention period with REVA
  (records are kept until deleted with the MongoDB root account).

# Testing after `git pull`

Everything below runs on your own computer; nothing needs Supabase, Firebase or Vercel.
You need **Git**, **Docker** and **Node.js 22**. On Windows, use **Git Bash**.

Students sign in with **Microsoft** (`@reva.edu.in`), **Google** (visitors) or an **email +
password** account; staff with Microsoft only, plus one emergency administrator password. Locally you test it with a **mock Microsoft** server that ships with the repo, so
you don't need REVA's Microsoft 365 setup to try everything.

## 1. Automated checks (about 2 minutes)

```bash
git pull
npm ci

# A throwaway MongoDB for the tests (and for trying the site locally)
docker run -d --name idealab-mongo -p 127.0.0.1:27017:27017 mongo:7

# Optional: Postgres, so the Supabase-migration test runs too
docker run -d --name idealab-pg -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 postgres:16-alpine
export TEST_PG_URL=postgresql://postgres:test@127.0.0.1:55432/postgres
# (PowerShell: $env:TEST_PG_URL="postgresql://postgres:test@127.0.0.1:55432/postgres")

npm run typecheck      # expect: no errors
npm test               # expect: "# pass 113" and "# fail 0"
npm run build          # expect: "built in ..." and no errors
npm audit              # expect: found 0 vulnerabilities
```

`npm test` covers, among others:
- Microsoft sign-in end to end against a mock that signs real tokens: only `@reva.edu.in`,
  only REVA's tenant; forged, wrong-app, replayed and email-less tokens refused; the sign-in
  must finish in the same browser; one-time codes; no open redirects.
- Staff portal: only staff added by an admin; disabled staff refused.
- Every attempt (success and failure) written to the separate sign-in log, with the
  Microsoft account id and a fingerprint of Microsoft's token; counts, filters, CSV export
  and who may see them.
- Emergency administrator password: lockout, reset link, change password, and that
  students/other staff can never use a password.
- Permissions for every role, NoSQL injection, uploads, payments, rate limits, security
  headers, the ReDoS fix, and the Supabase → MongoDB migration.

The same checks run on GitHub for every push (plus the Docker image build).

## 2. Run the site locally with demo data

Your current `.env` holds the old Supabase settings. Keep a copy for the one-time data
migration (section 7), then start a fresh one:
```bash
cp .env .env.supabase-old     # ignored by git
cp .env.example .env
```

**Terminal 1**, start the mock Microsoft:
```bash
npm run mock:microsoft
```
It prints four `MS_...` lines. Edit `.env` and set:
```
PUBLIC_URL=http://localhost:3001
JWT_SECRET=<output of: openssl rand -hex 32>
MONGODB_URI=mongodb://127.0.0.1:27017
MS_AUTHORITY=http://127.0.0.1:3999
MS_TENANT_ID=11111111-2222-3333-4444-555555555555
MS_CLIENT_ID=66666666-7777-8888-9999-000000000000
MS_CLIENT_SECRET=mock-microsoft-client-secret
```
(Leave `NODE_ENV` unset: the server refuses the mock when `NODE_ENV=production`.)

**Terminal 3 (optional)**, the mock Google, for visitor sign-in:
```bash
npm run mock:google
```
and add to `.env`:
```
GOOGLE_AUTHORITY=http://127.0.0.1:3998
GOOGLE_CLIENT_ID=mock-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=mock-google-client-secret
```
Without it, the Google button says Google sign-in is not set up; everything else works.

**Terminal 2**:
```bash
npm run build
npm run seed:demo      # demo accounts + sample content (never on production)
npm start              # http://localhost:3001
```

Demo accounts:

| Where | How | Email | Role |
| --- | --- | --- | --- |
| `/login` | Microsoft (mock) | `student@reva.edu.in`, or any new `@reva.edu.in` | Student |
| `/staff-login` | Microsoft (mock) | `demo-admin@reva.edu.in` | ADMIN |
| `/staff-login` | Microsoft (mock) | `demo-lab@reva.edu.in` | LAB |
| `/staff-login` | Microsoft (mock) | `demo-ambassador@reva.edu.in` | AMBASSADOR |
| `/staff-login` | Microsoft (mock) | `demo-events@reva.edu.in` | EVENT_MANAGER |
| `/staff-login` | Microsoft (mock) | `demo-tech@reva.edu.in` | TECH_SUPPORT |
| `/staff-login` → *Emergency administrator sign-in* | password `Demo-Pass-2026` | `admin@demo.local` | ADMIN |
| `/login` → email + password form | password `Demo-Pass-2026` | `visitor@demo.local` | Visitor (general access) |

On the mock Microsoft page you type any email and name, which stands in for picking a
Microsoft account. The real site shows Microsoft's own login page there.

## 3. Manual checklist

Keep Chrome DevTools open (F12) on the **Console** tab: no red errors on any page.

**Sign-in rules**
- [ ] `/login` has **Sign in with Microsoft**, **Sign in with Google**, and an email + password form.
- [ ] Email form: `visitor@demo.local` / `Demo-Pass-2026` → dashboard. A wrong password →
      "Invalid email or password".
- [ ] **Create one with your email** → name, `yourname@reva.edu.in`, a password → "Check your
      email". Locally no email is sent: the server window (Terminal 2) prints it with a
      `/verify-email?token=...` link. Open it, type a wrong password (refused), then yours →
      dashboard with **University** access. (A Gmail address gets General Access.)
- [ ] **Forgot password?** with that address → link printed in Terminal 2 → set a new
      password → sign in with it.
- [ ] Sign in as `student@reva.edu.in` → you land on the dashboard.
- [ ] Sign out, sign in as a new `yourname@reva.edu.in` → a new account is created.
- [ ] Sign in as `someone@gmail.com` → back on `/login` with "Only REVA University
      Microsoft accounts (@reva.edu.in) can sign in". No account is created.
- [ ] Press **Cancel** on the mock page → "Sign-in was cancelled."
- [ ] **Google** (mock Google running) as `visitor@gmail.com` → dashboard with **General
      Access**; the Component Catalog is not offered.
- [ ] Google as `student@reva.edu.in` → back on `/login` with "REVA accounts sign in with
      Microsoft". No account is created.
- [ ] `/staff-login` → Microsoft as `student@reva.edu.in` → "not on the staff list".
- [ ] `/staff-login` → Microsoft as `demo-lab@reva.edu.in` → staff dashboard (LAB tabs).
- [ ] `/staff-login` → *Emergency administrator sign-in* → `admin@demo.local` /
      `Demo-Pass-2026` → staff dashboard. Wrong password 10 times → locked for 15 minutes.
- [ ] Try the emergency form with `demo-lab@reva.edu.in` and any password → refused.

**Sign-in log (the count and proof)**
- [ ] As `admin@demo.local` (or `demo-tech@...`): Dashboard → **Sign-in Log** shows students
      and staff who signed in, total sign-ins, refused attempts, today, and a per-day table.
- [ ] The list shows every attempt above, including the Gmail and refused staff ones, with
      time, email, result and IP. Filters (email, type, method, result, dates) work; the
      **Google** method filter shows only Google sign-ins; **Email + password** only those
      (including a "Signed up" row).
- [ ] **Download CSV** gives a spreadsheet with the same rows, including `microsoft_oid`
      and `id_token_sha256` for Microsoft sign-ins.
- [ ] As `demo-lab@...` the Sign-in Log tab is not shown.

**Student features**
- [ ] Events → register for "Robotics Workshop" → "Registered Successfully".
- [ ] Components → add items → submit an indent → it shows on the dashboard.
- [ ] Slot booking → pick a date and **Morning** → shows as pending in Dashboard → Slot
      Bookings with its date and time.
- [ ] Sign in as a **second** student (another Incognito window, another @reva.edu.in email),
      open Slot booking on the same date: **Morning** and **Full Day** are greyed out
      "Booked"; Afternoon can be booked.
- [ ] Dashboard → Slot Bookings → **Cancel** a booking → the time becomes free again.
- [ ] Book a 4th upcoming slot → refused ("at most 3"); a date more than 60 days ahead
      can't be picked. Visitors signed in with Google don't see slot booking at all.
- [ ] Register for an event twice → the second time says you are already registered.
- [ ] 3D print → upload an `.stl` → price → *Generate Order* → pay (needs Razorpay test keys
      in `.env`; UPI `success@razorpay`) → order shows **Paid**.
- [ ] PCB order → upload a `.zip` → specifications → *Proceed to Review*:
      - **Pay Online** → *Confirm Order* → Razorpay → "Order Placed Successfully"; Dashboard →
        PCB Orders shows **Paid**.
      - **Pay at Lab** → *Confirm Order* → Dashboard shows **To pay at the lab**.
- [ ] Settings → change photo → *Save Changes*. Security shows "Signed in with your REVA
      Microsoft account" and no password form.

**Staff features (sign in as each demo role)**
- [ ] ADMIN sees every tab; LAB: print orders, inventory, events, history; AMBASSADOR:
      requests and CMS; EVENT_MANAGER: events; TECH_SUPPORT: requests, users, history, sign-in log.
- [ ] ADMIN → User Management → Add staff with a `@reva.edu.in` email (no password field) →
      that person can now sign in on `/staff-login` with Microsoft. A Gmail address is refused.
- [ ] LAB: change a print order status, download its STL, edit inventory and a material price.
- [ ] LAB → **PCB Orders**: both PCB orders listed; **Files** downloads the student's zip;
      **Mark paid** on the pay-at-lab order; **Start fabrication** → **Mark completed**.
- [ ] EVENT_MANAGER: create an event with a banner, add a lab closure, approve a booking.
- [ ] AMBASSADOR: upload a gallery photo and a project, edit a CMS page, submit a PDF.

## 4. Look at the sign-in logs in the database

```bash
docker exec -it idealab-mongo mongosh idealab_audit --quiet --eval '
  printjson(db.login_events.countDocuments({ outcome: "success" }));
  printjson(db.login_events.find({}, { _id: 0, at: 1, email: 1, account_kind: 1, outcome: 1, reason: 1 }).sort({ at: -1 }).limit(10).toArray())'
```

Google sign-ins are in their own database, `idealab_audit_google`:
```bash
docker exec -it idealab-mongo mongosh idealab_audit_google --quiet --eval 'printjson(db.login_events.find({}, {_id:0, at:1, email:1, outcome:1, reason:1}).sort({at:-1}).toArray())'
```

On the real server the app's MongoDB user can only **add** to this database; editing or
deleting records is refused (see SECURITY.md). To see that yourself with Docker Compose
(section 6):
```bash
docker compose exec mongo sh -c 'mongosh -u "$MONGO_APP_USER" -p "$MONGO_APP_PASSWORD" --authenticationDatabase "$MONGO_INITDB_DATABASE" "$MONGODB_AUDIT_DB" --eval "db.login_events.deleteMany({})"'
# expect: MongoServerError: not authorized ... to execute command { delete: "login_events" ... }
```

## 5. Security spot checks (with the site running)

```bash
curl -s -o /dev/null -w "%{http_code}\n" localhost:3001/api/users                 # 401
curl -s -o /dev/null -w "%{http_code}\n" localhost:3001/api/admin/sign-ins         # 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3001/api/auth/register  # 404 (no sign-up)
curl -sI localhost:3001/ | grep -iE "content-security|x-frame|nosniff"            # 3 headers
curl -s -X POST localhost:3001/api/auth/staff-login -H 'Content-Type: application/json' \
     -d '{"email":{"$gt":""},"password":{"$ne":""}}'                               # 400
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "localhost:3001/api/auth/microsoft/callback?code=x&state=y"   # 303 .../login?error=expired
curl -s localhost:3001/api/health                                                 # {"status":"ok","database":"ok"}
```

## 6. Production-like run with Docker Compose

```bash
cp .env.example .env    # PUBLIC_URL, JWT_SECRET, MONGO_ROOT_PASSWORD, MONGO_APP_PASSWORD,
                        # and the real MS_* values from REVA's Azure app registration
docker compose up -d --build
docker compose ps                    # app and mongo "healthy"
docker compose exec app node build/scripts/create-admin.js --email you@reva.edu.in --name "You"
curl -s localhost:3001/api/health
docker compose down                  # add -v to also delete the data volumes
```
Docker Compose runs with `NODE_ENV=production`, so it needs the real Microsoft settings
(the mock is refused). The emergency administrator works either way.

## 7. Supabase data migration (dry run)

Copy `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.supabase-old` into `.env`, and
add `SUPABASE_DB_URL` (Supabase → Project settings → Database → connection string; see
DEPLOYMENT.md section 7). Then:
```bash
npm run build && npm run migrate:supabase -- --dry-run
```
It prints how many rows and files it would copy, without writing anything. Migrated
students keep their data: their first Microsoft sign-in is matched by email.

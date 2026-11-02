# Deploying the IDEA Lab portal on AWS

Everything runs on one EC2 instance: the Node.js app and MongoDB in Docker, uploaded
files and the database on the instance's EBS disk, nginx in front for HTTPS, and Amazon
SES for email. Outside AWS there are only REVA's own Microsoft 365 (sign-in), Google
sign-in (visitors from outside REVA) and Razorpay (card/UPI payments).

```
browser ──HTTPS──> nginx (EC2) ──> app container :3001 ──> mongo container (not exposed)
   │                                    │                    ├── idealab        (portal data)
   │                                    │                    ├── idealab_audit         (Microsoft/password sign-in log, append-only)
   │                                    │                    └── idealab_audit_google  (Google sign-in log, append-only)
   │                                    ├── /data/uploads volume (site media, student 3D models)
   │                                    └── Amazon SES (sign-up confirmation and password reset emails)
   ├── login.microsoftonline.com (REVA Microsoft account sign-in)
   └── accounts.google.com (Google sign-in for visitors)
```

**Who can sign in:**
- **REVA students and staff:** Microsoft accounts from REVA's tenant with an `@reva.edu.in`
  address (full university access). Students get an account on their first sign-in; staff
  must be added by an administrator first.
- **Visitors from outside REVA:** any Google account with a verified email, on the student
  page only, with **general access** (events, 3D printing, PCB orders; no component
  borrowing). `@reva.edu.in` addresses are sent to Microsoft instead.
- One **emergency administrator** (made with `create-admin`) can also sign in with a
  password, for the first setup and in case Microsoft sign-in breaks.

Every sign-in attempt (successful or refused) is recorded: Microsoft and password sign-ins
in `idealab_audit`, Google sign-ins in the separate `idealab_audit_google` database. The app
can add to both but never edit or delete them; the Sign-in Log tab shows them together with
a Microsoft/Google filter.

## 1. Create the server (AWS console)

1. **EC2 → Launch instance**: Ubuntu Server 24.04 LTS, `t3.small` (2 GB RAM) or larger,
   30 GB gp3 disk.
2. **Security group**: allow 80 and 443 from anywhere, and 22 (SSH) only from your
   office/VPN IP. Do not open 3001 or 27017.
3. **IAM role for the instance** (EC2 → Actions → Security → Modify IAM role) with this
   policy, so the app can send email without any keys in `.env`:
   ```json
   { "Version": "2012-10-17", "Statement": [
     { "Effect": "Allow", "Action": ["ses:SendEmail", "ses:SendRawEmail"], "Resource": "*" } ] }
   ```
4. **Let Docker containers use that role**: EC2 → Actions → Instance settings →
   Modify instance metadata options → *Metadata response hop limit* = **2**
   (or `aws ec2 modify-instance-metadata-options --instance-id i-... --http-put-response-hop-limit 2 --http-tokens required`).
5. Allocate an **Elastic IP**, attach it, and point your DNS name (e.g.
   `idealab.reva.edu.in`) at it.

## 2. Set up email (Amazon SES)

1. SES → Verified identities → verify the domain (or at least the sender address) you
   will send from, in the same region as `AWS_REGION` (e.g. `ap-south-1`).
2. New SES accounts are in the *sandbox* (they can only send to verified addresses).
   Request **production access** in SES → Account dashboard before going live. Email +
   password sign-up needs this: without it, confirmation emails only reach verified addresses.

Until `EMAIL_FROM` is set, emails are not sent; their text (including links) is written
to the app log, which is handy for testing (`docker compose logs app | grep '\[mail\]'`).

## 3. Register the portal with REVA's Microsoft 365 (Microsoft Entra ID)

This needs someone with admin rights in REVA's Microsoft 365 (usually REVA IT).

1. [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**.
   - Name: `REVA IDEA Lab portal`
   - Supported account types: **Accounts in this organizational directory only (single tenant)**
   - Redirect URI: platform **Web**, `https://idealab.reva.edu.in/api/auth/microsoft/callback`
     (your `PUBLIC_URL` + `/api/auth/microsoft/callback`)
2. On the app's **Overview** page copy:
   - *Directory (tenant) ID* → `MS_TENANT_ID`
   - *Application (client) ID* → `MS_CLIENT_ID`
3. **Certificates & secrets** → **New client secret** (24 months) → copy the *Value* →
   `MS_CLIENT_SECRET`. Put a reminder in the calendar to renew it before it expires.
4. **API permissions**: the default *Microsoft Graph → User.Read* is enough (the portal only
   uses the `openid profile email` sign-in scopes). Click **Grant admin consent** so students
   are not asked to approve it.
5. Optional: *Token configuration* → add the optional claim **email** (ID token). Without it
   the portal uses the account's sign-in name, which is the @reva.edu.in address at REVA.

The portal checks every sign-in token's signature, issuer, tenant, audience and one-time
nonce, and refuses any account whose email is not `@reva.edu.in`.

## 3b. Google sign-in for visitors (Google Cloud Console)

1. [console.cloud.google.com](https://console.cloud.google.com) → create (or pick) a project,
   e.g. `REVA IDEA Lab portal`.
2. **APIs & Services → OAuth consent screen**: User type **External**, app name, support
   email, and the scopes `openid`, `email`, `profile` (no sensitive scopes, so no Google
   review is needed). Click **Publish app** so anyone with a Google account can sign in.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: `https://idealab.reva.edu.in/api/auth/google/callback`
     (your `PUBLIC_URL` + `/api/auth/google/callback`)
4. Copy the **Client ID** → `GOOGLE_CLIENT_ID` and **Client secret** → `GOOGLE_CLIENT_SECRET`.

Use a **new** OAuth client (or at least a new client secret): the old `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` values in the repository's old `.env` have been exposed in git history.
Leaving both empty turns Google sign-in off; Microsoft is unaffected.

## 4. Install and start the portal (on the server)

```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx git
sudo usermod -aG docker ubuntu && newgrp docker

sudo mkdir -p /srv/idea-lab && sudo chown ubuntu: /srv/idea-lab
git clone <repository-url> /srv/idea-lab && cd /srv/idea-lab

cp .env.example .env && chmod 600 .env
nano .env        # PUBLIC_URL, JWT_SECRET, MS_TENANT_ID/MS_CLIENT_ID/MS_CLIENT_SECRET,
                 # GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET,
                 # MONGO_* passwords, EMAIL_FROM, AWS_REGION, RAZORPAY_*
                 # generate secrets with: openssl rand -hex 32

docker compose up -d --build
docker compose ps                                  # both "healthy" after ~30 s
curl -s http://127.0.0.1:3001/api/health           # {"status":"ok","database":"ok"}

# Emergency administrator (asks for a password). Also able to use Microsoft sign-in
# if the email is your @reva.edu.in address.
docker compose exec app node build/scripts/create-admin.js --email you@reva.edu.in --name "Your Name"
```

Then sign in at `/staff-login` and add the other staff (Dashboard → User Management →
Add staff) with their @reva.edu.in addresses and roles. They sign in with Microsoft.

> **MongoDB volume created before this version?** The database permissions (including the
> append-only Google and email + password sign-in logs) are set up automatically only when the database volume is
> first created. For an existing volume, run this once; it keeps everything already there:
> ```bash
> docker compose exec mongo sh -c 'mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin /docker-entrypoint-initdb.d/mongo-init.js'
> docker compose restart app
> ```

> The repository's old `.env` holds Supabase/Firebase settings that are no longer used
> (and its multi-line Firebase key is not valid for Docker). Start from `.env.example`.

## 5. HTTPS with nginx

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/idealab.conf
sudo nano /etc/nginx/sites-available/idealab.conf        # set server_name
sudo ln -s /etc/nginx/sites-available/idealab.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d idealab.reva.edu.in              # free certificate, auto-renews
```

Open `https://<your domain>` and sign in at `/staff-login` (Microsoft, or the emergency
administrator you created).

## 6. Razorpay (3D print payments)

1. Set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (test keys first, live keys when ready).
2. Razorpay dashboard → Webhooks → add `https://<domain>/api/payments/razorpay/webhook`
   for `payment.captured` and `order.paid`, with a secret; put that secret in
   `RAZORPAY_WEBHOOK_SECRET`.
3. `docker compose up -d` to apply `.env` changes.

The server prices each order from the uploaded STL, creates the Razorpay order and marks
it paid only after checking Razorpay's signature. Unpaid orders are cancelled after 30 min.

## 7. Move the existing data from Supabase (one time)

Run this before switching DNS to the new server, then again right before the switch to
pick up the latest changes (it is safe to run repeatedly).

```bash
# Add to .env temporarily (Supabase → Project settings → Database / API):
#   SUPABASE_DB_URL=postgresql://postgres.<project>:<password>@<host>:5432/postgres
#   SUPABASE_URL=https://<project>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=...
docker compose up -d
docker compose exec app node build/scripts/migrate-from-supabase.js --dry-run   # counts only
docker compose exec app node build/scripts/migrate-from-supabase.js             # copy for real
```

What it does: every Supabase table becomes a MongoDB collection (same field names, same
ids), `profiles` is merged into users, all storage buckets are copied to the server's
disk, and stored file URLs are rewritten to the new `/files/...` paths.

Migrated students and staff simply **sign in with Microsoft**: the first sign-in is matched
to their existing account by @reva.edu.in email, so their orders and history stay with them.
Old accounts with other email domains (e.g. Gmail) are kept in the database for the records
but can no longer sign in.

Afterwards: remove the `SUPABASE_*` lines from `.env`, then in the old consoles delete
the Firebase service-account key and pause/delete the Supabase project. Those keys are
still in the repository's history, so treat them as exposed.

## 8. Backups

```bash
sudo crontab -e
# daily at 02:30: database dump + uploaded files, 14 days kept in /var/backups/idealab
30 2 * * * /srv/idea-lab/deploy/backup.sh >> /var/log/idealab-backup.log 2>&1
```

Also keep a copy off the instance: set `BACKUP_S3_URI=s3://<bucket>/idealab` for the
cron job (needs the AWS CLI and `s3:PutObject` on that bucket in the instance role),
and/or enable **AWS Backup** snapshots of the EBS volume.

Restore:
```bash
docker compose exec -T mongo sh -c 'mongorestore --drop --archive --gzip -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' < /var/backups/idealab/mongo-<stamp>.archive.gz
docker compose exec -T app tar xzf - -C /data/uploads < /var/backups/idealab/uploads-<stamp>.tgz
```

## 9. Updating

```bash
cd /srv/idea-lab && git pull && docker compose up -d --build
```

## 10. Running it and checking on it

- Logs: `docker compose logs -f app` (sign-in problems, email, payments) and
  `docker compose logs mongo`.
- Who used the portal: Dashboard → **Sign-in Log** (admins and tech support): counts of
  students/staff, a per-day table, the full list and a CSV download.
- Microsoft client secret: renew it in the Azure app registration before it expires and
  update `MS_CLIENT_SECRET`, or sign-in stops working (the emergency admin still works).
- Health: `curl -s http://127.0.0.1:3001/api/health` (checks the database too).
- Restart: `docker compose restart app`. Containers restart on reboot automatically.
- Sign everyone out (e.g. after a suspected leak): change `JWT_SECRET` and
  `docker compose up -d`.

## Notes

- **Sharing the server with other sites**: give the portal its own subdomain, keep 3001 and
  27017 closed in the security group, and keep `.env` at `chmod 600`.
- **Without Docker**: install MongoDB 7 and Node 22, set `MONGODB_URI` and `STORAGE_DIR`
  in `.env`, then `npm ci && npm run build && npm prune --omit=dev && pm2 start ecosystem.config.cjs`.
- **Team photos on the About page**: run `node scripts/fetch-team-photos.mjs` once on a
  machine with internet access and commit `public/img/team/`; until then initials show.

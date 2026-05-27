# PRHUB CDE — Deployment Plan (No Oracle)

Oracle Cloud signup is often difficult (verification, quotas, account issues). Use one of the plans below instead.

---

## Choose your plan

| Plan | Cost | Difficulty | Best for |
|------|------|------------|----------|
| **A — Hetzner VPS** ⭐ Recommended | ~€4–5 / month | Medium (one server) | Easiest “real server” path; matches your repo |
| **B — 100% free split** | $0 | Medium (4 services) | No VPS; no Oracle; stay in free tiers |
| ~~C — Oracle Always Free~~ | $0 | High signup friction | Skip if subscription is a problem |

**Recommendation:** **Plan A (Hetzner)** if you can spend a few euros/month. **Plan B** if you need $0 and accept more setup.

---

# Plan A — Hetzner VPS (recommended)

Same architecture as the original VM plan, but on **Hetzner Cloud** (simple signup, predictable billing).

**~€4.51/mo** — CX22: 2 vCPU, 4 GB RAM, 40 GB disk (enough for POC + Postgres + uploads).

## Architecture

```
Internet → Nginx (HTTPS) → Next.js :3000 (PM2)
                ├── PostgreSQL (Docker, localhost only)
                └── storage/uploads (local) OR MinIO (Docker)
Hourly cron → POST /api/cron/rfi-overdue
Email → Brevo free SMTP
```

## A1 — Create server

1. Sign up: [https://www.hetzner.com/cloud](https://www.hetzner.com/cloud)
2. Create project → **Add server**
3. Location: closest to users (e.g. Helsinki, Falkenstein, Ashburn)
4. Image: **Ubuntu 24.04**
5. Type: **CX22** (or CPX11 if cheaper tier available)
6. Networking: public IPv4 + IPv6
7. SSH key: paste your public key
8. Create server — note the IP address

## A2 — Firewall (Hetzner Cloud Firewall or UFW)

Allow: **22**, **80**, **443** — deny public access to 5432 and 9000.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## A3 — Install software (SSH into server)

```bash
ssh root@<SERVER_IP>

apt update && apt upgrade -y
apt install -y git curl nginx certbot python3-certbot-nginx
apt install -y docker.io docker-compose-v2
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
```

## A4 — Deploy application

```bash
mkdir -p /opt/prhub-cde && cd /opt/prhub-cde
git clone <YOUR_REPO_URL> .
cp .env.example .env
nano .env
```

**`.env` for Hetzner:**

```env
DATABASE_URL="postgresql://prhub:STRONG_DB_PASSWORD@127.0.0.1:5432/prhub_cde"
AUTH_SECRET="<openssl rand -base64 32>"
NEXTAUTH_URL="https://cde.yourdomain.com"

STORAGE_MODE="local"
LOCAL_STORAGE_PATH="/opt/prhub-cde/storage/uploads"

SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT="587"
SMTP_USER="<brevo-user>"
SMTP_PASS="<brevo-smtp-key>"
MAIL_FROM="PRHUB CDE <noreply@yourdomain.com>"

CRON_SECRET="<openssl rand -base64 32>"
ENABLE_RFI_OVERDUE_CRON="false"
```

Edit `docker-compose.yml` Postgres password to match, or use env file for compose.

```bash
docker compose up -d postgres
mkdir -p storage/uploads
npm ci
npx prisma db push
npm run db:seed
npm run build
pm2 start npm --name prhub-cde -- start
pm2 save && pm2 startup
```

## A5 — Nginx + SSL

`/etc/nginx/sites-available/prhub-cde`:

```nginx
server {
    listen 80;
    server_name cde.yourdomain.com;
    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/prhub-cde /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d cde.yourdomain.com
pm2 restart prhub-cde
```

## A6 — Cron (overdue RFIs)

```bash
crontab -e
```

```cron
0 * * * * curl -sf -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://cde.yourdomain.com/api/cron/rfi-overdue
```

## A7 — Backups

```bash
# Daily DB dump
0 2 * * * docker exec $(docker ps -qf name=postgres) pg_dump -U prhub prhub_cde | gzip > ~/backup-$(date +\%F).sql.gz
```

## A8 — Updates

```bash
cd /opt/prhub-cde && git pull && npm ci && npx prisma db push && npm run build && pm2 restart prhub-cde
```

---

# Plan B — 100% free (no VPS, no Oracle)

Split stack — good when you cannot use any paid VPS.

| Component | Service | Signup |
|-----------|---------|--------|
| App | [Vercel](https://vercel.com) | GitHub login |
| Database | [Neon](https://neon.tech) | Free Postgres |
| Files | [Cloudflare R2](https://developers.cloudflare.com/r2/) | 10 GB free, S3 API |
| Cron | [cron-job.org](https://cron-job.org) | Free HTTP scheduler |
| Email | [Brevo](https://www.brevo.com) | Free SMTP |

## B1 — Neon (database)

1. Create project → Postgres → copy connection string.
2. Append `?sslmode=require` if needed.

```env
DATABASE_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

3. From your laptop (once):

```bash
DATABASE_URL="..." npx prisma db push
DATABASE_URL="..." npm run db:seed
```

## B2 — Cloudflare R2 (storage)

1. R2 → Create bucket `prhub-cde`
2. Manage R2 API tokens → Create token (Object Read & Write)
3. Note: Account ID, Access Key, Secret Key

```env
STORAGE_MODE="s3"
S3_ENDPOINT="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
S3_REGION="auto"
S3_ACCESS_KEY="<r2-access-key>"
S3_SECRET_KEY="<r2-secret-key>"
S3_BUCKET="prhub-cde"
```

**Important:** Local storage does **not** work on Vercel. You must use R2.

## B3 — Vercel (app)

1. Import GitHub repo on Vercel.
2. Framework: Next.js (auto-detected).
3. **Environment variables** (Production):

```env
DATABASE_URL=<neon-url>
AUTH_SECRET=<random>
NEXTAUTH_URL=https://your-app.vercel.app
STORAGE_MODE=s3
S3_ENDPOINT=...
S3_REGION=auto
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=prhub-cde
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM=PRHUB CDE <noreply@yourdomain.com>
CRON_SECRET=<random>
ENABLE_RFI_OVERDUE_CRON=false
```

4. Deploy. Open the Vercel URL → test login.

5. Custom domain (optional): Vercel → Domains → update `NEXTAUTH_URL`.

## B4 — Cron (overdue RFIs)

On [cron-job.org](https://cron-job.org):

- URL: `https://your-app.vercel.app/api/cron/rfi-overdue`
- Schedule: every hour
- Method: POST
- Header: `Authorization: Bearer <CRON_SECRET>`

Do **not** rely on `ENABLE_RFI_OVERDUE_CRON` on Vercel.

## B5 — Verify Plan B

- [ ] Upload document (hits R2)
- [ ] Download document
- [ ] Raise / resolve RFI
- [ ] Notifications for correct parties only
- [ ] Cron job shows success in cron-job.org history
- [ ] Email via Brevo (or check Vercel function logs)

---

## Comparison: Plan A vs Plan B

| | Plan A Hetzner | Plan B Free split |
|--|----------------|-------------------|
| Monthly cost | ~€4–5 | $0 |
| Signup pain | Low | Low (no Oracle) |
| File storage | Local disk (simple) | R2 (extra setup) |
| Cron | Linux crontab | cron-job.org |
| Cold starts | None | Possible on Vercel |
| Matches docker-compose | Yes | Partial |
| Demo reliability | High | Good |

---

## Other VPS alternatives (same steps as Plan A)

Replace Hetzner only — keep Nginx, PM2, Docker Postgres, `.env`:

| Provider | Typical cost | Notes |
|----------|--------------|--------|
| **DigitalOcean** | $6/mo (often $200 credit for new accounts) | Very popular docs |
| **Linode (Akamai)** | ~$5/mo | Similar to DO |
| **Vultr** | ~$6/mo | Many regions |
| **AWS Lightsail** | ~$5/mo | Simple AWS entry |
| **Contabo** | ~€5/mo | Cheap, variable performance |

---

## Email (both plans)

Free tier: **Brevo** (~300 emails/day) — SMTP settings in `.env` above.

Without SMTP, emails log to server console (`[mail:dev]`) — OK for dev only.

---

## Security checklist (both plans)

- [ ] Change demo passwords after `db:seed`
- [ ] Strong `AUTH_SECRET` and `CRON_SECRET`
- [ ] `NEXTAUTH_URL` exactly matches public URL (https, no trailing slash)
- [ ] Database not publicly accessible (Neon/Vercel only; VM binds Postgres to localhost)
- [ ] HTTPS on production URL

---

## Go-live checklist

- [ ] Login: parties A, B, C, D
- [ ] Upload + download documents
- [ ] RFI raise, resolve, escalate (Party A)
- [ ] Bell notifications scoped correctly
- [ ] Overdue cron tested once
- [ ] SMTP delivers (or accepted as log-only for internal POC)

---

## Quick decision

```
Can you pay ~€5/month?
  YES → Plan A (Hetzner VPS)
  NO  → Plan B (Vercel + Neon + R2 + cron-job.org)

Oracle subscription blocked?
  → Use Plan A or B above (ignore Oracle entirely)
```

---

## Support commands (Plan A)

```bash
pm2 status && pm2 logs prhub-cde
docker compose ps
npm run cron:rfi-overdue
```

---

*Aligned with PRHUB CDE POC — Next.js, Prisma, local/S3 storage, RFI workflow, overdue email API.*

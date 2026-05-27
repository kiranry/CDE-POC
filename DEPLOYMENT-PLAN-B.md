# Plan B — Free deployment (step-by-step)

**Stack:** Vercel + Neon + Cloudflare R2 + cron-job.org + Brevo  
**Cost:** $0 within free tiers  
**Time:** ~1–2 hours first time

Copy env vars from [`.env.plan-b.example`](.env.plan-b.example).

---

## Overview

| Step | Service | What you do |
|------|---------|-------------|
| 1 | **GitHub** | Push this repo |
| 2 | **Neon** | Postgres database |
| 3 | **Cloudflare R2** | File storage (PDF, DWG, etc.) |
| 4 | **Vercel** | Host the Next.js app |
| 5 | **Your PC** | `db push` + `seed` once |
| 6 | **cron-job.org** | Hourly overdue RFI emails |
| 7 | **Brevo** | SMTP for RFI emails |

---

## Step 1 — GitHub

**Use a separate git repo in this folder only** (not your Desktop/work git).  
Full instructions: **[`GIT-SETUP.md`](GIT-SETUP.md)**

```bash
cd /home/kiran/Desktop/CDE_VISL

# Personal identity for THIS repo only (does not change global work config)
git config --local user.name "Your Name"
git config --local user.email "your-personal@email.com"

git add .
git commit -m "Initial commit: PRHUB CDE POC"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

---

## Step 2 — Neon (database)

1. Go to [https://neon.tech](https://neon.tech) → Sign up (GitHub is fine).
2. **New project** → name `prhub-cde` → region near your users.
3. Open **Connection details** → copy the **pooled** connection string  
   (hostname should include `-pooler`, e.g. `ep-xxx-pooler.region.aws.neon.tech`).
4. Append `?sslmode=require` if it is not already in the URL.

Save as `DATABASE_URL` — you will use it locally and on Vercel.

### Initialize schema (from your laptop)

```bash
cd /path/to/CDE_VISL
cp .env.plan-b.example .env.local
# Edit .env.local — paste Neon DATABASE_URL only for now

export $(grep -v '^#' .env.local | xargs)   # or set DATABASE_URL manually
npx prisma db push
npm run db:seed
```

You should see: `Seed complete: 4 parties, 4 users, 48 folders`.

---

## Step 3 — Cloudflare R2 (file storage)

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → enable R2 (free tier).
2. **Create bucket** → name: `prhub-cde`.
3. **Manage R2 API tokens** → **Create API token**
   - Permissions: Object Read & Write
   - Scope: this bucket
4. Save **Access Key ID**, **Secret Access Key**, and **Account ID**.

**Endpoint format:**

```text
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Example env:

```env
STORAGE_MODE=s3
S3_ENDPOINT="https://abc123def456.r2.cloudflarestorage.com"
S3_REGION="auto"
S3_ACCESS_KEY="..."
S3_SECRET_KEY="..."
S3_BUCKET="prhub-cde"
S3_FORCE_PATH_STYLE="false"
```

### Quick R2 test (optional)

After deploy, upload a small PDF on the Documents page. In R2 → bucket → you should see objects under `documents/...`.

---

## Step 4 — Brevo (email)

1. [https://www.brevo.com](https://www.brevo.com) → free account.
2. **SMTP & API** → create SMTP key.
3. Use:
   - Host: `smtp-relay.brevo.com`
   - Port: `587`
   - Login: your Brevo account email
   - Password: SMTP key

Without this, emails only appear in Vercel **Runtime Logs** as `[mail:dev]`.

---

## Step 5 — Vercel (deploy app)

1. [https://vercel.com](https://vercel.com) → Sign up with GitHub.
2. **Add New Project** → import `prhub-cde` repo.
3. Framework: **Next.js** (auto).
4. **Environment variables** — add all from `.env.plan-b.example`:

| Variable | Example / notes |
|----------|-----------------|
| `DATABASE_URL` | Neon **pooled** URL |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://YOUR-PROJECT.vercel.app` (set after first deploy, then redeploy) |
| `STORAGE_MODE` | `s3` |
| `S3_ENDPOINT` | R2 endpoint URL |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY` | R2 access key |
| `S3_SECRET_KEY` | R2 secret |
| `S3_BUCKET` | `prhub-cde` |
| `S3_FORCE_PATH_STYLE` | `false` |
| `SMTP_*` + `MAIL_FROM` | Brevo |
| `CRON_SECRET` | random string |
| `ENABLE_RFI_OVERDUE_CRON` | `false` |

5. **Deploy**.

### After first deploy

1. Copy your live URL, e.g. `https://prhub-cde.vercel.app`.
2. Vercel → Project → **Settings** → **Environment Variables**  
   Set `NEXTAUTH_URL` to that exact URL (https, no trailing `/`).
3. **Redeploy** (Deployments → … → Redeploy).

### Custom domain (optional)

Vercel → Domains → add `cde.yourdomain.com` → update `NEXTAUTH_URL` → redeploy.

---

## Step 6 — cron-job.org (overdue RFIs)

1. [https://cron-job.org](https://cron-job.org) → free account.
2. **Create cron job**
   - Title: `PRHUB overdue RFI`
   - URL: `https://YOUR-PROJECT.vercel.app/api/cron/rfi-overdue`
   - Schedule: every hour (`0 * * * *`)
   - Request method: **POST**
   - Headers:  
     `Authorization` = `Bearer YOUR_CRON_SECRET`  
     (same value as Vercel env `CRON_SECRET`)
3. Save → **Run now** → expect HTTP 200 and JSON `{"ok":true,...}`.

---

## Step 7 — Smoke test

| Test | How |
|------|-----|
| Login | `party-b@prhub.local` / `prhub123` |
| Upload | Documents → pick folder → upload small PDF |
| Download | Download from register |
| RFI | Raise RFI B → C; switch party; resolve |
| Notifications | Only raiser + respondent see RFI alerts |
| Cron | cron-job.org execution log shows 200 |
| Email | Brevo dashboard or inbox after RFI raise |

**Change demo passwords** before sharing with stakeholders.

---

## Limits (Plan B free tier)

| Limit | Detail |
|-------|--------|
| Vercel upload size | ~4.5 MB per request on Hobby — large DWG may fail; use smaller test files or upgrade |
| Neon storage | 0.5 GB free — fine for POC |
| R2 storage | 10 GB free |
| Brevo email | ~300 emails/day |
| Vercel cold start | First request after idle may be slow |

---

## Troubleshooting

### Login redirects loop

- `NEXTAUTH_URL` must exactly match browser URL.
- Redeploy after changing it.

### Upload fails / storage error

- `STORAGE_MODE` must be `s3` on Vercel.
- `S3_FORCE_PATH_STYLE=false` for R2.
- R2 token has read/write on bucket.

### Prisma / DB errors on Vercel

- Use Neon **pooled** connection string.
- Run `npx prisma db push` locally with same `DATABASE_URL`.

### Cron returns 401

- Header must be `Authorization: Bearer <CRON_SECRET>` (with space after Bearer).
- Same secret on Vercel and cron-job.org.

### Emails not received

- Check Brevo SMTP credentials.
- Vercel → Logs → look for `[mail:dev]` (means SMTP not set).

---

## Updating the live app

```bash
git push origin main
```

Vercel auto-deploys. After schema changes:

```bash
DATABASE_URL="your-neon-url" npx prisma db push
```

---

## Checklist

- [ ] Neon project + pooled `DATABASE_URL`
- [ ] `prisma db push` + `db:seed` run locally
- [ ] R2 bucket + API token + env vars
- [ ] Brevo SMTP configured
- [ ] Vercel project deployed with all env vars
- [ ] `NEXTAUTH_URL` matches live URL + redeploy
- [ ] cron-job.org POST hourly with `CRON_SECRET`
- [ ] Upload / RFI / login tested on live URL

---

*See also [`DEPLOYMENT.md`](DEPLOYMENT.md) for Plan A (Hetzner) and comparisons.*

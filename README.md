# PRHUB CDE — POC

Common Data Environment proof-of-concept for PRHUB Infrastructure (Phase 0 & 1).

## Quick start

### 1. Start database (Docker)

```bash
docker compose up -d postgres
```

### 2. Install and migrate

```bash
npm install
npm run db:push
npm run db:seed
```

### 3. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Demo logins

| Party | Email | Password |
|-------|-------|----------|
| A (PMC) | party-a@prhub.local | prhub123 |
| B (Design) | party-b@prhub.local | prhub123 |
| C (Contractor) | party-c@prhub.local | prhub123 |
| D (Sub-Con) | party-d@prhub.local | prhub123 |

Use **Act as** in the top bar to switch party context (demo mode).

## Features (Phase 0–2)

- Login and app shell (Dashboard, Documents, RFI placeholder, Stakeholders)
- 4×11 folder taxonomy (48 folders)
- Document upload / download (no in-app preview)
- Uploader attribution and version history
- Activity log on upload
- **In-app notifications** on upload (all other parties + PMC copy)
- Notification bell with read/unread, full history, mark read
- Local file storage (`./storage/uploads`) by default

## Optional: MinIO

```bash
docker compose up -d
# Set STORAGE_MODE=s3 in .env
```

See `POC_IMPLEMENTATION_PLAN.md` for the full roadmap.

## Deployment (free — Plan B)

Follow **`DEPLOYMENT-PLAN-B.md`** step by step:

1. **Neon** — Postgres  
2. **Cloudflare R2** — file storage  
3. **Vercel** — app hosting  
4. **cron-job.org** — overdue RFI emails  
5. **Brevo** — SMTP  

Copy env vars from **`.env.plan-b.example`**.

Other options: **`DEPLOYMENT.md`** (Hetzner VPS ~€5/mo).

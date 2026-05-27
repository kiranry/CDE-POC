# PRHUB Common Data Environment (CDE)

A proof-of-concept web application for **PRHUB Infrastructure** Phase 0–1: a multi-party Common Data Environment for controlled document exchange, request-for-information (RFI) workflows, and project visibility across four stakeholder roles.

Built with **Next.js**, **PostgreSQL**, and **S3-compatible object storage**, deployable locally or on a free-tier cloud stack (Vercel, Neon, Cloudflare R2).

---

## Overview

The CDE coordinates four parties on a shared project:

| Code | Role | Typical responsibilities |
|------|------|---------------------------|
| **A** | Project Management Consultant (PMC) | Administration, oversight, escalation |
| **B** | Design consultant | Design documentation |
| **C** | Main contractor | Construction documentation |
| **D** | Sub-contractor / specialist | Specialist packages |

Users authenticate per party, upload documents into a structured folder taxonomy, raise and resolve RFIs, and receive in-app and email notifications. A demo **Act as** control allows switching party context without re-login (intended for demonstrations only).

---

## Features

### Documents

- **48-folder taxonomy** (4 parties × 11 subfolders) aligned with project information requirements
- Upload, download, **version history**, and **delete** (document or single version)
- Metadata register: uploader, party, timestamp, file size
- Storage: local filesystem (development) or S3-compatible API (production / R2)

### RFI workflow

- Raise, acknowledge (pending), resolve, and escalate RFIs
- 7-day default due date; overdue handling with notifications and email
- Timeline view per RFI; register filtered by concerned parties
- Optional link to a related document

### Dashboard and activity

- Project statistics and recent uploads
- Live activity feed (server-sent events)
- PMC escalation banner for open escalations

### Notifications and email

- In-app notification bell (read / unread, history)
- Party-scoped notifications on document upload and RFI events
- SMTP delivery via Brevo (or console logging when SMTP is not configured)

### Security (POC scope)

- Credential-based authentication (NextAuth)
- Session-bound user identity; separate “active party” context for demo switching
- Protected API routes and authenticated downloads

> **Note:** This is a demonstration system. It is not hardened for production use (no RBAC enforcement on party switching, demo passwords, etc.).

---

## Technology stack

| Layer | Technology |
|-------|------------|
| Application | Next.js 16 (App Router), React 19, TypeScript |
| Database | PostgreSQL (Prisma ORM) |
| Authentication | Auth.js / NextAuth (credentials) |
| File storage | Local disk or S3-compatible (Cloudflare R2, MinIO) |
| Email | Nodemailer + SMTP (Brevo) |
| Styling | Tailwind CSS |

---

## Prerequisites

- **Node.js** 20 or later  
- **npm** 9 or later  
- **PostgreSQL** 15+ (local Docker or [Neon](https://neon.tech) for hosted)  
- **Docker** (optional, for local Postgres / MinIO)

---

## Local development

### 1. Clone and install

```bash
git clone https://github.com/kiranry/CDE-POC.git
cd CDE-POC
npm install
```

### 2. Configure environment

Create `.env` in the project root. For **local development** with Docker Postgres:

```env
DATABASE_URL="postgresql://prhub:prhub@localhost:5432/prhub_cde"
AUTH_SECRET="change-me-use-openssl-rand-base64-32-in-production"
NEXTAUTH_URL="http://localhost:3000"
STORAGE_MODE=local
```

For **production** (Vercel + Neon + R2), see `.env.example` for the full variable set.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Session signing secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | App URL — must match the browser address exactly |
| `STORAGE_MODE` | `local` (default) or `s3` |
| `SMTP_*` | Optional; omit to log emails to the console |

### 3. Start the database

**Option A — Docker (recommended for local Postgres)**

```bash
docker compose up -d postgres
```

**Option B — Existing Postgres**

Point `DATABASE_URL` at your instance and skip Docker.

### 4. Initialize the database

```bash
npm run db:push
npm run db:seed
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo accounts

| Party | Email | Password |
|-------|-------|----------|
| A — PMC | `party-a@prhub.local` | `prhub123` |
| B — Design | `party-b@prhub.local` | `prhub123` |
| C — Contractor | `party-c@prhub.local` | `prhub123` |
| D — Sub-contractor | `party-d@prhub.local` | `prhub123` |

After signing in, use **Act as** in the header to change the active party context. The header shows both your **account** party and **acting as** party when they differ.

---

## NPM scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Apply Prisma schema to the database |
| `npm run db:seed` | Seed parties, users, and folders |
| `npm run db:studio` | Open Prisma Studio |
| `npm run cron:rfi-overdue` | Process overdue RFIs (manual / cron) |
| `npm run test:smtp -- you@example.com` | Send a test email |

---

## Object storage (optional)

### MinIO (local S3)

```bash
docker compose up -d
```

Set in `.env`:

```env
STORAGE_MODE=s3
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=prhub-cde
```

### Cloudflare R2

Use `STORAGE_MODE=s3` with your R2 endpoint and API token. Set `S3_FORCE_PATH_STYLE=false` for R2.

---

## Production deployment

The recommended **Plan B** stack (free tier) is:

1. **[Neon](https://neon.tech)** — PostgreSQL (use the **pooled** connection URL on Vercel)  
2. **[Cloudflare R2](https://www.cloudflare.com/products/r2/)** — document storage (`STORAGE_MODE=s3`)  
3. **[Vercel](https://vercel.com)** — application hosting (auto-deploy on push to `main`)  
4. **[Brevo](https://www.brevo.com)** — transactional SMTP  
5. **[cron-job.org](https://cron-job.org)** — hourly `POST /api/cron/rfi-overdue` with `CRON_SECRET`

**Critical:** Set `NEXTAUTH_URL` to your live URL (e.g. `https://cde-poc.vercel.app`) with no trailing slash. Set `ENABLE_RFI_OVERDUE_CRON=false` on Vercel and use an external cron job instead.

After connecting Neon, run once from your machine:

```bash
npm run db:push
npm run db:seed
```

Pushes to `main` trigger a new Vercel deployment when the GitHub repository is linked.

---

## Project structure

```
prisma/           Schema, migrations, seed data
src/
  app/            Next.js routes (pages, API)
  components/     UI components
  lib/            Auth, storage, mail, RFI, notifications
scripts/          SMTP / RFI utility scripts
storage/uploads/  Local file storage (gitignored)
```

---

## Troubleshooting

| Issue | Resolution |
|-------|------------|
| Upload fails with foreign key error | Sign out and sign in again after changing `DATABASE_URL` (stale session user id). |
| Vercel redirects to `localhost` | Set `NEXTAUTH_URL` to the production URL and redeploy. |
| Emails not received | Run `npm run test:smtp -- your@email.com`; use Brevo **Login** (`@smtp-brevo.com`), not your Gmail. |
| Party switcher wrong after refresh | Fixed in current version — ensure latest deploy; sign out/in if needed. |
| SMTP works locally but not on Vercel | Add all `SMTP_*` variables in Vercel project settings. |

---

## License

Private proof-of-concept. All rights reserved unless otherwise agreed with PRHUB Infrastructure.

---

## Contact

For questions about this POC, contact the PRHUB Infrastructure project team.

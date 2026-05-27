# PRHUB CDE — POC Implementation Plan

**Source:** `PRHUB_CDE_BRD_v1_1.docx` (PRHUB-CDE-BRD-001, v1.0 Draft, March 2026)  
**Goal:** Build a basic POC implementing **all Phase 1 features** with no functional requirement left out.

### Document interaction model (POC policy)


| Capability               | In POC? | Notes                                                                           |
| ------------------------ | ------- | ------------------------------------------------------------------------------- |
| Upload files             | Yes     | To folder taxonomy; validated file types                                        |
| Download files           | Yes     | Browser download only — open/view locally if needed                             |
| In-app preview / viewer  | **No**  | No PDF viewer, image preview, DWG/IFC render, or embedded Office                |
| See who uploaded         | Yes     | Every row and history entry shows **uploading party** + user + timestamp        |
| Document version history | Yes     | Each re-upload of same name in same folder = new version; full version timeline |
| RFI history              | Yes     | Full timeline of RFI create, status changes, resolution, escalation             |


---

## 1. POC scope

### In scope (implement all)


| Area                           | Requirements                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Document management            | FR-001 → FR-006, folder taxonomy (§8), upload/download only, uploader attribution, version history (FR-003) |
| History & audit                | Document version timeline + RFI event timeline + activity log (NFR-004)                                     |
| Notifications                  | FR-007 → FR-012                                                                                             |
| RFI workflow                   | FR-013 → FR-024, RFI process flow (§7)                                                                      |
| Dashboard & reporting          | FR-025 → FR-028                                                                                             |
| Users & access                 | FR-029 → FR-031                                                                                             |
| Non-functional (POC-realistic) | NFR-001 → NFR-008                                                                                           |
| Acceptance tests               | AC-01 → AC-08                                                                                               |


### Out of scope (Phase 1 — do not build)

- **In-app file viewing or preview** (PDF, images, DWG, IFC, Office, XML, MPP) — download only
- Email and SMS notification delivery (Phase 2)
- Multi-user accounts within a single party
- Document version comparison / diff tools
- Integration with BIM platforms (Autodesk BIM 360, Aconex)
- Mobile native application (web-responsive **is** in scope)
- Formal e-signature on documents
- Financial / valuation workflows

---

## 2. Recommended technology stack


| Layer                 | Technology                                       | Rationale                                                                |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| App framework         | **Next.js 15** (App Router) + **TypeScript**     | Single repo; UI + API; easy deployment for demo                          |
| UI                    | **Tailwind CSS** + **shadcn/ui**                 | Professional UI for non-IT users (NFR-001)                               |
| API / validation      | **Next.js Route Handlers** + **Zod**             | Type-safe request/response validation                                    |
| Database              | **PostgreSQL** + **Prisma**                      | Relational model for parties, folders, RFIs, audit                       |
| File storage          | **MinIO** (S3-compatible, Docker)                | Real binary storage for PDF, DWG, XLSX, DOCX, XML, MPP, images, ZIP, IFC |
| Auth (POC)            | **NextAuth.js** (Credentials) — 4 party accounts | FR-029; production path → OAuth/SSO later                                |
| Party switcher (demo) | Top-nav context override                         | FR-031 — multi-party demo without four browsers                          |
| Real-time activity    | **SSE** (Server-Sent Events)                     | Live activity log (FR-026) without heavy infrastructure                  |
| Background jobs       | **node-cron** (optional)                         | Overdue RFI detection, SLA colour updates                                |
| DevOps                | **Docker Compose** (Postgres + MinIO + app)      | Repeatable local/staging demo                                            |
| Testing               | **Playwright** (E2E) + **Vitest** (unit)         | Maps to acceptance criteria AC-01–AC-08                                  |


**Alternative (faster setup):** Supabase (Postgres + Auth + Storage + Realtime) if timeline is tight.

**Note:** The BRD (§9.2, NFR-007) describes a single-file in-memory HTML prototype. This plan uses a **full-stack POC** so upload/download, audit persistence, and acceptance testing work reliably. A static HTML demo can be added later as an optional export.

### Supported file types (FR-004 — POC extension)


| Category          | Extensions                               | MIME (upload validation)                                                 |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| Documents         | `.pdf`, `.docx`, `.xlsx`                 | `application/pdf`, Office Open XML types                                 |
| Drawings / models | `.dwg`, `.ifc`                           | `application/acad`, `model/ifc` (or `application/octet-stream` fallback) |
| Schedules         | `.mpp`                                   | `application/vnd.ms-project`, `application/octet-stream`                 |
| Data / exchange   | `.xml`                                   | `application/xml`, `text/xml`                                            |
| Archives          | `.zip`                                   | `application/zip`                                                        |
| Images            | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` | `image/`*                                                                |


Reject uploads outside this list in the API and UI file picker (`accept` attribute).

---

## 3. Stakeholder model


| Party | Role                                | CDE role                    | RFI authority                                           |
| ----- | ----------------------------------- | --------------------------- | ------------------------------------------------------- |
| **A** | Project Management Consultant (PMC) | Administrator & oversight   | Full — raise & escalate; receives **all** notifications |
| **B** | Design Consultant                   | Design document owner       | Raise against C or D                                    |
| **C** | Main Contractor                     | Construction document owner | Raise against B or D                                    |
| **D** | Sub-Contractor / Specialist         | Specialist package owner    | Raise against B or C                                    |


---

## 4. Data model (implement in Phase 0)


| Entity            | Key fields / behaviour                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `Party`           | A, B, C, D — roles and permissions                                                                                                       |
| `User`            | One account per party (POC)                                                                                                              |
| `Folder`          | Seed **4 party roots × 11 subfolders = 44** folders (§8)                                                                                 |
| `Document`        | Logical file: name, folderId — links to current latest version                                                                           |
| `DocumentVersion` | Per upload/revision: version number, `uploadedByPartyId`, `uploadedByUserId`, uploadedAt, size, mime, storageKey — **immutable history** |
| `Notification`    | type, recipientPartyId, payload, readAt, createdAt — **no auto-expiry**                                                                  |
| `Rfi`             | id, subject, description, raisedBy, against, relatedDocumentId?, raisedAt, dueAt, status, resolutionText                                 |
| `RfiEvent`        | Append-only RFI timeline: created, pending, resolved, escalated — actor party, timestamp, optional note                                  |
| `ActivityLog`     | Append-only global feed: uploads, version bumps, RFI events (mirrors user-facing history)                                                |


### RFI state machine (§7)

```
Open → Pending → Resolved
              ↘ Escalated (PMC, when overdue)
```


| State         | Who can act                                     | Notifications             |
| ------------- | ----------------------------------------------- | ------------------------- |
| **Open**      | Respondent (resolve); PMC (escalate if overdue) | Respondent + PMC + Raiser |
| **Pending**   | Respondent (finalise response)                  | —                         |
| **Resolved**  | —                                               | Raiser + PMC              |
| **Escalated** | PMC (re-escalate / override)                    | Respondent + PMC          |


### Days remaining colour coding (FR-024)


| Colour | Condition                    |
| ------ | ---------------------------- |
| Green  | 3+ days remaining            |
| Amber  | 1–2 days remaining           |
| Red    | Overdue (0 or negative days) |


---

## 5. Step-by-step implementation procedure

### Phase 0 — Foundation (Days 1–2)

#### Step 0.1 — Repository and environment

1. Initialize Next.js + TypeScript + Tailwind + shadcn/ui.
2. Add `docker-compose.yml`: PostgreSQL, MinIO, app.
3. Define Prisma schema and run initial migration.
4. Create seed script:
  - 4 parties (A, B, C, D)
  - 4 users (one per party)
  - Full folder taxonomy from §8 (44 subfolders under 4 roots)

#### Step 0.2 — Application shell

1. Build layout: top navigation with:
  - Party switcher (FR-031)
  - Notifications bell
  - Main nav: **Dashboard** | **Documents** | **RFI Register** | **Stakeholders**
2. Ensure responsive layout (desktop browsers; §10 web-responsive in scope).

#### Step 0.3 — Authentication and party context

1. Implement login for Party A, B, C, D (FR-029).
2. Store `currentParty` in session; party switcher updates UI context (FR-030, FR-031).
3. Add API middleware for party-scoped queries (NFR-006).

**Phase 0 exit criteria:** App runs locally; users can log in; folders seeded; navigation works.

---

### Phase 1 — Document management (Days 3–5)

#### Step 1.1 — Folder taxonomy (FR-001)

1. Display folder tree or tabs: Party A/B/C/D → 11 subfolders each.
2. Show primary owner labels from §8.

#### Step 1.2 — Upload (FR-002, FR-003, FR-004)

1. Upload modal: select folder, choose file, optional description.
2. Validate file types: PDF, DWG, XLSX, DOCX, XML, MPP (`.mpp`), images, ZIP, IFC.
3. Store binary in MinIO; create `DocumentVersion` row with:
  - file name, folder, **uploading party** (and user), date/time, **version**, file size
4. **Versioning:** same file name in same folder → increment version; **retain all prior versions** in history (do not overwrite blobs).
5. **No preview:** API returns metadata + download URL only — never stream file into an in-app viewer.

#### Step 1.3 — Document register (FR-005, FR-006)

1. Table columns: **name**, **folder**, **uploaded by** (party label), **date/time**, **version**, **size**, **actions** (Download only — no View/Open).
2. Filter by folder (tabs or dropdown) — supports **AC-08**.
3. **Download:** signed URL or API stream → browser saves file locally.
4. **Version history panel** (per document): list all versions with uploader, date, version #, size, Download per version.

#### Step 1.4 — Upload event hook

1. On successful upload, emit event for notification service, `ActivityLog`, and document version history.

**Phase 1 exit criteria:** Upload, list (metadata only), filter, download, uploader visible, full version history — **no in-app file viewing**.

---

### Phase 2 — Notification system (Days 6–7)

#### Step 2.1 — Notification engine (FR-007, FR-008, FR-012)

1. On document upload: create notifications for **all three other parties**.
2. Party A (PMC) **always** receives a copy (dedupe if already in recipient set).
3. Notification payload: uploader identity, document name, folder, timestamp.

#### Step 2.2 — Notification UI (FR-009, FR-010, FR-011)

1. Bell icon in top nav with unread badge count.
2. Dedicated notification panel (dropdown or slide-over).
3. Visually distinguish read vs unread (NFR-002).
4. Mark as read on click; retain full history with **no auto-expiry**.

#### Step 2.3 — RFI notification types (prepare for Phase 3)

Define notification types:

- `RFI_RAISED`
- `RFI_CONFIRMATION` (to raiser)
- `RFI_RESOLVED`
- `RFI_ESCALATED`

**Phase 2 exit criteria:** Upload triggers correct notifications; panel shows read/unread; PMC receives all upload notifications.

---

### Phase 3 — RFI workflow (Days 8–11)

#### Step 3.1 — Raise RFI (FR-013, FR-014, FR-015)

1. “Raise RFI” form: subject, description, respondent party, optional related document.
2. Auto-generate ID: `RFI-001`, `RFI-002`, …
3. Set `dueDate = raisedDate + 7 calendar days`.

#### Step 3.2 — Submit notifications (FR-016, FR-017)

On RFI submission, notify:

1. Respondent party (message: must resolve within 7 days)
2. Party A (PMC)
3. Raising party (confirmation)

#### Step 3.3 — RFI Register (FR-023, FR-024)

1. Table columns: RFI ID, subject, raised by, against, raised date, due date, days remaining, status.
2. Apply green / amber / red colour coding on days remaining.
3. Filter by current party: raised by me / against me / all (PMC oversight).

#### Step 3.4 — State transitions (FR-018, FR-019, FR-020)

1. Respondent: provide written resolution → status **Resolved**.
2. Optional: **Mark Pending** when response in progress.
3. On resolve: notify raising party and Party A (PMC).
4. Append each transition to `**RfiEvent`** (who, when, from-status → to-status, resolution text if applicable).
5. **RFI detail view:** read-only timeline of all events (raise, pending, resolve, escalate) — not editable after the fact.

#### Step 3.5 — Escalation (FR-021, FR-022)

1. Only Party A (PMC) can escalate.
2. Only when RFI is overdue and not Resolved.
3. Status → **Escalated**; send escalation notification to respondent.

#### Step 3.6 — Overdue detection

1. Scheduled job (cron): flag overdue RFIs; enable escalate action for PMC.

**Phase 3 exit criteria:** Full RFI lifecycle from raise → resolve or escalate with correct notifications and register display.

---

### Phase 4 — Dashboard and reporting (Days 12–13)

#### Step 4.1 — Dashboard statistics (FR-025)

Display summary cards:

- Total files
- Open RFIs
- Resolved RFIs
- Stakeholder count (4)

#### Step 4.2 — Recent activity (FR-026)

1. Recent uploads list: file name, **uploaded by**, folder, version, timestamp (metadata only — no preview).
2. Real-time activity log (SSE): new uploads/version bumps, RFI raised/updated/resolved/escalated.
3. Activity entries are links to document version history or RFI detail — not file previews.

#### Step 4.3 — PMC escalation banner (FR-027)

1. When escalated RFIs exist and user is Party A → show prominent banner with links to RFIs.
2. Supports **AC-07**.

#### Step 4.4 — Stakeholders page (FR-028)

Per-party statistics:

- Files uploaded
- RFIs raised
- RFIs resolved

**Phase 4 exit criteria:** Dashboard loads with stats, activity feed, PMC banner, and stakeholder breakdown.

---

### Phase 5 — Access, audit, and polish (Days 14–15)

#### Step 5.1 — Party-scoped data (FR-030, NFR-006)

1. Notifications: show those relevant to current party; Party A sees all.
2. RFIs: show where party is raiser, respondent, or PMC.

#### Step 5.2 — Immutable history (NFR-004)

1. Append-only `ActivityLog`, `DocumentVersion`, and `RfiEvent` — no updates or deletes to historical rows.
2. PMC read-only **History** page: filter by document uploads or RFI events, with uploader/actor party on every line.
3. Confirm no UI route renders file content inline (only download endpoints).

#### Step 5.3 — Performance (NFR-003)

1. Add DB indexes: `folderId`, `partyId`, `rfi.status`, `notification.recipientPartyId`.
2. Paginate document table and RFI register.
3. Target dashboard and RFI register load **< 2 seconds**.

#### Step 5.4 — UX and cross-browser (NFR-001, NFR-002, NFR-008)

1. Plain-language labels and clear CTAs (“Upload document”, “Raise RFI”).
2. Test on Chrome, Edge, Firefox, Safari.

**Phase 5 exit criteria:** Security scoping correct; audit log immutable; acceptable performance; polished UX.

---

### Phase 6 — Acceptance testing and demo (Days 16–17)

Run all acceptance criteria from §11 (see Section 7 below).

Prepare a **15-minute demo script:**

1. Log in as Party B → upload document to folder → show notifications on A, C, D.
2. Raise RFI (B against C) → show PMC notification.
3. Switch to Party C → resolve RFI.
4. Create overdue RFI → switch to Party A → escalate → show dashboard banner.
5. Show stakeholder stats and activity log.

**Phase 6 exit criteria:** All AC-01 through AC-08 pass; demo script rehearsed.

---

## 6. Build order (critical path)

```
Phase 0: DB + Auth + Shell
    ↓
Phase 1: Folders + Upload + Download + Version history (no preview)
    ↓
Phase 2: Upload Notifications
    ↓
Phase 3: RFI Full Workflow
    ↓
Phase 4: Dashboard + Stakeholders
    ↓
Phase 5: Audit + Scoping + Polish
    ↓
Phase 6: Acceptance Tests + Demo
```

---

## 7. Acceptance criteria test procedure


| AC        | Criterion                                                         | Test procedure                                                                        | Pass? |
| --------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----- |
| **AC-01** | Upload as any party triggers notifications to all 3 other parties | Log in as Party B; upload file; switch to A, C, D — each should have new notification | ☐     |
| **AC-02** | Party A receives notification regardless of parties involved      | Raise RFI as B against C; verify A has RFI notification                               | ☐     |
| **AC-03** | RFI due date = raised date + 7 calendar days                      | Raise RFI; inspect due date field in register                                         | ☐     |
| **AC-04** | Respondent can resolve RFI; status → Resolved                     | Switch to respondent party; submit resolution; verify status                          | ☐     |
| **AC-05** | PMC can escalate any overdue RFI                                  | Create/use overdue RFI; log in as A; escalate; verify status Escalated                | ☐     |
| **AC-06** | Days remaining: green / amber / red                               | Visual inspection of RFI register for each colour state                               | ☐     |
| **AC-07** | Escalation banner on PMC dashboard                                | Create escalated RFI; log in as A; verify banner visible                              | ☐     |
| **AC-08** | Document filter by folder works                                   | Click each folder tab/filter; verify table shows only matching documents              | ☐     |
| **AC-09** | Uploaded-by shown on register                                     | Upload as Party C; verify register shows Party C as uploader                          | ☐     |
| **AC-10** | Version history retained                                          | Upload same filename twice; history shows v1 and v2 with correct uploaders/dates      | ☐     |
| **AC-11** | No in-app file preview                                            | Confirm no View/Preview action; only Download opens/saves file                        | ☐     |
| **AC-12** | RFI history timeline                                              | Raise and resolve RFI; detail view shows full event timeline                          | ☐     |


---

## 8. Complete feature checklist

Use this as **Definition of Done** for the POC. Check each item before calling the POC complete.

### §5.1 Document management

- **FR-001** — Structured repository with 4 party folders × 11 subfolders (§8 taxonomy)
- **FR-002** — Any authenticated party can upload documents
- **FR-003** — On upload record: file name, folder, **uploading party**, date/time, version, file size
- **FR-004** — Support file types: PDF, DWG, XLSX, DOCX, XML, MPP (`.mpp`), images, ZIP, IFC
- **FR-005** — Tabular **register** (metadata list) filterable by folder — **not** an in-app file viewer
- **FR-006** — Download function for all uploaded documents (current and prior versions)
- **POC-DOC-01** — **Uploaded by** visible on register and in version history
- **POC-DOC-02** — Full document version history per file (all uploads retained)
- **POC-DOC-03** — **No** in-app preview (PDF, image, DWG, IFC, Office, XML, MPP)

### History (documents & RFIs)

- **POC-HIST-01** — Document version timeline: version #, uploader, date, size, download
- **POC-HIST-02** — RFI event timeline: raised, pending, resolved, escalated — actor + timestamp
- **POC-HIST-03** — Global activity log reflects uploads and RFI changes (NFR-004)

### §5.2 Notification system

- **FR-007** — On upload, notify all three other stakeholder parties
- **FR-008** — Notification includes: uploader, document name, folder, timestamp
- **FR-009** — Dedicated notification panel in top navigation
- **FR-010** — Unread notifications visually distinct from read
- **FR-011** — Full notification history with no auto-expiry
- **FR-012** — Party A (PMC) receives copy of every system notification

### §5.3 RFI workflow

- **FR-013** — Any party can raise RFI against any other party
- **FR-014** — RFI captures: ID, subject, description, raiser, respondent, optional document, raised date, due date
- **FR-015** — Due date auto-set to 7 calendar days from raised date
- **FR-016** — On submit notify: respondent, Party A, raising party (confirmation)
- **FR-017** — Respondent notification states 7-day resolution requirement
- **FR-018** — Respondent can resolve with written response
- **FR-019** — On resolution notify raiser and Party A
- **FR-020** — Status flow: Open → Pending → Resolved or Escalated
- **FR-021** — PMC can escalate overdue unresolved RFIs
- **FR-022** — Escalation sends notification to respondent
- **FR-023** — RFI Register: ID, subject, raised by, against, dates, days remaining, status
- **FR-024** — Days remaining colour-coded: green (3+), amber (1–2), red (overdue)

### §5.4 Dashboard and reporting

- **FR-025** — Dashboard stats: total files, open RFIs, resolved RFIs, stakeholder count
- **FR-026** — Recent uploads list and real-time activity log
- **FR-027** — Prominent escalated RFI banner for PMC (Party A)
- **FR-028** — Stakeholder page: per-party files uploaded, RFIs raised, RFIs resolved

### §5.5 User and access management

- **FR-029** — Four distinct user accounts (one per party)
- **FR-030** — Current party determines visible notifications and RFIs
- **FR-031** — Party switching via top navigation (prototype demo mode)

### Non-functional requirements (POC)

- **NFR-001** — UI navigable without technical training
- **NFR-002** — Read/unread distinguishable at a glance
- **NFR-003** — Dashboard and RFI register load within 2 seconds
- **NFR-004** — All uploads and RFI state changes in immutable activity log
- **NFR-005** — Target 99.5% uptime during business hours (staging/production deploy)
- **NFR-006** — Party-scoped notifications and RFIs
- **NFR-007** — Maintainable codebase (modular; optional static HTML export for academic demo)
- **NFR-008** — Works on Chrome, Edge, Firefox, Safari (desktop)

### Acceptance criteria

- **AC-01** — Upload notifications to all 3 other parties
- **AC-02** — PMC receives all notifications
- **AC-03** — RFI due date +7 days
- **AC-04** — Respondent resolve → Resolved
- **AC-05** — PMC escalate overdue RFI
- **AC-06** — Days remaining colour coding
- **AC-07** — PMC escalation banner
- **AC-08** — Document folder filter
- **AC-09** — Uploaded-by visible on document register
- **AC-10** — Document version history on re-upload
- **AC-11** — No in-app file preview (download only)
- **AC-12** — RFI event history timeline

---

## 9. Folder taxonomy seed data (§8)

Each party (A, B, C, D) has the same 11 subfolders:


| Subfolder ID | Name                         |
| ------------ | ---------------------------- |
| *.1          | 1 INFORMATION REQUIREMENTS   |
| *.2          | 2 DESIGN                     |
| *.3          | 3 PLANNING & SCHEDULING      |
| *.4          | 4 EVM & PROGRESS TRACKING    |
| *.5          | 5 CONSTRUCTION DOCUMENTATION |
| *.6          | 6 SITE MONITORING            |
| *.7          | 7 CORRESPONDENCE & APPROVALS |
| *.8          | 8 CONTRACTS & PROCUREMENT    |
| *.9          | 9 SAFETY & COMPLIANCE        |
| *.10         | 10 SHARED MODELS & DATA      |
| *.11         | 11 ARCHIVE                   |


**Party roots:**

- **A** — PARTY A — PROJECT MANAGEMENT CONSULTANT (PMC)
- **B** — PARTY B — DESIGN CONSULTANT
- **C** — PARTY C — MAIN CONTRACTOR
- **D** — PARTY D — SUB-CONTRACTOR / SPECIALIST

---

## 10. Timeline estimate


| Phase             | Duration     | Deliverable                                                       |
| ----------------- | ------------ | ----------------------------------------------------------------- |
| 0 — Foundation    | 2 days       | Running app, seeded folders, login, nav                           |
| 1 — Documents     | 3 days       | Upload, download, uploader + version history, filter (no preview) |
| 2 — Notifications | 2 days       | Bell panel, upload alerts, PMC copy-all                           |
| 3 — RFI           | 4 days       | Full workflow, register, escalation                               |
| 4 — Dashboard     | 2 days       | Stats, activity, banner, stakeholders                             |
| 5 — Polish        | 2 days       | Scoping, audit, performance, UX                                   |
| 6 — QA / Demo     | 2 days       | AC-01–AC-08, demo script                                          |
| **Total**         | **~17 days** | Demo-ready POC                                                    |


---

## 11. Future phases (reference only — not POC)


| Phase   | Theme         | Features                                                             |
| ------- | ------------- | -------------------------------------------------------------------- |
| Phase 2 | Communication | Email & SMS, @mention, threaded RFI discussion                       |
| Phase 3 | Integration   | In-app file/BIM viewer (if required), GIS, Autodesk/Aconex connector |
| Phase 4 | Analytics     | EVM dashboards, RFI trends, SLA reports, audit export                |
| Phase 5 | Automation    | Auto-escalation, AI RFI categorisation, smart tagging                |


---

*Document generated for PRHUB CDE POC — aligned with PRHUB-CDE-BRD-001 v1.0*
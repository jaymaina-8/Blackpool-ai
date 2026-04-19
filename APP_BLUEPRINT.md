# Blackpool AI — Application Blueprint

This document is the **source of truth** for the Blackpool AI system: a production-oriented blueprint for an MVP that generates short AI-powered promotional videos for businesses.

---

## 1. PROJECT OVERVIEW

**What the app does**  
Blackpool AI takes basic business information (name, website, category), captures a visual of the business website, optionally uses brand assets like a logo, and produces a **short vertical promotional video (MP4)** using the **LTX API**. The video is stored and shown inside the app for review and outreach.

**Who it is for**  
Internal users or a small team doing **video prospecting**: creating personalized promo clips to attract or follow up with business leads.

**What problem it solves**  
Manually producing tailored promo videos is slow and expensive. This app automates the **capture → compose → generate** path so each lead gets a consistent, repeatable video asset without local browser automation or a heavy custom rendering stack in the MVP.

---

## 2. SYSTEM ARCHITECTURE

**Frontend (Next.js App Router, TypeScript, Tailwind)**  
- Authenticated UI: create and browse leads, upload logos, trigger screenshot and video steps, view job status and the final MP4.  
- Talks to Supabase (Auth, Postgres reads/writes where appropriate) and invokes **Supabase Edge Functions** for server-side orchestration and secrets (API keys).

**Supabase**  
- **Postgres**: `leads`, `video_jobs`, `assets` and relationships.  
- **Auth**: login for app users (team members).  
- **Storage**: binary files (logos, screenshots, rendered MP4s).  
- **Edge Functions**: three named functions that encapsulate lead creation, screenshot capture, and video generation.

**Edge Functions**  
- Run trusted logic close to Supabase: validate input, call external APIs (screenshot service, LTX), update rows and storage paths, return structured responses.  
- Hold **LTX** and **screenshot API** credentials via Supabase secrets; the browser never sees them.

**LTX API**  
- Performs **AI video generation** (including **image-to-video** when a screenshot or composite image is supplied).  
- Returns or exposes a job/result that the Edge Function polls or follows until an MP4 URL or binary is available, then the app stores the file in Supabase Storage and records status in `video_jobs`.

### Data flow (step-by-step)

1. User signs in via Supabase Auth (frontend).  
2. User creates a lead (name, website URL, category); frontend calls **`create-lead`** Edge Function (or inserts via RLS-safe path as defined in Phase 1). Function validates and inserts `leads` row.  
3. User uploads logo; file goes to **`logos`** bucket; `assets` row links file to `lead_id`.  
4. User triggers screenshot; frontend calls **`capture-screenshot`**. Function calls external **Screenshot API** with the website URL, receives image bytes or URL, uploads to **`screenshots`** bucket, creates/updates `assets` (and optionally updates `leads` metadata).  
5. User triggers video generation; frontend calls **`generate-video`**. Function builds prompt/parameters, calls **LTX** with image-to-video inputs (screenshot and/or logo per product docs), tracks LTX job until complete, downloads MP4 (if URL), uploads to **`renders`** bucket, updates `video_jobs` and links to `leads`.  
6. Frontend reads `video_jobs` status and storage path, displays the MP4 from **`renders`** (via signed URL or public policy as decided in Phase 1).

---

## 3. CORE FEATURES (MVP ONLY)

- **Lead creation**: Form to add business name, website URL, category; persist as a lead.  
- **Screenshot capture**: One-click (or explicit action) to fetch a website screenshot via external Screenshot API; store and associate with the lead.  
- **Video generation**: Trigger LTX with lead context + screenshot (image-to-video); save MP4; record job lifecycle.  
- **Video display**: On lead detail, show the latest successful render (or list of renders if multiple jobs exist, MVP can show “latest” only).

No CRM sync, no WhatsApp automation, no multi-tenant billing, no background worker queues, no local Playwright, and no advanced AI orchestration in MVP.

---

## 4. DATABASE DESIGN

### `leads`

| Field | Type | Notes |
|--------|------|--------|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | optional, maintained by trigger or app |
| `created_by` | `uuid` | FK → `auth.users.id` |
| `business_name` | `text` | required |
| `website_url` | `text` | required, normalized URL |
| `category` | `text` | e.g. industry or tag |
| `status` | `text` | MVP: `draft`, `ready_for_video`, `video_ready`, `error` (keep enum simple or check constraint) |

**Relationships**: One lead has many `assets` and many `video_jobs`.

### `video_jobs`

| Field | Type | Notes |
|--------|------|--------|
| `id` | `uuid` | PK |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |
| `lead_id` | `uuid` | FK → `leads.id` ON DELETE CASCADE |
| `status` | `text` | `pending`, `processing`, `completed`, `failed` |
| `ltx_job_id` | `text` | nullable; external id from LTX if applicable |
| `error_message` | `text` | nullable |
| `render_storage_path` | `text` | nullable; path in `renders` bucket when done |
| `prompt_snapshot` | `text` | nullable; stored for debugging/retry |

**Relationships**: Many jobs per lead; optional link to primary `assets` used (can be separate columns or a JSON field in MVP—avoid over-modeling; a `source_asset_ids uuid[]` is acceptable if needed later).

### `assets`

| Field | Type | Notes |
|--------|------|--------|
| `id` | `uuid` | PK |
| `created_at` | `timestamptz` | |
| `lead_id` | `uuid` | FK → `leads.id` ON DELETE CASCADE |
| `type` | `text` | `logo`, `screenshot`, (optional `other`) |
| `storage_bucket` | `text` | `logos` \| `screenshots` \| `renders` |
| `storage_path` | `text` | object key |
| `mime_type` | `text` | e.g. `image/png`, `video/mp4` |
| `metadata` | `jsonb` | optional: width/height, source URL, API provider name |

**Relationships**: Many assets per lead; `renders` may also be tracked here or only via `video_jobs.render_storage_path` for MVP—pick one primary place for “where is the MP4” to avoid duplication (recommended: **`video_jobs.render_storage_path`** for MP4, **`assets`** for logos and screenshots).

### Entity relationships (summary)

- `auth.users` 1 — * `leads` (via `created_by`)  
- `leads` 1 — * `assets`  
- `leads` 1 — * `video_jobs`

---

## 5. STORAGE DESIGN

Supabase Storage buckets:

| Bucket | Contents | Access |
|--------|-----------|--------|
| **`logos`** | User-uploaded logo images (PNG, JPG, SVG if allowed) | Authenticated upload; read via signed URLs or authenticated read |
| **`screenshots`** | Website screenshots from Screenshot API | Written by Edge Function; read for preview and for LTX input |
| **`renders`** | Final MP4 outputs from LTX pipeline | Written by `generate-video`; read for playback |

**What goes where**  
- Logos: **`logos/{lead_id}/{filename}`** (or `{asset_id}`—decide in Phase 1 and stay consistent).  
- Screenshots: **`screenshots/{lead_id}/{timestamp}.png`** (or similar).  
- Renders: **`renders/{lead_id}/{video_job_id}.mp4`**.

Row of type `logo` / `screenshot` in **`assets`** points to the correct bucket and path; completed jobs point to **`renders`** path in **`video_jobs`**.

---

## 6. EDGE FUNCTIONS DESIGN

Exactly **three** Edge Functions:

### 1. `create-lead`

**Input** (JSON body, user must be authenticated)  
- `business_name` (string, required)  
- `website_url` (string, required)  
- `category` (string, required)

**Output**  
- `201` with `{ "lead": { ... } }` including new `id`  
- `400` validation errors; `401` if not authenticated

**Logic steps**  
1. Verify JWT / user session (Supabase Auth).  
2. Validate and normalize `website_url` (scheme, basic sanity).  
3. Insert row into `leads` with `created_by` = auth user id, `status` = `draft`.  
4. Return the created lead.

---

### 2. `capture-screenshot`

**Input**  
- `lead_id` (uuid, required)

**Output**  
- `200` with `{ "asset_id", "storage_path", "public_url_or_signed_url_hint" }` as appropriate  
- `404` if lead not found or not owned; `502` if Screenshot API fails

**Logic steps**  
1. Authenticate user; load `lead` and ensure `created_by` matches (or equivalent RLS rule).  
2. Call external **Screenshot API** with `lead.website_url` (MVP: no Playwright).  
3. Receive image (binary or temporary URL); if URL, fetch bytes server-side.  
4. Upload image to **`screenshots`** bucket with deterministic path.  
5. Insert `assets` row: `type = screenshot`, `storage_bucket`, `storage_path`, `mime_type`.  
6. Optionally set `leads.status` to `ready_for_video` if logo + screenshot exist (MVP can skip auto-gating).  
7. Return asset reference.

### Screenshot Rules (MVP)

- Use **desktop viewport only**.  
- Fixed resolution: **1440×900**.  
- Wait for page load / network idle **when the Screenshot API supports it**; otherwise use the provider’s closest equivalent.  
- Screenshot request timeout: **10 seconds max**.  
- If screenshot fails: return a **clear failure** to the client (do not claim success); set `leads.status = error` **or** leave lead unchanged but ensure the UI shows failure—pick one rule in Phase 3 and apply consistently.  
- **Manual retry** only (no automatic re-capture loops).

### Screenshot Quality Check (MVP)

- After capture, verify the image is **not blank** (e.g. simple entropy / mean brightness threshold, or equivalent check supported in Phase 3).  
- Verify **file size** is reasonable: **> 20 KB** (reject tiny/empty payloads).  
- If invalid: treat capture as **failed**; **do not** insert a “successful” screenshot asset, or mark the asset row as invalid and **do not** allow **Generate Video** until a **valid** screenshot exists (pick one approach in Phase 3 and document it).  
- Return a **clear error** to the client; user must **manually retry** capture.

---

### 3. `generate-video`

**Input**  
- `lead_id` (uuid, required)  
- Optional: `video_job_id` for **retry** (if reusing same job row) or omit to create new job (implementation detail in Phase 4: prefer **new `video_jobs` row per attempt** for simple audit)

**Output**  
- `202` or `200` with `{ "video_job_id", "status" }`  
- On failure: `video_jobs.status = failed` and `error_message` set

**Logic steps**  
1. Authenticate; verify lead ownership.  
2. Resolve **screenshot** asset (latest for lead) and optional **logo** asset; fail clearly if screenshot missing.  
3. Create `video_jobs` row: `status = pending`.  
4. Build **prompt** and **LTX parameters** from `business_name`, `category`, and branding context (keep template simple in MVP).  
5. Prepare **image-to-video** payload per LTX docs: primary image = screenshot (composite with logo only if LTX/API supports multi-image or single combined image—MVP may send screenshot only).  
6. Call **LTX API** with server-side API key; store `ltx_job_id` if async.  
7. Poll LTX per **LTX Execution Strategy (MVP)** with **LTX Polling Constraint (MVP Adjustment)** (short in-function window, early **`processing`** return when needed; at most **1** in-function retry where applicable).  
8. On success: download MP4 if given as URL; upload to **`renders`**; set `render_storage_path`; `status = completed`.  
9. On error: set `failed` and `error_message`.  
10. Update `leads.status` to `video_ready` or `error` accordingly.  
11. Return job id and status.

### Pre-Generation Validation (MVP)

Before calling LTX (before creating a misleading **completed** job):

- Confirm a **screenshot** `assets` row exists for the lead (latest valid screenshot).  
- Confirm that screenshot **passed Screenshot Quality Check (MVP)** (e.g. flag in `assets.metadata` or re-validation of stored object size/non-blank rule—prefer persisting the result at capture time).  
- If screenshot is **missing** or **invalid**: **do not** call LTX; **do not** set `status = completed`; return **400** (or equivalent) with a **clear error**; optionally create **no** new `video_jobs` row, or create one with **`failed`** and an explicit message—**never** a false success.

---

## 7. API INTEGRATION (LTX)

**How requests are sent**  
- From **`generate-video`** Edge Function only, using `fetch` (or LTX SDK if officially provided) over HTTPS.  
- **API key** stored in Supabase Edge Function secrets (e.g. `LTX_API_KEY`); never exposed to the client.

**Parameters (conceptual)**  
- **Model / endpoint**: per LTX product documentation (exact names added during Phase 4).  
- **Prompt**: short marketing line derived from `business_name` + `category` + fixed style instructions (vertical, upbeat, CTA).  
- **Image input**: screenshot file (image-to-video); optional second reference (logo) only if API supports it without client-side merging—in MVP, merging can be deferred.  
- **Duration / aspect ratio**: vertical (e.g. 9:16) per product limits.  
- **Webhook vs poll**: MVP uses **polling** inside the Edge Function to avoid extra infrastructure.

**Response handling**  
- If LTX returns **synchronous** MP4 URL or bytes: download and upload to **`renders`**.  
- If **async**: capture job id, poll status endpoint until terminal state, then fetch result URL and upload.  
- Persist `ltx_job_id`, final path, and errors on `video_jobs`.

**Image-to-video flow**  
1. Screenshot (and optionally logo) resolved from Storage.  
2. Image encoded or passed as URL **only if** LTX accepts publicly accessible URLs—otherwise pass multipart/base64 per API spec.  
3. LTX generates video; function retrieves MP4 and stores in **`renders`**.

### LTX Execution Strategy (MVP)

- Assume LTX is **asynchronous** (job-based).  
- After the initial create/start request:  
  - persist **`ltx_job_id`** on `video_jobs`  
  - set **`video_jobs.status = processing`**  
- Poll status every **3–5 seconds** when polling **inside** a single invocation (subject to **LTX Polling Constraint** wall-clock limit).  
- **Maximum time to terminal state: 60 seconds end-to-end** (from job creation or first kickoff—pick one clock in Phase 4 and document in code), **including** follow-up status checks after an early **`processing`** return—see **LTX Polling Constraint (MVP Adjustment)**.  
- If not **completed** within that **end-to-end** window: set **`video_jobs.status = failed`**, append **`error_message`** with a **timeout** reason, and **stop** further automatic polling (never block indefinitely inside one Edge Function).  
- **Retry policy:** at most **1 automatic retry per job** after a failed or inconclusive LTX outcome **within** the same function invocation (if the first attempt errors); if still failing, mark **`failed`** and require **manual** retry from the UI.  
- Store **all** errors in **`video_jobs.error_message`**: **append** each failure (e.g. newline + timestamp + message) through the automatic retry; after **timeout**, append the timeout reason as the final line.

### LTX Polling Constraint (MVP Adjustment)

- Supabase Edge Functions must **not block excessively** on a single invocation.  
- If LTX does **not** complete within a **short** in-function window:  
  - persist **`ltx_job_id`** on `video_jobs`  
  - set **`video_jobs.status = processing`**  
  - **return early** with enough information for the client to **re-check** status later (user-triggered refresh or explicit “Check status” in Phase 4/5).  
- **Polling inside the Edge Function** is allowed only for a **short duration**; **preferred maximum blocking window: ≤ 30 seconds** per invocation (tune in Phase 4, document in code).  
- The **60-second** rule in **LTX Execution Strategy** applies to **end-to-end** job resolution **including** user-initiated or UI-driven **follow-up status checks**, not to holding one Edge Function call open for 60 seconds.  
- Design must stay compatible with a **future non-blocking** status-check flow (same `video_jobs` row, same `ltx_job_id`, no new infrastructure in MVP).

### Prompt Template (MVP)

Every generated prompt **must** include, in order of intent:

1. **Business context**  
2. **Visual instruction**  
3. **Motion instruction**  
4. **Style constraint**  
5. **Negative constraints**

**Example (fill `{category}` and `{business_name}` from the lead):**

> Create a clean vertical promotional video for a {category} business named {business_name}.  
> Use the provided website screenshot as the base visual.  
> Add subtle camera motion and smooth transitions.  
> Maintain a modern, professional, business-focused aesthetic.  
> Avoid distortions, unrealistic effects, unreadable text, or chaotic motion.

*Note: Exact LTX field names and endpoints are filled in during Phase 4 from official docs; this blueprint defines responsibilities and data, not premature abstraction.*

---

## 8. FRONTEND STRUCTURE

### Pages (required)

| Route | Purpose |
|--------|---------|
| **`/login`** | Email magic link or password login via Supabase Auth |
| **`/leads`** | List leads (table or cards); link to detail |
| **`/leads/new`** | Form: business name, website, category → calls `create-lead` |
| **`/leads/[id]`** | Lead detail: logo upload, trigger screenshot, trigger video, status, video player |

### Components (suggested)

- `LeadForm`, `LeadList`, `LeadCard`  
- `LogoUploader`  
- `ScreenshotButton` + preview  
- `GenerateVideoButton`  
- `VideoJobStatus` (`pending` \| `processing` \| `completed` \| `failed`)  
- `VideoPlayer` (HTML5 video, signed URL)  
- Shared layout: nav, auth guard

### User flow

Login → Leads list → New lead → Detail → Upload logo → Capture screenshot → Generate video → Watch MP4; on failure, **Retry** creates a new job or resubmits per Phase 5 rules.

### UI Flow Constraints (MVP)

- **Generate Video** is **enabled only** when a **valid** screenshot exists (passed **Screenshot Quality Check (MVP)**).  
- The UI must show the **step order** explicitly:  
  1. **Create lead**  
  2. **Capture screenshot**  
  3. **Generate video**  
- If screenshot **fails** or is **invalid**, the user must **fix** it (retry capture) before generation is allowed.  
- **Disable** or hide actions **out of order** (e.g. no video button until screenshot valid; Phase 2 may omit video control entirely until Phase 4—Phase 1 scaffolds routes only).

---

## 9. APPLICATION FLOW

1. **User creates lead** — Submits form; `create-lead` persists `leads` row.  
2. **Screenshot is captured** — User triggers `capture-screenshot`; Screenshot API produces image; stored in **`screenshots`**; `assets` updated.  
3. **User triggers video generation** — `generate-video` creates `video_jobs`, calls LTX with image-to-video inputs.  
4. **Video is generated and saved** — Edge Function completes LTX flow, writes MP4 to **`renders`**, updates `video_jobs` and `leads.status`.  
5. **Result is displayed** — Lead detail loads job status and plays video from Storage (signed URL).

### Failure Handling (MVP)

- **All failures must be visible in the UI** (no silent failures).  
- Show a **clear, human-readable error message** (from `video_jobs.error_message`, API response, or a mapped message for screenshot/storage).  
- Provide a **Retry** button for user-triggered recovery; **do not auto-retry silently** in the client.  
- Failure types to surface distinctly where possible:  
  - **Screenshot failure** (provider timeout, 4xx/5xx, invalid URL)  
  - **LTX failure** (rejected job, provider error)  
  - **Timeout** (LTX job not resolved within **60 seconds end-to-end**, including **follow-up status checks** per **LTX Polling Constraint**)  
  - **Storage failure** (upload/download to/from Supabase Storage)

---

## 10. PHASED DEVELOPMENT PLAN (VERY IMPORTANT)

### Cost Control (MVP)

- Default requested video duration: **6–8 seconds maximum**.  
- **Only one generation per lead** until manual **Retry** (no automatic regeneration on asset change in MVP).  
- **Manual retry only** for video (and screenshot per Screenshot Rules).  
- **Testing:** use the **fast / cheaper** LTX model by default in non-production or behind a **“Test render”** path if needed.  
- **Production-quality renders:** use the **pro** model **only when the user explicitly selects** it (toggle or explicit action—implement in Phase 4 UI as a simple control).

### 🔹 PHASE 1 — FOUNDATION

- Supabase project setup  
- Database tables: `leads`, `video_jobs`, `assets`  
- Storage buckets: `logos`, `screenshots`, `renders`  
- Next.js (App Router) + TypeScript + Tailwind project  
- Supabase Auth wired to app (login page, session)  
- RLS policies: users only access their own leads (or team rule—MVP: per-user)

#### Phase 1 Implementation Plan

**A. Phase 1 Objective**  
Phase 1 creates the **technical foundation** so that **authentication**, **Postgres schema**, **Storage buckets**, and a **minimal Next.js shell** are in place with **RLS** and **protected routes**. Later phases add business logic (leads CRUD, screenshots, LTX) **without** redesigning security or core data structures. Phase 1 must leave the repo in a state where **only Supabase + Next.js** are required to run; **no** LTX or screenshot keys are needed yet.

**B. Exact Deliverables**

- Supabase **project** created (dev/staging acceptable for MVP).  
- **Environment variables** documented and wired for Next.js + local dev (see **I.**).  
- **Next.js** app initialized (**App Router**, **TypeScript**).  
- **Tailwind CSS** installed and configured.  
- **Supabase client** helpers for browser (anon key) and, if needed for Phase 1 scripts only, service role **not** exposed to client bundle.  
- **Auth flow**: sign-in on **`/login`**, session readable in app layout.  
- **Protected routes**: unauthenticated users **redirect to `/login`**.  
- **Database schema** applied: `leads`, `video_jobs`, `assets` (see **C.**).  
- **Storage buckets**: `logos`, `screenshots`, `renders` (see **D.**).  
- **RLS policies** enabled and tested for tables and storage (see **F.**).  
- **Base layout**: root layout, auth-aware shell, navigation stub to **`/leads`**.

**C. Database Setup Details**

All three tables exist in Phase 1 so migrations and RLS are **stable** before features land.

| Table | Why it exists | Phase 1 usage |
|--------|----------------|---------------|
| **`leads`** | One row per business prospect; parent for assets and jobs. | **Scaffolded**: schema + RLS. App may show **empty list** or placeholder on **`/leads`**; **no** production create form required until Phase 2. |
| **`video_jobs`** | Tracks LTX lifecycle and render path. | **Scaffolded**: schema + RLS only. **No** Edge Function writes in Phase 1. |
| **`assets`** | Metadata for logos, screenshots, future render references. | **Scaffolded**: schema + RLS only. **No** uploads in Phase 1. |

**Columns (recap for Phase 1 migrations)**  
- **Timestamps**: `created_at` (default `now()`), `updated_at` optional on all three tables.  
- **Ownership**: `leads.created_by` → `auth.users.id` (**required** for RLS).  
- **FKs**: `video_jobs.lead_id` → `leads.id` **ON DELETE CASCADE**; `assets.lead_id` → `leads.id` **ON DELETE CASCADE**.  
- Use **UUID** PKs consistently with section **4**.

**D. Storage Setup Details**

| Bucket | Why create in Phase 1 | Access (MVP preference) |
|--------|------------------------|-------------------------|
| **`logos`** | Phase 2 uploads; bucket + policies ready. | **Private** bucket; **authenticated** read/write via **RLS** + signed URLs for display as needed. |
| **`screenshots`** | Phase 3 writes from Edge Function; path conventions reserved. | **Private**; server-side writes (service role / function) in Phase 3; user reads via signed URLs. |
| **`renders`** | Phase 4 MP4 output. | **Private**; playback via **signed URLs** (short TTL acceptable). |

**Public** buckets are **not** required for MVP; avoid public MP4 URLs unless product explicitly needs them.

**E. Authentication Setup**

- **Supabase Auth** (email magic link and/or password—choose one for MVP in Phase 1 and stick to it).  
- **`/login`**: sign-in UI + Supabase auth call; success redirects to **`/leads`**.  
- **Session persistence**: use Supabase SSR or client pattern appropriate to App Router (implement in Phase 1).  
- **Protected routes**: middleware or layout check; **`/leads`, `/leads/new`, `/leads/[id]`** require session.  
- **Out of scope for Phase 1**: team roles, admin dashboards, org switching, invite flows.

**F. RLS / Security Setup**

**Phase 1 Security Rules**

- **`leads`**: a user may **SELECT/INSERT/UPDATE/DELETE** only rows where **`created_by = auth.uid()`**.  
- **`assets`**: a user may access rows only if the parent **`leads.created_by = auth.uid()`** (policy via `EXISTS` subquery on `leads`).  
- **`video_jobs`**: same as **`assets`**—access only when the related **`leads`** row is owned by **`auth.uid()`**.  
- **Storage**: policies mirror ownership (paths including `lead_id` or object metadata—define exact policy in Phase 1 migration; keep **strict**).  
- **Edge Functions** (Phase 3+): may use **service role** **only inside** functions for provider APIs; **browser** remains **anon + user JWT**, subject to **RLS**.  
- **No** relaxed “public read” for competitor data.

**G. Frontend Foundation**

| Route | Phase 1 expectation |
|--------|---------------------|
| **`/login`** | **Fully functional** sign-in. |
| **`/leads`** | **Scaffold**: protected page; may show empty state or “Phase 2” placeholder text. |
| **`/leads/new`** | **Scaffold**: protected route; placeholder or minimal stub (**no** working form required if Phase 1 scope is tight—prefer stub + nav). |
| **`/leads/[id]`** | **Scaffold**: protected dynamic route; placeholder (“Lead detail — Phase 2”). |

Minimum bar: authenticated users **never** see protected content without login; unauthenticated users **always** hit **`/login`**.

**H. Recommended Phase 1 Folder Structure**

Keep the tree **small**; no feature folders until Phase 2.

```txt
app/
  login/
    page.tsx
  leads/
    page.tsx
    new/
      page.tsx
    [id]/
      page.tsx
  layout.tsx
  page.tsx            # optional: redirect to /leads or /login

components/
  # minimal shared UI only if needed (e.g. SignOutButton)

lib/
  supabase/
    client.ts         # browser client
    server.ts         # server client / cookie helper per SSR pattern

supabase/
  migrations/
    YYYYMMDD_init.sql # or timestamped migration files
```

Avoid extra abstraction layers (no “repository pattern” in Phase 1).

**I. Required Environment Variables (Phase 1)**

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (browser + server). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for client; **RLS** enforced. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** (Edge Functions, CI migrations, or local scripts)—**never** `NEXT_PUBLIC_`. |

**Not required in Phase 1:** LTX API keys, Screenshot API keys, or other third-party secrets.

**J. Phase 1 Build Order**

1. Create **Supabase** project.  
2. Create **Next.js** app (App Router, TypeScript).  
3. Install and configure **Tailwind**.  
4. Add **Supabase** clients under `lib/supabase`.  
5. Implement **Auth** (`/login`, session helper).  
6. Author **SQL migrations** for **`leads`**, **`video_jobs`**, **`assets`**.  
7. Create **storage buckets** `logos`, `screenshots`, **`renders`**.  
8. Apply **RLS** for tables and storage.  
9. Add **middleware** or layout **auth guard** + **`/login`**.  
10. **Scaffold** `/leads`, `/leads/new`, `/leads/[id]` with placeholders.  
11. Run **Phase 1 Validation Checklist** (**K.**).

**K. Phase 1 Validation Checklist**

- [ ] App runs locally (`npm run dev` or equivalent).  
- [ ] **`/login`** completes sign-in without errors.  
- [ ] Session **survives** browser refresh on a protected page.  
- [ ] Unauthenticated access to **`/leads`** redirects to **`/login`**.  
- [ ] Tables **`leads`**, **`video_jobs`**, **`assets`** exist in Supabase SQL.  
- [ ] Buckets **`logos`**, **`screenshots`**, **`renders`** exist.  
- [ ] **RLS** is **enabled** on all three tables (no accidental public read).  
- [ ] Authenticated user can open **`/leads`** and scaffold child routes.  
- [ ] **Service role** key is **not** bundled in client build (verify env usage).

**L. Not Included in Phase 1**

- **`capture-screenshot`** / Screenshot API  
- **Logo upload** UI or Storage writes from app  
- **`generate-video`**, **LTX** integration, **prompt** templates  
- **Retry** / job **polling** UI (beyond empty scaffold)  
- **Video** display / signed URL playback for MP4  
- **Edge Functions** deployment (optional to stub repo folder only—**no** production logic until Phase 3–4 per plan)  

These are **Phase 2+** only; **do not** implement them during Phase 1.

#### Phase 1 Done When:

- **Phase 1 Validation Checklist (K.)** is satisfied.  
- Supabase project, Auth, tables (`leads`, `video_jobs`, `assets`), and buckets (`logos`, `screenshots`, `renders`) exist with **RLS** matching the MVP rule.  
- Next.js (App Router) + TypeScript + Tailwind app runs locally and builds.  
- **`/login`** works; authenticated session persists across refresh.  
- An authenticated user can hit protected routes without bypassing auth; **`/leads`**, **`/leads/new`**, and **`/leads/[id]`** exist as **scaffolded** routes per **G.**

---

### 🔹 PHASE 2 — LEAD MANAGEMENT

- Create lead form (`/leads/new`)  
- Store leads (via `create-lead` or direct insert per Phase 1 decision)  
- List leads (`/leads`)  
- Lead detail page (`/leads/[id]`)  
- Logo upload to `logos` + `assets` row

#### Phase 2 Done When:

- A lead can be **created** from **`/leads/new`**.  
- New leads **appear** on **`/leads`**.  
- **`/leads/[id]`** loads the correct lead.  
- **Logo upload** stores a file in **`logos`** and creates an **`assets`** row.  
- **Data persists** after browser refresh.

---

### 🔹 PHASE 3 — ASSET PIPELINE

- Implement **`capture-screenshot`** Edge Function  
- Integrate Screenshot API (MVP; no Playwright)  
- Store files in `screenshots`; link in `assets`  
- UI: trigger + preview on lead detail

#### Phase 3 Done When:

- **`capture-screenshot`** is deployed and callable with a valid `lead_id`.  
- Screenshots follow **Screenshot Rules (MVP)** (desktop **1440×900**, **10s** timeout, etc.).  
- **Screenshot Quality Check (MVP)** passes (non-blank, **> 20 KB**) before the asset is treated as valid for downstream steps.  
- Screenshot files are stored under **`screenshots`** and linked via **`assets`**.  
- Lead detail **UI** can trigger capture and **preview** the image.  
- On failure, the UI shows an **error** and allows **manual retry** (no silent failure).

---

### 🔹 PHASE 4 — VIDEO GENERATION (CORE)

- Prompt generator (simple templates)  
- LTX API integration in **`generate-video`**  
- Save MP4 to `renders`  
- Track `video_jobs.status` and `ltx_job_id`

#### Phase 4 Done When:

- Prompts follow **Prompt Template (MVP)** and **`prompt_snapshot`** is stored on the job.  
- **`generate-video`** calls LTX using **LTX Execution Strategy (MVP)** + **LTX Polling Constraint (MVP Adjustment)** (**≤30s** preferred in-function blocking, early **`processing`** return, **3–5s** poll interval when polling, **60s end-to-end** timeout via follow-up checks, **1** in-function retry max where applicable).  
- Successful runs produce an **MP4** in **`renders`** and **`video_jobs.status = completed`** with **`render_storage_path`** set.  
- Failures set **`failed`** and **`error_message`**.  
- **Cost Control (MVP)** is respected (duration **6–8s** max, **fast** vs **pro** model selection as specified).

---

### 🔹 PHASE 5 — RESULTS & UI

- Display generated video on lead detail  
- Show job status: loading, success, error  
- Retry generation (new job or explicit retry action)

#### Phase 5 Done When:

- Lead detail **plays** the completed **MP4** (signed URL or equivalent).  
- **Job status** is visible for **pending**, **processing**, **completed**, and **failed** (including **timeout** messaging per **Failure Handling**).  
- **Retry** creates a **new** attempt only via explicit user action (**manual retry**; no auto-regeneration).  
- **Rate Limiting (MVP)** is enforced in the UI (and backed by checks where implemented): no duplicate spam submissions.

---

### 🔹 PHASE 6 — POLISH (OPTIONAL)

- Improve prompts  
- UI polish (loading states, empty states)  
- Basic error handling messages and logging

#### Phase 6 Done When:

- Prompt quality and **UX** meet agreed internal bar (loading/empty/error states).  
- Errors are **consistent** with **Failure Handling (MVP)** (clear copy, no silent failures).  
- Light operational hygiene: basic logging/monitoring notes documented for Edge Functions (no new infrastructure).

---

## 11. RULES FOR EXECUTION

- **Implement only ONE phase at a time.**  
- **Wait for explicit approval** before starting the next phase.  
- **Do not jump ahead**: no video generation code in Phase 1–2; no microservices; no background job systems in MVP.  
- **No overengineering**: avoid premature optimization, advanced AI orchestration, WhatsApp automation, and local Playwright for screenshots.  
- **MVP-first**: smallest working system that completes the flow in Section 9.

### Rate Limiting (MVP)

- **Maximum 1 active video job per user** (`processing` or `pending` for that user)—reject or queue-with-message new **`generate-video`** calls until the active job finishes or fails.  
- **Disable “Generate Video”** (and block duplicate submits) **while** a job for that user is **processing** or **pending**.  
- **Prevent duplicate submissions**: idempotent UI (disabled button, in-flight flag) plus server-side check against **`video_jobs`** for that user’s active rows.

### Additional Rate Safeguards (MVP)

- **Soft limit:** **maximum 5 video generations per user per day** (count **`video_jobs`** rows in **`pending`/`processing`/`completed`** created that UTC day, or a stricter definition chosen in Phase 4—document the rule in code).  
- **Log every generation attempt** (Edge Function + optional client breadcrumb) with **`video_jobs.id`** as correlation id when a row exists.  
- If the threshold is exceeded: MVP may **warn** and still allow (config flag), **or** **block** with **429**/clear message—**start** with **logging + warning** before hard enforcement if product prefers.  
- Tune enforcement in Phase 4/5 without new infrastructure.

### Logging (MVP)

Each Edge Function invocation must emit structured **console/log** output visible in **Supabase Edge Function logs**:

- **Function start** (function name, request id if present).  
- **Sanitized input** (no secrets, no full JWT; `lead_id`, `video_job_id` ok).  
- **External API attempts** (provider name, coarse operation, HTTP status if applicable).  
- **Success or failure** outcome.  
- **Error details** (message, stack where safe—no API keys).

**Correlation:** use **`video_jobs.id`** as the **primary** correlation id for **`generate-video`** once the row exists; for **`capture-screenshot`**, use `lead_id` + new `asset_id` after insert. Prefer a single **`correlation_id`** header or UUID in logs when adding Phase 4.

---

## What to avoid (summary)

- Overengineering, microservices, premature optimization  
- Advanced multi-agent orchestration  
- Dedicated background job queues (defer until product need is proven)  
- WhatsApp or other outbound automation in MVP  
- Local Playwright for screenshots (use Screenshot API)

---

**Status:** Blueprint includes **Phase 1 Implementation Plan** and operational constraints above. **Do not begin coding until approved**; when approved, implement **Phase 1 only**—**not** Phase 2 or beyond.

# Setup instructions — Historic Broyhill (handoff)

You are setting up deployment for the **Historic Broyhill** app. Read this fully
before acting. The app is **already built** on the `main` branch — do **not**
scaffold a new one. Your job is to wire it to a database and host it.

## What this is
- `broyhill/Historic-Broyhill` — a Next.js 15 app (App Router) + Prisma + PostgreSQL + OpenAI + Resend.
- It is an internal **AI lead-gen / operations console**: a guest "Executive Guest Registry"
  capture form (`/capture`) → AI scores the lead + drafts a follow-up email → staff review and
  authorize it in a passcode-protected console (`/admin`).
- The data model lives in `prisma/schema.prisma`. The app connects to Postgres via Prisma using
  the connection string — it does **not** use the Supabase JS client, so no anon/service keys are needed.

## Hard rules (do not break these)
1. **Keep Historic Broyhill 100% separate from BroyhillGOP.** Use a **new Supabase organization** and a
   **new, separate Vercel project**. Never reuse, point at, or touch any BroyhillGOP Supabase project or
   Vercel project. The two businesses must not share billing, data, or credentials.
2. **No keyless or public database endpoints.** The only database access is Prisma over Supabase's
   standard pooler, authenticated by the password inside `DATABASE_URL`. Do not create any unauthenticated
   HTTP-to-SQL gateway.
3. **Secrets only in Vercel env settings** — never commit `.env`, keys, or connection strings to the repo.
4. **Build on `main`.** Do not re-architect or replace the existing app. The LinkedIn lead field and the
   admin LinkedIn display are already merged into `main`.

## Steps

### 1. Supabase — clean project
- Create (or switch to) a **Historic Broyhill** organization — not BroyhillGOP.
- New project: name `historic-broyhill`, region **East US (us-east-1)**, set a strong DB password; save it.
- Open **SQL Editor** → paste the contents of `prisma/supabase-setup.sql` (in this repo) → **Run**.
  This creates all tables (including `LeadProfile.linkedinId`) and seeds the required `broyhill-01` business row.

### 2. Supabase — connection strings
- Top bar → **Connect → ORMs / Prisma**. Copy both strings. Replace `[YOUR-PASSWORD]` with the DB password
  **percent-encoded** (e.g. `@` → `%40`, `:` → `%3A`).
  - `DATABASE_URL` = transaction pooler, port **6543**, append `?pgbouncer=true`
  - `DIRECT_URL` = session, port **5432**

### 3. Vercel — new, separate project
- **Add New → Project → Import** `broyhill/Historic-Broyhill`.
- **Root Directory:** `./` (app is at repo root). Framework auto-detects **Next.js**. Production branch: `main`.
- Do **not** add it under the BroyhillGOP team/scope.

### 4. Vercel — environment variables (Production + Preview)
| Variable | Value / source |
|---|---|
| `DATABASE_URL` | from step 2 (pooler :6543, `?pgbouncer=true`) |
| `DIRECT_URL` | from step 2 (session :5432) |
| `OPENAI_API_KEY` | platform.openai.com (`sk-...`) — lead scoring + email drafting |
| `RESEND_API_KEY` | resend.com (`re_...`) — sends email (optional; without it, drafts stage but don't send) |
| `ADMIN_SECRET_KEY` | a strong passphrase the owner chooses — this is the staff console login passcode |
| `CAPTURE_WEBHOOK_SECRET` | any long random string |
| `EMAIL_FROM` | e.g. `Historic Broyhill <outreach@broyhill.net>` (domain must be verified in Resend to send live) |

### 5. Deploy + verify
- Deploy. Then:
  - `/capture` → submit a test guest → confirm it scores and stages an email (check the console).
  - `/admin/login` → enter `ADMIN_SECRET_KEY` → the review card shows the lead
    (name · company · score · **LinkedIn ↗**) with the drafted email to authorize.

## Notes
- `prisma generate` runs automatically on install (postinstall). No manual Prisma step needed for deploy.
- For future schema changes, update `prisma/schema.prisma` and either run `prisma migrate` against the DB
  or regenerate the SQL and re-run it in the SQL Editor. Keep `prisma/supabase-setup.sql` current.
- Every push to `main` auto-redeploys production; each branch/PR gets its own Vercel preview URL.
- Full reference: `DEPLOY.md` in this repo.
- The owner's cloud sandbox cannot reach Postgres directly (firewall); Vercel can, so the app runs there.

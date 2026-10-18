# Deploy — Historic Broyhill

Three parts, each doing one job:
**GitHub** (code) → **Vercel** (runs it) → **Supabase** (database, HTTPS/keyed).
No raw Postgres ports, no keyless endpoints. The app authenticates to the
database with the password inside `DATABASE_URL` (it uses Prisma, not the
Supabase JS keys — so you do **not** need the anon/service_role keys here).

---

## 1. Supabase — clean project (its own org)
1. In Supabase, switch to (or create) a **Historic Broyhill** organization — *not* the BroyhillGOP org.
2. **New project** → name `historic-broyhill`, region **East US (us-east-1)**, set a strong DB password and save it.
3. **Create the tables:** open **SQL Editor** → paste the contents of
   [`prisma/supabase-setup.sql`](prisma/supabase-setup.sql) → **Run**.
   (Creates every table incl. the LinkedIn field, and seeds the `broyhill-01` business record.)

## 2. Supabase — get the two connection strings
Top bar → **Connect** → **ORMs / Prisma**. Copy the two it shows and replace
`[YOUR-PASSWORD]` with your DB password **percent-encoded** (e.g. `@` → `%40`):

```
DATABASE_URL = postgresql://postgres.<REF>:<ENCODED_PW>@aws-0-<REGION>.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL   = postgresql://postgres.<REF>:<ENCODED_PW>@aws-0-<REGION>.pooler.supabase.com:5432/postgres
```
- `DATABASE_URL` = **transaction pooler** (port 6543) — what Vercel's serverless functions use.
- `DIRECT_URL` = **session** (port 5432) — used for schema/migrations.

## 3. Vercel — new project (separate from BroyhillGOP)
1. **Add New → Project → Import** `broyhill/Historic-Broyhill`.
2. **Root Directory:** `./` (the app is at the repo root). Framework auto-detects **Next.js**.
3. Production branch = `main` (merge the feature branch into `main` first, or use the branch's auto **preview URL** to test).

## 4. Vercel — environment variables (Production + Preview)
| Variable | Value / source |
|---|---|
| `DATABASE_URL` | from step 2 (pooler, 6543) |
| `DIRECT_URL` | from step 2 (session, 5432) |
| `OPENAI_API_KEY` | platform.openai.com → API keys (`sk-...`) — powers lead scoring + email drafting |
| `RESEND_API_KEY` | resend.com (`re_...`) — sends the emails (optional; without it, drafts stage but don't send) |
| `ADMIN_SECRET_KEY` | a strong passphrase **you choose** — it's the staff console login passcode |
| `CAPTURE_WEBHOOK_SECRET` | any long random string |
| `EMAIL_FROM` | e.g. `Historic Broyhill <outreach@broyhill.net>` (domain must be verified in Resend to send live) |

## 5. Deploy + verify
1. **Deploy** → Vercel gives a live URL.
2. Visit `/capture` → submit a test guest → it should AI-score and stage an email.
3. Visit `/admin/login` → enter your `ADMIN_SECRET_KEY` → the console shows the
   lead (name · company · score · **LinkedIn ↗**) with the drafted email to authorize.

## Notes
- Every `git push` to `main` auto-redeploys production; each branch/PR gets its own preview URL.
- Secrets live only in Vercel's env settings — never in the repo.
- This session (the cloud sandbox) can't reach Postgres directly (firewall), but
  Vercel can — so the app runs fine there. No custom SQL gateway needed.

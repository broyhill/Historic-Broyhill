# Deploy — Historic Broyhill

Three parts, each doing one job:
**GitHub** (code) → **Vercel** (runs it) → **Supabase** (database, HTTPS/keyed).
No raw Postgres ports, no keyless endpoints. The app connects with Prisma over the
pooled connection string that the Supabase↔Vercel integration injects — it uses the
`POSTGRES_PRISMA_URL` / `POSTGRES_URL_NON_POOLING` variables, **not** the Supabase JS
anon/service_role keys, and **not** a hand-pasted password.

---

## 1. Supabase — the project
The `supabase-historic-broyhill` project already exists (created via the Vercel
Marketplace integration). **Create the tables:** open it in Supabase → **SQL Editor**
→ paste the contents of [`prisma/supabase-setup.sql`](prisma/supabase-setup.sql) →
**Run**. (Creates every table incl. the LinkedIn field, and seeds the `broyhill-01`
business record. Ignore the integration's `notes`-table quickstart — we use this SQL.)

## 2. Connect Supabase to the Vercel project (auto-wires the database)
Because this Supabase is **managed via the Vercel Marketplace**, you don't copy any
connection string by hand. In **Vercel → Integrations → Supabase**, find
**`supabase-historic-broyhill`** → **Connect to Project** → pick the Vercel project
that runs this app.

That injects the connection into Vercel as `POSTGRES_PRISMA_URL` (transaction pooler,
pgbouncer) and `POSTGRES_URL_NON_POOLING` (direct connection). **The app's Prisma
schema already reads those exact names**, so nothing else is needed for the database —
no secret is ever pasted by hand. (The integration also injects `SUPABASE_*` keys; the
app doesn't use them.)

## 3. Vercel — new project (separate from BroyhillGOP)
1. **Add New → Project → Import** `broyhill/Historic-Broyhill`.
2. **Root Directory:** `./` (the app is at the repo root). Framework auto-detects **Next.js**.
3. Production branch = `main` (merge the feature branch into `main` first, or use the branch's auto **preview URL** to test).

## 4. Vercel — environment variables (Production + Preview)
The database vars (`POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`) are injected
automatically by step 2 — **don't add those by hand.** You only set:

| Variable | Value / source |
|---|---|
| `ADMIN_SECRET_KEY` | a strong passphrase **you choose** — it's the staff console login passcode (**required**) |
| `OPENAI_API_KEY` | platform.openai.com → API keys (`sk-...`) — powers lead scoring + email drafting (optional; without it, leads save with a default draft) |
| `RESEND_API_KEY` | resend.com (`re_...`) — sends the emails (optional; without it, drafts stage but don't send) |
| `CAPTURE_WEBHOOK_SECRET` | any long random string (optional) |
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

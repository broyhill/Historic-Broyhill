# BACKEND_STATUS

Inspected 2026-10-14 (read-only; archives were listed/extracted to `/tmp`, never into the checkout).

## Bottom line

**There is no runnable backend in this repository.** The checkout contains only Markdown blueprints, two archives and a PDF.
There is no manifest, lockfile, server, entry point, `.env`, migration or seed *file* to run. Route handlers, a Prisma schema
fragment and Docker files exist only as **proposed code** (pasted in Markdown) or in a skeleton archive. Nothing here has been
built, started or tested, and no frontend should rely on any URL below yet.

## What exists

| Item | State |
|---|---|
| `Complete Code-historic-broyhill.md` (~327 KB) and numbered batch `.md` files | Chat-transcript style blueprints with code snippets. Not source files. |
| `enterprise_nexus_platform.zip` | Skeleton of the internal admin platform: `package.json`, `pnpm-workspace.yaml`, root + admin-dashboard `Dockerfile`, `docker-compose.yml`, `packages/database/prisma/schema.prisma`. `apps/web-portal`, `apps/ai-workers`, `config/`, `scripts/` are **empty directories**; the nested `enterprise_nexus_platform.zip` is a 149-byte stub. No `pnpm-lock.yaml`, `.env`, migrations or seed. |
| `inspinia-template-main.zip` | Static HTML/CSS/JS UI template (1024 entries). No backend. |
| `KILLED Guide.pdf`, `BUILD_PROMPTS.md`, `CLAUDE.md`, `docs/claude-code.md` | Guidance only. |
| `/site` (public Next.js + Tailwind app) | **Does not exist.** Stack chosen by owner, not implemented. |

## 1. Architecture & stack

- **Intended (internal platform, per archive/blueprints):** TypeScript, Node >= 20, pnpm workspace monorepo, Next.js 15 App Router (route handlers act as the API), Prisma 5 + PostgreSQL (pgvector image), BullMQ + Redis, OpenAI/`ai` SDK, Twilio, SendGrid, Zod, Playwright. Declared in the archive `package.json`.
- **Intended layout:** `apps/web-portal`, `apps/admin-dashboard`, `apps/ai-workers` (Dockerfile expects `dist/main.js`, port 4000), `packages/database`; Dockerfile also references `packages/ui` and `packages/ts-config`, which are absent.
- **Backend entry point:** none present. Not headless: it is a set of Next.js apps (web-portal container serves `server.js` on 3000, standalone output) that serve pages *and* API routes. The Dockerfile's web-portal stage needs `apps/web-portal/next.config.js`, `public/`, and a `package.json`, none of which exist.
- **Public site:** separate and future; static-style content from `/site/data/*.json`; no backend approved (CLAUDE.md).

## 2. API contracts & endpoints

Protocol: REST-style JSON via Next.js route handlers. No GraphQL, WebSockets, or OpenAPI/Swagger (`/docs`, `/openapi.json` not defined anywhere). All routes below are **blueprint-only** (not in any file you can run):

| Route | Method | Request | Response |
|---|---|---|---|
| `apps/web-portal/app/api/v1/webhooks/calendar` | POST | Header `x-nexus-signature` (presence only checked, not verified). JSON `{externalEventId, eventTitle, locationRoomName, startIso, endIso, plannerEmail}` | 201 `{status:"SYNCHRONIZED", bookingId, pipelineTriggered:true}`; 401 missing signature; 422 unknown room; 500 `{error}`. Creates a User (role `EVENT_PLANNER`) if missing, a `CONFIRMED` Booking, enqueues BullMQ `social-media-pipeline`. No payload validation. |
| `apps/web-portal/app/api/health` | GET | none | 200/503 `{status, timestamp, services:{database, memoryAllocation}, telemetryMetrics:{responseTimeMs, memoryUsageMb}}`, `Cache-Control: no-store` |
| `apps/admin-dashboard/app/api/admin/campaigns` | GET | none | 200 array of `AiContentPipeline` with status `PENDING_REVIEW`/`GENERATED`; 500 `{error}` |
| same | PATCH | JSON `{pipelineId (required), targetUserId?}` | 200 `{status:"AUTHORIZED_AND_ENQUEUED", pipelineId, platform}`; 400; 422 no recipient; 500. Sets status `PUBLISHED`, enqueues `omnichannel-dispatch`. |
| `.../exports/route.ts` (CSV export) | ? | Only named in 4th/7th-batch tree listings; no code found | unknown |

Note: the campaign handler has no authentication, so as drafted it is open.

## 3. Authentication & security

- **Not implemented.** No JWT, session cookie, API key, OAuth, NextAuth/Clerk, middleware, or token refresh/persistence code exists. The blueprint only *describes* "middleware verification tokens" for tenant isolation (Complete Code, ~line 2673).
- Only guard in code: presence check of `x-nexus-signature` on the webhook (no cryptographic verification).
- **CORS:** no configuration anywhere. Next.js route handlers send no CORS headers by default, so cross-origin calls from `localhost:3000/5173/8000` would be blocked by browsers, and `credentials: true` is unsupported. Same-origin calls work.
- Hygiene problems in the blueprints: `docker-compose.yml` hard-codes Postgres credentials (`nexus_admin` / a weak password); route handlers hard-code `redis://localhost:6379`. Do not reuse these.

## 4. Database & state

- Intended: PostgreSQL via Prisma 5 (`DATABASE_URL`). Schema in the archive models: Tenant, User, EventSpace, Booking, Ticket, AiContentPipeline, LeadProfile (+ `IntentSubject` enum), LeadActivity.
- **Migrations: none** (no `prisma/migrations`; scripts use `prisma db push`). Nothing to be "up to date".
- **Seed:** `prisma/seed.ts` exists only as Markdown (Complete Code ~line 1481) with mock tenants/rooms/users; it is not a file, and the archive's root `package.json` lacks the `prisma.seed` config (`prisma:seed` would not work as shipped).
- Redis is the queue store (BullMQ). The public-site data is planned as JSON files under `/site/data`.
- Schema drift: Tenant models and event rooms in the blueprint differ from owner-published facts (e.g. Skedda handles real bookings today; CLAUDE.md says preserve that workflow).

## 5. Local environment & running

- **Env vars referenced in the blueprints (none set up):** `DATABASE_URL` (e.g. `postgresql://nexus_admin:<password>@localhost:5432/nexus_platform`), `OPENAI_API_KEY`, `SENDGRID_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `SLACK_OPERATIONS_WEBHOOK_URL`. Redis URL is hard-coded rather than an env var.
- **Dev server command:** none verified. The archive's proposed scripts are `pnpm dev` (`pnpm --parallel dev`), `pnpm prisma:generate`, `pnpm prisma:push`, `pnpm prisma:seed`; infra via `docker compose up` (Postgres 5432, Redis 6379, MailHog SMTP 1025 / UI 8025). These are **proposed and unverified**: the apps have no `dev` scripts or code. Container ports in the Dockerfile: web-portal 3000 (`0.0.0.0`), ai-workers 4000.
- **Base URLs for a frontend:** none can be recommended. If the blueprint is built as drafted: local `http://localhost:3000/api/...` (web-portal) and an admin-dashboard port that is not specified; production host is undecided (Vercel proposed, not approved; do not deploy). A different origin would also need CORS to be added.

## Open decisions for the owner

1. Is the internal platform to be built out of the blueprints (and which source wins where batches differ), or is only the public Next.js site in scope?
2. Auth approach, CORS policy and secret handling before any API is exposed.
3. Whether the archive skeleton (empty app directories) is the intended state or an incomplete export.

## Checks run

Repository file listing, archive listing/extraction to `/tmp`, grep of the Markdown for routes, env vars, auth/CORS. No build, install, test or server start was possible or attempted.

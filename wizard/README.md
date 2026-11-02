# Wizard of Oz — embedded copy (single-user test ground)

Copied verbatim from `XSELLNET/wizard` (E68 agency spine) for use inside
Historic-Broyhill as a single-user test ground.

## What it is

A self-contained Next.js 15 + Prisma app — agency console, 11-gate dispatch
chain (inert by default), immutable variants, inbound capture, unsubscribe/
suppression, Resend webhooks, 48h journeys, block-studio template editor.
Its own `package.json`, `prisma/schema.prisma`, and `tests/` ride inside this
folder; nothing in it is imported by the root HB app, so the production build
and admin panel are unaffected.

## Run it

```bash
cd wizard
npm install
cp .env.example .env   # or set DATABASE_URL / POSTGRES_PRISMA_URL yourself
npm run db:push:dev    # dev-DB guarded, throws if pointed at prod
npm run dev            # http://localhost:3000/admin
```

Dispatch is deliberately inert: the provider/gate adapters
(E20_GO / E10_CLEARANCE / PLATFORM_SUPPRESSION) fail closed to dry-run until
bound. See `docs/platform/ECOSYSTEM_MAP.md` (X-00) in XSELLNET for the status
ledger.

## Known reconciles before this merges INTO the HB app

- `LeadProfile`, `JourneyRun`, `AiContentPipeline`, `Business` exist in BOTH
  schemas with different fields — this copy stays a separate app until those
  models are reconciled into the root `prisma/schema.prisma` (single-user
  variant of the wizard_agency schema).
- Tenant/RBAC machinery (`CandidateSilo`, `CandidateUser`, `rbac.ts`,
  `scope.ts`, `tenant.ts`) is multi-tenant plumbing — single-user HB will
  collapse it to one owner scope in the merge pass.

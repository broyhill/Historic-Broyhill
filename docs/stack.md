# Technology Stack

Aligned with the design in the uploaded blueprint ("Complete Code-historic-broyhill.md"): a TypeScript-first monorepo. This replaces the earlier Django/Celery proposal.

| Area | Choice | Notes |
|------|--------|-------|
| Monorepo tooling | pnpm workspaces, Docker / docker-compose | `apps/` and `packages/` layout |
| Public site | Next.js 15+ (App Router) | `apps/web-portal` |
| Admin UI | Inspinia (Bootstrap/HTML edition assumed) | `apps/admin-dashboard`; UI work comes after the backend |
| Backend / API | Node.js (NestJS) | Leases, bookings, CRM, payments |
| Database | PostgreSQL with pgvector | Prisma schema in `packages/database` |
| AI orchestration | LangGraph or Vercel AI SDK | Customer-service assistant and marketing drafts |
| Background jobs | BullMQ (Redis) | Email/SMS automation, webhooks, scheduled posts |
| Payments (deposits) | Stripe, behind an abstract payment interface | Gateway can be swapped |
| SMS | Twilio | Provider choice, not from the blueprint |
| Email | SendGrid | Provider choice, not from the blueprint |
| Hosting | To be decided | Blueprint mentions Vercel for the web app |

## Product scope

Office and conference center site for Historic Broyhill: 35 office suites (currently sold out, periodic vacancies), and an event center for weddings, conferences and training sessions. The facility rents space only. Features: inquiries and waitlist, tour and appointment booking, event reservations with deposits and RSVPs, CRM for tenants and prospects, and automated email and SMS.

## Open items

- Confirm the Inspinia edition.
- Confirm provider accounts for Stripe, Twilio and SendGrid.
- Confirm hosting.

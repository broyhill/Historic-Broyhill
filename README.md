# Historic Broyhill

Platform for **Historic Broyhill Offices and Conference Center**: 35 Class A office suites and an event center. The backend handles suites and tenants, a CRM with waitlist, tour appointments, event reservations with deposits and RSVPs, and automated email/SMS. The Inspinia admin template is in `apps/admin-dashboard` (UI work comes after the backend). The public website is built later.

## Layout

| Path | Purpose |
|------|---------|
| `apps/api` | NestJS backend API (all endpoints below) |
| `apps/admin-dashboard` | Inspinia admin template (static HTML, not yet wired to the API) |
| `packages/database` | Prisma schema and seed |
| `docs/` | Stack notes and the original design transcripts (`docs/blueprints`) |

## Run locally

```
cp .env.example .env            # fill in JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
docker-compose up -d postgres redis mailhog
pnpm install
pnpm prisma:generate && pnpm prisma:push
pnpm prisma:seed                # creates the first admin (SEED_SAMPLE_DATA=true adds placeholder suites/spaces)
pnpm dev                        # API on http://localhost:4000, docs at /api/docs
pnpm test                       # needs DATABASE_URL pointing at a dedicated, empty test database
```

Stripe, SendGrid and Twilio are optional. Without them, deposits are recorded as `manual` payments and messages are logged with status `SKIPPED`.

## API (prefix `/api/v1`, interactive docs at `/api/docs`)

**Auth** `POST /auth/login` returns an access token. Send it in the `Authorization` header (JWT bearer scheme) on every `/admin/*` route. `GET /auth/me` returns the current user. Roles: `STAFF` can do everything except what is `ADMIN` only (user management and deletes).

**Public** (for the website)

| Endpoint | Purpose |
|----------|---------|
| `GET /public/suites`, `/public/suites/:id` | Suites (no tenant details); `?status=VACANT` |
| `GET /public/event-spaces`, `/:id`, `/:id/availability?from&to` | Event spaces and busy times |
| `POST /public/inquiries` | Office or event inquiry; auto-waitlist when no suite is vacant |
| `POST /public/appointments` | Request a tour |
| `GET /public/bookings/quote` | Price and deposit for a space and time |
| `POST /public/bookings` | Request an event reservation (conflict-checked) |
| `GET /public/bookings/:reference` | Booking status |
| `POST /public/bookings/:reference/deposit` | Start a deposit payment |
| `POST`/`DELETE /public/bookings/:reference/rsvps` | RSVP / cancel RSVP |
| `POST /public/webhooks/stripe` | Stripe webhook |

**Admin**

| Area | Endpoints |
|------|-----------|
| Dashboard | `GET /admin/dashboard/summary` |
| Suites | `GET/POST /admin/suites`, `GET/PATCH/DELETE /admin/suites/:id` |
| Tenants | `GET/POST /admin/tenants`, `GET/PATCH/DELETE /admin/tenants/:id` |
| Leads (CRM) | `GET/POST /admin/leads`, `GET/PATCH/DELETE /admin/leads/:id`, `POST /admin/leads/:id/activities` |
| Appointments | `GET /admin/appointments`, `GET/PATCH /admin/appointments/:id` |
| Event spaces | `GET/POST /admin/event-spaces`, `GET/PATCH/DELETE /admin/event-spaces/:id` |
| Bookings | `GET/POST /admin/bookings`, `GET/PATCH /admin/bookings/:id`, `POST /admin/bookings/:id/confirm`, `/cancel`, `GET /admin/bookings/:id/rsvps`, `POST /admin/rsvps/check-in` |
| Payments | `GET /admin/payments`, `POST /admin/bookings/:id/payments`, `POST /admin/payments/:id/refund` |
| Messages | `GET /admin/messages`, `POST /admin/messages/send`, `POST /admin/messages/process-queue` |
| Users | `GET/POST /admin/users`, `PATCH/DELETE /admin/users/:id` |

**Automation** (scheduled): queued messages are delivered every minute; reminders go out for confirmed events within 48 hours; tenants get a check-in 90 days before lease end.

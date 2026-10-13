# Technology Stack (Step 1)

Proposed defaults, chosen because none were specified. Each is easy to change before Step 2.

| Area | Choice | Reason |
|------|--------|--------|
| Backend and public site | Python / Django | Built-in ORM, auth, admin tooling and migrations; good fit for CRM-style data |
| Database | PostgreSQL | Relational data (suites, leases, bookings, payments); works with the existing `sql/` and `schema/` files |
| Admin UI | Inspinia (Bootstrap/HTML edition) | Static theme that integrates cleanly with Django templates |
| Background jobs | Celery + Redis | Scheduled and triggered email/SMS automation |
| Payments (deposits) | Stripe | Standard for deposits and refunds |
| SMS | Twilio | Standard for SMS, with opt-out handling |
| Email | SendGrid | Transactional and campaign email |
| Hosting | To be decided | Needs a host that runs Django, PostgreSQL and Redis |

## Open items

- Confirm which Inspinia edition is licensed; the choice above assumes Bootstrap/HTML.
- Confirm provider accounts for Stripe, Twilio and SendGrid.
- Confirm hosting.
- Add the existing tech definitions, SQL and schema files to `docs/`, `sql/` and `schema/` so later steps build on them.

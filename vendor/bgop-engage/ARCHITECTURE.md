# BGOP Engage — Architecture

```
                    ┌─────────────────────┐
                    │   E68 Wizard / UI   │
                    └──────────┬──────────┘
                               │ author journeys / campaigns
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     BGOP ENGAGE (this app)                   │
│  profiles · propensities · catalog · journeys · campaigns    │
│  data_feed (→ LP) · webhooks (→ brain.event_queue)           │
└───────────────┬─────────────────────────────┬────────────────┘
                │ coeffs / events             │ send jobs
                ▼                             ▼
        ┌───────────────┐              ┌─────────────┐
        │ E60 LP (SoR)  │              │ E30 Email   │
        │ decide ask /  │─────────────▶│ SendGrid/SES│
        │ channel / FEC │  decision    │ (gun only)  │
        └───────────────┘              └─────────────┘
                │
                ▼
        ┌───────────────┐
        │ E20 Brain     │  brain.event_queue / action_executors
        └───────────────┘
```

## Boundaries

| Owns | Does not own |
|---|---|
| Engagement profiles, journeys, catalog, native propensities | Donor signature spine (Hetzner core) |
| Orchestration of message intent | PCI / donation processing |
| Calling E30 to send email | Iterable / Braze / Marketo SaaS |
| Emitting engagement events to Brain | LP portfolio optimization (E60) |

## Identity

- `engage_user_id` = candidate-scoped pseudonym (maps to `cluster_id` via map table)  
- `cluster_id` = INTEGER (canon)  
- Never push full donor signature to a third-party MA cloud  

## Servicing

One folder: `ecosystems/bgop_engage/`.  
One schema: `engage.*`.  
One migration entrypoint: `database/migrations/062_BGOP_ENGAGE.sql`.

2026-10-03: pre-canon 'E19 LP' corrected to E60 per PORT_LIST §2. E19 is Social Media.

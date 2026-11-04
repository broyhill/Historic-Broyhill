# AI CMO — architecture and user journey for the Historic Broyhill platform

How Larven's AI CMO works (read from larven.ai/ai-cmo, 2026-10-29) and the
design that makes ours better for a venue business.

## Their process

A daily five-step loop, no human in it by default:

1. **Plan** — reads products, past winners, audience; builds campaign structure on the Meta ad account.
2. **Create** — generates fresh image/video ads from the product catalog daily, before creative fatigues.
3. **Test** — puts new audiences against winning creative, predicts next spend.
4. **Reallocate** — pauses losers, moves budget to winners, inside a daily cap.
5. **Report** — every action logged and auditable; yesterday's results are today's brief.

Two modes: **Execute** (acts, logs everything) and **Suggest** (proposes, waits
for approval). Hard rails either way: daily budget cap, any ad pausable by the
owner, fee = % of your ad spend on *your* own ad account.

## Where it sits in our platform

The CMO is not a new app — it's a coordinator over pieces we already have:

```
                ┌──────────────────────────────┐
                │      CMO loop (daily)        │
                │  plan → create → launch →    │
                │  measure → reallocate → log  │
                └──────────────┬───────────────┘
        ┌──────────┬───────────┼───────────┬──────────┐
        ▼          ▼           ▼           ▼          ▼
   Venue       Studios      Connections  Capture/   Review queue
   catalog  (email/social/  (Meta OAuth  leads DB   + Today dash
   (rooms,   video/ads) +    → ad acct)   (events,  (approve or
   pkgs,     photo lib +                  inquiry   execute)
   avail)    image-gen                   attribution)
```

Mapping to existing code:

| Larven piece | Ours |
|---|---|
| Product catalog | `lib/spaces`, AvailabilityBlock, packages — the venue inventory is our catalog |
| Creative generation | Studios + photo library + `lib/image-gen` + template catalog (1,342) |
| Launch on ad account | Connections → `/api/admin/connect/meta` → Meta Marketing API writes |
| Read results | Meta Ads insights → `/api/capture` attribution → `metrics` feed |
| Budget moves | Autopilot rules on the cron runner pattern (`lib/journey-runner`) |
| Audit log | Journey/pipeline records already persisted; every CMO action lands as a Review-queue row |
| Suggest mode | **Already built** — draft → Needs-you queue → approve journey |
| Execute mode | Same queue, auto-approve flag behind Ed's phrase ("ads approved"), mirroring "email approved" |

## Where we're better

- **Our catalog is richer.** Larven sells SKUs; we sell dated inventory —
  a room, a date, a package. The CMO can act on *occupancy*: a soft Saturday
  in six weeks is itself the brief ("push Magnolia Room Dec weddings"), not
  just "more ads."
- **Our approval journey is native.** The draft→review→send flow already
  exists; Larven bolts Suggest mode on. Suggest is our default, Execute is
  one phrase away.
- **Attribution closes the loop.** A captured inquiry carries source tags —
  the CMO sees which ad produced a tour request and a won event, i.e.
  revenue, not clicks. That's the same "budget follows revenue" claim,
  but for bookings.
- **It's our account, our app.** No % of spend, no subscription, and the
  customer list never leaves our DB.

## User journey (Suggest mode, v1)

1. 06:00 cron: CMO reads occupancy gaps + yesterday's lead/inquiry stats and
   writes a plan card to Today ("Magnolia Room has 3 open Dec Saturdays — draft
   a Meta push?").
2. Owner opens **Today → Needs you**, taps Review: sees the 3 drafted ads
   (real photos, verified copy), edits one, approves.
3. On approval, Ad studio ships the ad set through the connected Meta account;
   rows log to History with the ad IDs.
4. Nightly: CMO pulls insights (spend, leads attributed via capture tags),
   pauses anything over target cost-per-lead, queues tomorrow's plan.
5. Owner sees a one-line report card on Today: "Spent $40 → 2 tour requests."

Execute mode = step 2 skipped once Ed says the phrase; every action still
lands in the audit log.

## Build order

1. Meta connection live (env creds + callback token exchange).
2. Ad studio v1: compose ad sets from venue catalog + photo library.
3. CMO planner: daily cron writing plan cards + drafts into the queue.
4. Insights ingest + pause/reallocate rules behind the daily cap.

# AI CMO — architecture and user journey for the Historic Broyhill platform

Revised after a second pass through Larven's docs (help center + tool pages,
2026-10-29). The first draft caught the daily ad loop but missed their four
intelligence pillars; this version covers the whole system.

## What Larven actually runs (fuller picture)

Beyond the daily plan→create→launch→test→reallocate loop, the product has
four bigger systems:

1. **Competitive analysis** — a free/public tool (`tools/competitor-ads-finder`)
   that reads Meta's public Ad Library: for any brand you get every live ad,
   how long each has run, the format mix, the offer and CTA. Their teaching:
   *duration is the signal* — an ad kept live for months is an ad somebody
   keeps choosing to pay for; a wave of new creative with nothing old behind
   it is a brand testing from scratch. A companion tool "takes apart any
   store" (product/offer teardown).

2. **Market analysis** — Statlas: benchmarks computed across 170+ brands so a
   brand can score itself against its niche ("brands testing 20+ ads/month
   see 65% higher ROAS"), not against nothing.

3. **Competitor monitoring** — inside the app, Explore: save competitors (or
   Auto-find discovers them for the brand), then a standing feed of their
   live Meta *and* TikTok creative plus an "inspiration feed" of proven ads.
   One click: **Clone Ad / Recreate / Remix** — the competitor's ad becomes
   the brief for a new creative for *your* brand, never a copy. This is
   "maintain competitors' product offering and monitor their complete ad
   plan": they watch what the competitor sells, what they push, for how long.

5. **Review monitoring** — watch the venue's reviews (Google, Facebook,
   WeddingWire/The Knot, Yelp). New reviews land in the Needs-you queue with
   a drafted reply; rating trend rides on Today. Reviews also feed creative —
   real quotes are our best "why I love" copy — and a bad-review spike changes
   the weekly plan before it becomes a reputation problem.

6. **Tripwire measurement across every touch** — the funnel is a chain, not a
   click: ad → landing page visit → inquiry → tour request → tour → booking.
   Each link is a tripwire carrying a touch ID (`?utm`/`?from` on landing,
   link tokens in emails, tagged short codes in texts, the proposal token we
   already issue). `/api/capture` already tags the inbound side; extend it so
   every channel emits the same touch record (channel, campaign, creative,
   landing page, competitor-inspired?). Then the weekly report can say
   *which wire tripped*: "the Dec-weddings landing page → text follow-up →
   tour" chain produced 2 of 3 bookings; the email-only chain produced none —
   and the CMO shifts weight accordingly.

7. **Annual plan + weekly justification** — the Marketing calendar holds the
   year's promotions; Atlas (the in-app CMO chat) adds/edits promos, writes
   weekly what changed, and the AI CMO reports each budget/creative action
   it took against that plan — the account is auditable week over week, not
   a black box. Atlas also keeps **brand memory** (lasting facts: positioning,
   pricing, what flopped) shared across every chat and teammate, and enforces
   **brand rules** (claims you may not make) on every generation.

Their sidebar shape, for reference: Home · Ads Autopilot · Create · Atlas ·
Library · Explore · Marketing (overview, calendar, landing page, Meta Ads,
TikTok Ads, Creative Analytics, history) · Social · CRM · Products.

## Where it sits in our platform (revised)

```
        ┌─────────────────────── CMO core ───────────────────────┐
        │  Annual plan  →  weekly loop  →  audit log            │
        │  (calendar of        plan/create/    every action      │
        │   seasons+promos)    launch/measure/  to History       │
        │                      reallocate                        │
        └───────┬──────────┬───────────┬───────────┬────────────┘
                ▼          ▼           ▼           ▼
        Intelligence   Studios    Connections  Venue spine
        ────────────   + photo    (Meta/TikTok (catalog: rooms,
        Competitors    library    → ad accts)   dates, packages,
        + Ad Library   + image-               occupancy,
        + market       gen                    leads, events)
        benchmarks
```

Mapping, with what exists vs what to build:

| Larven pillar | Ours | Status |
|---|---|---|
| Ad loop (plan→create→launch→test→reallocate) | CMO cron writing drafts → Review queue → Meta via Connections | Design |
| Product catalog | Venue inventory: rooms, packages, dated availability, occupancy | **Exists** |
| Creative engine | Studios, photo library, `lib/image-gen`, 1,342-template catalog | Exists |
| Competitive analysis | Ad Library reader (Meta's public API — free, no account) + venue teardowns of Graylyn/Grandover/etc. | To build |
| Market analysis | Venue-market benchmarks: occupancy, inquiry rates, seasonal wedding/corp demand across our compset | To build |
| Competitor monitoring | Saved competitors list → weekly pull of their live ads + offers → feed card in Today | To build |
| Clone/remix | "Use this" button on a competitor ad → Ad studio drafts our version on real photos | To build |
| Review monitoring | Watcher on Google/FB/WeddingWire/The Knot → drafted reply in the queue; rating trend on Today | To build |
| Tripwire measurement | One touch record per link (landing, email link, text code, inquiry, tour, booking) via `/api/capture` + proposal tokens | Extends existing |
| Annual plan | Marketing calendar model: seasons, holidays, venue pushes; CMO drafts it, Ed approves | To build |
| Weekly justification | Weekly CMO report card vs plan ("week 6 of 52: spent $280 → 9 tour requests → 2 bookings; on plan") | To build |
| Brand memory | `BrandMemory` table — lasting facts/rules applied to every generation | To build |
| Audit log | Existing pipeline/journey records + History | **Exists** |

## Where we're better — updated

- **They monitor competitors' ads; we monitor competitors' *inventory*.** A
  venue competitor's ad plan is interesting; their *booked dates, rates and
  packages* are decisive. Our watcher reads both — public ad libraries plus
  public booking/availability signals — so the weekly plan can say "Graylyn
  just opened a holiday package at $X; our Dock undercuts it" and write the
  counter-ad the same day.
- **Attribution goes to revenue.** Ad-platform leads are tagged through
  `/api/capture` to tour requests and won events — the weekly justification
  shows bookings, not clicks. Larven can only honestly do this on Shopify.
- **Brand memory with teeth.** We already hard-verify venue facts; the CMO's
  rules layer means a generation literally cannot claim an invented capacity
  or price — the `[CONFIRM:]` doctrine enforced by code.
- **One year vs one account.** The annual plan keys off our real calendar —
  wedding season, corporate offsite season, holiday-party season, The Dock's
  outdoor months — so "week 38 of 52" means something a generic ad tool can't.
- **Owned, not rented.** No % of ad spend, no per-seat fee, the competitor
  intelligence and brand memory live in our DB.

## User journey (the four pillars + the loop)

**Setup week:** Ed saves 5–8 named competitors (Graylyn, Grandover, Carolina
Inn, Biltmore, Kimpton, Wyndham Winston-Salem, the Barn venues). The watcher
auto-finds their Meta/TikTok ad presence and takes a first read: live ads,
longest-running offers, format mix, visible packages/pricing.

**Annual plan:** CMO drafts a 52-week marketing calendar — occupancy gaps,
seasons, holiday pushes, promo windows per room. Ed edits and approves it on
one screen; it lands as the plan every week is justified against.

**Weekly rhythm (Suggest mode):**
1. Sunday night: watcher pulls competitors' new/paused ads and any changed
   offers; CMO flags deltas ("Grandover launched a corporate-retreat push —
   first new creative in 6 weeks").
2. Monday 06:00: CMO writes the week card — plan step for this week, drafted
   ads/posts (real photos, verified copy), any competitor-inspired remix.
3. Ed opens **Today → Needs you**, reviews, edits, approves.
4. Ads launch through the connected Meta account; every action logs.
5. Nightly: insights pulled, leads attributed; anything over target
   cost-per-tour-request pauses itself inside the daily cap.

**Weekly justification (Friday):** a report card on Today — "Week 6 of 52.
Plan said: 2 wedding pushes + 1 corporate. Ran: all 3. Spent $280 → 9 tour
requests → 2 bookings. Graylyn outspent on video; recommend their exact
format next week. On plan / behind plan + why." That paragraph is the
"justify week to week progress" Ed described.

**Execute mode:** approval skipped once Ed's phrase lands; log unchanged.

## Build order

1. Competitor watcher: saved-competitors model + Meta Ad Library reader +
   weekly feed to Today.
2. Marketing calendar (annual plan object) + the week-card and Friday report
   card surfaces.
3. Meta connection live (env creds + token exchange).
4. Ad studio v1: compose ad sets (incl. competitor-remix) from venue catalog.
5. Reallocate rules behind the daily cap; brand-memory table.
6. Review watcher + drafted replies into the queue.
7. Tripwire touch records across landing/email/text → capture → attribution
   into the weekly report.

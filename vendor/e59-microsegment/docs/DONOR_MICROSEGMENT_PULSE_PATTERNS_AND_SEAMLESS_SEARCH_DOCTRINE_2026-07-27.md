# Donor Microsegment Pulse, Pattern Universe & Seamless Search Doctrine

**Date:** 2026-07-27  
**Authority:** Ed Broyhill (EDGAR) — teaching session to Cursor  
**Status:** CANONICAL DOCTRINE (not a dry-run, not a draft protocol stub)  
**Branch intent:** `cursor/microsegment-pulse-seamless-search-doctrine-3bec`  
**Full subject paper (~20 pp):** `PREDICTING_DONOR_BEHAVIOR_NOT_VOTER_BEHAVIOR_COMPLETE_2026-07-27.md`

## Ecosystem filing (where this lives)

| Eco | Role in this doctrine |
|---|---|
| **E01** Donor Intelligence | 11-year gift graph, LTV, pattern detection from checks |
| **E13** Donor Tattoo / warehouse | Identity + enrichment bind; NAICS/SIC on employers |
| **E42** News Intelligence | Pulse monitor — which microsegments light up today |
| **E59** Microsegment assignment | Segment membership / assignment state |
| **E63** HEATMAP calibration | Heat / salience calibration to money response |
| **E20 / Brain** | Routing lit segments → weapons (after legal gates) |
| **E68** Campaign Wizard | Commander cockpit — human operates the pulse |
| **Search / Commander UI** | Seamless AI search & sort across all microsegments |
| **Voter attribute layers** (not donor definitions) | DataTrust, Acxiom, bespoke, Personicx — predict voters / lookalikes; fuse to gift graph |

**Related canon (do not replace):**  
`MICROSEGMENT_ROI_DOCTRINE_2026-06-23.md`, `MICROSEGMENT_RESPONSIVENESS_LOOP_2026-06-14.md`, `MICROSEGMENT_HEAT_MAP_CANON_16_2026-06-16.md`, `ISSUE_RESPONSE_DOCTRINE_2026-07-07.md`, `BGOP_SEARCH_ENGINE_MASTER_PLAN.md`, Issue Salience Pulse Engine specs.

---

## 1. Purpose

Maximize political campaign donations by treating the platform as a **living map of microsegments** — not a flat donor list, not a file index.

The critical human/AI product is **seamless search and sort across all microsegments**: which are lit, what they’re worth today, who is in them, which office/district/jurisdiction they attach to.

---

## 2. Two clocks (do not confuse them)

### A. Behavioral spine — donors (11-year history)
NC / federal giving history is ground truth: who gave, how much, how often, to whom, in which cycles. This **defines** a donor.

### B. Voter attribute layers — prediction fabric
**DataTrust · Acxiom · bespoke · Personicx** are **attribute variables for predicting voters** (and lookalike future givers). They are **not** donor datasets. They enrich identity and power conversion models. Welding them into rollup “presence” does not make them gift ledgers.

**Fusion:** history calibrates; attributes project; news times the ask.

---

## 3. Master pattern — jurisdiction

Every committee and subcommittee has jurisdiction over elements of life in the state — global energy, building codes, insurance, courts, schools, ports, wildlife, taxes, land use, and on. Bills sponsored, co-sponsored, voted for/against create **hundreds → thousands of microsegments** donors respond to.

> **Donor ↔ issue microsegment ↔ committee jurisdiction ↔ bill/vote record**

This is the biggest pattern. Faction, faith, profession, and affinity sit under it.

Local proof: trial attorneys donate heavily to **judicial / sheriff / DA** — those offices are their jurisdiction. Builders → local permit/zoning regulators. School-only donors → school board. Same law at every level.

---

## 4. Pattern catalog (revealed by the gift graph)

Patterns are recurring shapes in the 11-year ledger — not stereotypes. Identity hints; **checks prove**.

| Pattern family | Example |
|---|---|
| Office lane | Federal-only, state-only, judicial, school, sheriff / local |
| Faction intensity | Trump-max (millions to Trump vehicles); anti-Trump (gave to critics/opponents, $0 to Trump) |
| Faith / affinity | Evangelical → evangelical candidates only |
| Profession / pocketbook | Doctors → health/malpractice/insurance power; NAICS/SIC → industry regulators |
| Committee-mask | Party committee only (federal/state) to disguise candidate involvement |
| Charity–appropriations | Give to chairs who appropriate to *their* charity (e.g. Patriot Foundation ↔ NC appropriators) |
| Grants & appropriations dependency | Grant-seekers curry favor with appropriators / authorizers / executive dispensers |
| Patronage / appointment-seeking | UNC trustees, wildlife, highway, ports authority — give to appointment power |
| Military affinity | Veterans → veteran candidates + defense/VA/security lanes |
| Life-stage / local QOL | Suburban soccer moms → schools + neighborhood safety/growth |
| Identity / lifestyle affinities | Hispanic, Black, Jewish, Baptist, Episcopal, government employees, NASCAR, alumni, frat, church small group, neighbors, motorcycle, pickup/outdoors — **on and on** |
| Industry via NAICS/SIC | Employer-coded donors → power centers that regulate/tax/fund/sue that code |

**Microsegments forever:** no fixed closed taxonomy. Keep discovering fusions that predict money; retire ones that don’t. Thousands of affinity dimensions are possible; hundreds of issue/jurisdiction segments are the working map; the gift graph keeps what pays.

---

## 5. Pulse model — news intelligence × microsegments × LTV

### Static layer
Every microsegment contains donors with **LTV** (lifetime value) and pattern membership. Inventory of who *could* give and what they’re worth.

### Pulse layer (E42 News Intelligence + heat)
Monitors the pulse of **every** microsegment. On any given day, for an office/district/jurisdiction, maybe **~3 microsegments light up**. The rest are **dead at 0 donor response** that day — even if LTV is huge.

### Why a segment lights
- Bill sponsored / voted that hits their jurisdiction (including threats to “illegalize” their interest)  
- Drought, plant closing, scandal, school fight  
- Calendar (Christmas, filing deadline, primary week)  
- Disaster (hurricane)  
- National story mapped onto a local microsegment  

### Forecast
A lit microsegment has a **forecasted donation value for that day/time**:

`lit segments × members × LTV/ask propensity × shock intensity`

Dead segments contribute **$0 today**.

### Small high-LTV tribes
Example: fox hunters statewide may number ~20; 3 may be a candidate’s biggest donors. Tiny inventory, enormous tip. Worthless next to Wake school moms — until their chromosome is needed or a shock couples lanes.

### Pyramid / DNA metaphor (Ed)
Microsegments are layers like DNA chromosomes / organs. Most days fox hunters share nothing with Wake County schools. A hurricane (cancer in the system) turns multiple strands on at once — rural recovery, school facilities, builders/permits, disaster appropriators. **One organ affects another.** The forecast is the **lit stack**, not the dormant thousands.

---

## 6. Seamless AI search — why the obsession matters

Seamless search/sort is not “GOD FILE for agents.” It is the **cockpit for microsegments forever**.

Without it, spines, attributes, news, and LTV exist but cannot be operated. With it, a human or agent can:

1. See which microsegments are **on fire** today (news pulse)  
2. **Sort** by forecasted dollars, intensity, district, jurisdiction  
3. Drill **20 fox hunters** as easily as Wake school moms  
4. See which chromosomes stacked under the shock  
5. Pull the ask list **before the pulse dies**  

**Welds and attributes are fuel. Search/sort across microsegments is the weapon sight.**

Commander product shape: omnibox + facets (segment, office lane, jurisdiction, lit/dead, LTV, district) + sort (forecast $ · intensity · recency) → donor/household card. Docs/code search is secondary. Heavy analytics must not share the search workers (statement timeouts / dedicated pool).

---

## 7. Operating rules

1. **Gift graph proves patterns; attributes suggest lookalikes.**  
2. **Ask inside the lane** (office family + jurisdiction + faction). Wrong pole wastes money or blows up.  
3. **Don’t flatten “donor”** into one lifetime total — parallel giving careers by office class.  
4. **Don’t call DataTrust/Acxiom/Personicx/bespoke “donor data.”** They are voter-prediction attributes.  
5. **Act on the lit few; ignore the asleep many** — until news turns their DNA on.  
6. **Microsegments forever** — open map, continuously proven against checks.  
7. **File doctrine under the ecosystems above** — not under dryrun/, not under anonymous branches.

---

## 8. Session provenance

Captured 2026-07-27 from Ed Broyhill’s teaching to Cursor after gold-spine weld work: office lanes, faction poles, evangelical and profession patterns, committee-mask, charity–appropriations, patronage, military/doctors/grants, jurisdiction as master pattern, local trial-bar / school / builder examples, NAICS/SIC, soccer moms and identity affinities, microsegments forever, news pulse + LTV daily forecast, fox-hunters × hurricane coupling, and why seamless AI search/sort is the operational obsession.

---

*End doctrine. Promote copies only by Ed ruling; do not rename/delete this path.*

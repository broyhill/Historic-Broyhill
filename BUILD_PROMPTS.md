# Public website workflow prompts — Historic Broyhill Center

Use these named phases in order; phase names are not GitHub PR numbers. Respect
the approval gates in `CLAUDE.md`: complete the research-only phase and wait for
owner approval, then obtain approval of a design direction before any site
implementation. Do not merge this documentation reconciliation or use it as
authorization to build the website.

If working in GitHub, use one PR per authorized phase and never merge your own
PR. If a capability or tool is unavailable, report that fact and its impact.
The prompts below name capabilities to verify, not tools guaranteed to be
installed.

---

## Readiness check — no file changes

```text
Read CLAUDE.md and inspect the actual checkout. Report the current source,
manifests, and available verification commands; do not infer them from archived
packages or documentation. Check which research, design, motion, accessibility,
and browser-testing capabilities are actually available, including Playwright,
Impeccable, Emil motion review, and break-ui. Clearly list missing capabilities.
Do not install tools, scaffold, edit files, or claim a review/check ran unless
you actually ran it. Summarize the approval gates and wait.
```

---

## Phase 1 — Reference research

```text
This phase is research only. The sole deliverable is docs/design-research.md,
about two pages. Do not create or modify application code, design direction
files, screenshots in the repository, or any other files. Do not proceed to
design or implementation.

Research these references, recording only details you can actually inspect:
- greenbrier.com (meetings pages and room specification sheets)
- omnihotels.com/hotels/homestead-virginia/meetings
- graylyn.com/event-venues-winston-salem
- grandover.com
- omnihotels.com/hotels/asheville-grove-park
- mohonk.com
- broadmoor.com (meetings)
- gccec.com.au/event-planning-tool/virtual-tour

For each reference, make one concise table row covering:
- heritage device (such as room history, archival images, timeline)
- planner tools (such as space filters, capacities, floor plans, tours,
  availability/calendar, or RFP flow)
- hotel / guest-room and room-block handling
- one observed pattern that could inform our site

Record when pages or details cannot be accessed; do not infer what is absent.
Do not assert that all references lack a public availability calendar or make
other unsupported comparisons. Borrow patterns only, never their photos, copy,
logos, or fonts. Keep the findings concise enough for approximately two pages.
Run only checks available in this checkout, report exactly what ran, and then
stop for the owner's explicit research approval.
```

---

## Phase 2 — Design direction

```text
Proceed only after the owner explicitly approves docs/design-research.md. Do not
write application code in this phase.

Use the design-taste-frontend capability if it is available; first verify that
it is. If missing, say so and present the requested direction work without
claiming tool-generated results. Offer three distinct directions for the
Historic Broyhill Center. For each, give a name, one-sentence mood, font-pairing
proposal, palette with hex codes, layout approach, motion level, and Taste dials
(variance 6, motion 3, density 4). Make recommendations without copying
reference assets or text. Identify venue details and brand choices needing
owner confirmation; do not invent venue facts.

Recommend one direction and explain why. Present the options for owner review;
do not create site files or proceed to implementation. After the owner selects
and explicitly approves a direction, record the approved direction in
docs/site-direction.md and stop. Implementation requires separate authorization.
```

---

## Phase 3 — Approved implementation

```text
Do not start unless the owner has explicitly approved the research, approved
docs/site-direction.md, and authorized implementation as a separate task. First
inspect the actual checkout and manifests. The intended stack is Next.js +
Tailwind, with an isolated project at /site and editable source JSON under
/site/data. This is a proposed layout, not existing runnable code. Do not
modify, move, or unpack protected archives. Do not add dependencies, CI,
deployments, production integrations, or backends unless the implementation
authorization explicitly includes them.

Use this proposed layout consistently:
- /site: isolated Next.js application
- /site/app: routes and page layouts
- /site/components: shared interface components
- /site/data/spaces.json, /site/data/availability.json, and
  /site/data/partner-hotels.json: editable sample source data
- /site/lib: application utilities and the data access path, once selected and
  verified for the approved Next.js rendering/deployment model
- /site/public/photos: approved supplied images; until then show TODO-PHOTO
  placeholders

Treat JSON as in-project application source data. Select and verify a suitable
Next.js server/build data-loading approach against the actual framework version
and deployment requirements. Do not assume static browser fetches, root /data,
or a working integration. Explain the chosen path and its constraints before
relying on it.

Build these eight pages, mobile-first:
1. Home — heritage-led introduction, approved story, featured spaces, and a
   clear availability action.
2. Heritage — timeline and archival-photo placeholders; unknown dates are
   [CONFIRM].
3. Event Spaces — filter by guest count, setup, and square footage; include
   capacity by setup, a room-specific history note, photo/floor-plan placeholders,
   and selection for an event request.
4. Availability — visual month calendar driven by editable SAMPLE availability
   JSON; distinguish open, held, and booked; show spaces available on a selected
   date. Do not present sample dates as real availability.
5. Plan Your Event — RFP form prefilled with the visitor's selected spaces and
   dates. Select and verify any persistence approach during implementation.
6. Stay — partner-hotel information from editable SAMPLE JSON and a group-block
   inquiry path, subject to the separate form approval below.
7. Office Suites — approved suite information and a tour-request path.
8. Contact / Directions — use only owner-confirmed contact and location details
   (www.broyhill.net counts; see "Owner sources" in CLAUDE.md).

Provide editable sample records for spaces/rooms, availability, and partner
hotels. Mark every sample clearly as SAMPLE; use [CONFIRM: ...] for unknown
facts. Do not invent capacities, dates, prices, hotels, testimonials, history,
or suite details. Use TODO-PHOTO placeholders until real images are supplied.
Do not replace or connect to the current booking system without explicit
approval and compatibility verification.

Before implementing a form or deployment, obtain owner approval for the hosting
platform, form transport, credentials, paid services, deployment, and any
outbound email. HTML data-netlify attributes alone do not establish processing
for a Next.js application. Do not assume Netlify Drop, add a form backend, send
messages, or deploy. If these decisions are not approved, leave the form and
deployment architecture as documented decisions/blockers rather than making a
working backend.

Follow the approved design direction and accessible, reduced-motion, reference-
pattern-only, and factual-integrity rules in CLAUDE.md. Check the actual
manifests before choosing setup or verification commands. Report missing
capabilities and checks honestly.
```

---

## Phase 4 — Owner feedback

```text
After an authorized local preview is available, collect the owner's feedback.
Change only the explicitly identified items. Do not start a preview if required
setup, hosting, credentials, or services have not been approved. Use browser
screenshots only if a browser tool is actually available; otherwise report that
limitation. Verify focused changes using existing, applicable project checks.
Report what changed and what could not be checked.
```

---

## Phase 5 — Design and motion review

```text
Run the approved design-review pipeline against the actual site and direction:
Impeccable critique, audit, layout, and typeset; then Emil motion review. Verify
each capability before use. If any is unavailable, report it and do not claim
its review occurred. Apply only relevant, approved fixes. Motion should use
ease-out on entry/exit, remain under 300ms, avoid bounce/elastic easing, and
respect prefers-reduced-motion. Report each review actually completed and
remaining blockers.
```

---

## Phase 6 — Responsive and interaction checks

```text
Verify the pages at 1440px and 375px using Playwright if available, and use
break-ui if that capability is available. Report missing tools; do not fabricate
screenshots or successful checks. Check keyboard/focus use, touch target sizing,
horizontal overflow, reduced motion, links, filtering, calendar selection, and
that selected spaces/dates prefill the RFP. Exercise forms only with an
approved local/test transport and test data; do not send real messages.

Include edge cases where the implementation supports them: long space names,
no open dates, missing photos, and a guest-count filter beyond all sample
capacities. Fix approved defects, repeat applicable checks, and report exact
results and limitations. Zero problems may be claimed only if the corresponding
full checks actually ran.
```

---

## Phase 7 — SEO and final polish

```text
Add page-specific titles and descriptions, sitemap and robots files, and
structured data only from owner-confirmed facts. Details published on
www.broyhill.net (see "Owner sources" in CLAUDE.md) count as owner-confirmed.
Do not copy other unconfirmed addresses, phone numbers, hours, social links,
or venue details into metadata. Add descriptive alt text based on supplied images; keep placeholder
alt text honest. Run final Impeccable polish only if available, then report
which SEO and review actions actually completed and which remain blocked.
```

---

## Phase 8 — Supplied photography

```text
Use only photographs supplied and approved by the owner. Replace matching
TODO-PHOTO placeholders, preserve the owner's intended archival context, and
write accurate alt text. Do not source or reuse reference-site images. Report
unmatched placeholders rather than inventing assets.
```

---

## Launch decision — approval required

```text
Do not deploy or submit live forms from this prompt alone. First obtain explicit
owner approval for the hosting provider, form transport, credentials, any paid
services, deployment, and outbound email. Verify that the selected services are
compatible with the actual Next.js app and its data-loading approach. If any
decision or approval is missing, do not deploy; report the open decisions.
```

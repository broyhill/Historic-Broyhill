# Historic-Broyhill — repository instructions

Read this file before making changes. This repository contains project
blueprints and packaged archives; it is not currently an unpacked application.

## Current contents and proposed public app

The checked-out root contains numbered Markdown batches,
`Complete Code-historic-broyhill.md`, `enterprise_nexus_platform.zip`,
`inspinia-template-main.zip`, and `KILLED Guide.pdf`. These are reference and
archive material, not runnable source. Preserve them: do not edit, move, rename,
delete, or unpack them into the checkout unless the owner explicitly approves
that exact work.

The owner has selected **Next.js + Tailwind** as the canonical stack for a
future public website. It is a decision about future implementation, not a
claim that a site or its tooling exists here. No root or `/site` app manifest,
lockfile, dependencies, or application checks are present in this checkout.
Do not scaffold the app, install dependencies, add CI, or begin implementation
as part of documentation or research work.

The proposed isolated public-app layout is:

```text
/site/
  app/                 Next.js routes and page layouts
  components/          shared UI
  data/                editable SAMPLE JSON source files
  lib/                 data access and other app utilities
  public/photos/       supplied images; retain TODO-PHOTO placeholders until then
```

Keep public-site source and its editable `spaces.json`, `availability.json`,
and `partner-hotels.json` data under `/site`; do not create a competing root
`/data` tree. The future Next.js application should consume these in-project
files through an implementation-selected Next.js server/build data-loading
path. Decide and verify the loading behavior against the chosen rendering and
deployment model during approved implementation; this policy does not prescribe
or claim a working loader, browser fetch, or data integration.

## Approval gates and scope

- **Research:** the first deliverable is only `docs/design-research.md`, about
  two pages. Record what was actually observed at the reference sites and stop
  for owner approval. If browsing or a page is unavailable, report that
  limitation instead of guessing.
- **Design direction:** after research approval, present distinct directions
  and stop for explicit approval of one direction before any website code.
- **Implementation:** begin only in a separately approved implementation task
  after both gates. Keep changes scoped, follow actual manifests and code style
  if they exist then, and add focused tests when an applicable test setup exists.
- Preserve the existing booking workflow; do not replace or integrate with it
  without owner approval and compatibility verification.
- Hosting, form transport, credentials, paid services, deployments, and
  outbound email require explicit owner approval and compatibility checks.
  Proposed host, pending Ed's decision: Vercel (made by the Next.js team;
  supports server-side form handling). Not approved; do not deploy.
  HTML form attributes alone do not establish form processing for a Next.js
  application. Do not add a working form backend or production integration
  without approval.
- Require explicit approval for migrations, tenant/authentication changes,
  infrastructure, production data access, and external messaging. Never run
  verification against production data.

## Owner sources

- www.broyhill.net is the owner's own current site. Ed's instruction on issue #2
  (2026-10-14): "use www.broyhill.net reference copy content and logos". Its copy,
  logos and published details are owner-supplied, not reference-site material.
- Published there (read 2026-10-13): event rooms Magnolia Room, The Boardrooms,
  The Dock, The Loft; executive office suites; Virtual Office Program ($150/mo,
  12-month term); The HB Podcast Studio; 1920s school building converted to
  offices and events around 2006; Info@Broyhill.net, Kristin@Broyhill.net
  (suite inquiries), 336-793-1191, 3540 Clemmons Road, Suite 111, Clemmons, NC
  27012; Instagram https://www.instagram.com/historicbroyhill/; bookings run
  through Skedda (broyhill.skedda.com).
- Not published there, so still `[CONFIRM: ...]`: room capacities and sizes,
  build year and school name, hours, Facebook URL, suite availability.
- Fix rather than copy: the placeholder hero image, typos, and the suites copy
  duplicated in the event-space section.

## Public-site content, design, and accessibility

- Do not invent venue facts, dates, capacities, amenities, pricing, testimonials,
  or partner details. Mark unverified copy and values `[CONFIRM: ...]`; label all
  example records `SAMPLE`. Do not treat claims in earlier draft instructions
  as independently verified facts.
- Use `TODO-PHOTO` placeholders until approved real images are supplied. Borrow
  reference-site patterns only—not their photos, copy, logos, or fonts.
- Preserve accessible semantics, visible focus, keyboard operation, useful
  contrast, and reduced-motion support. Design mobile-first and check at 375px;
  avoid horizontal overflow and provide touch targets of at least 44px.
- For motion, use ease-out on entry/exit, keep transitions under 300ms, avoid
  bounce/elastic easing, and respect `prefers-reduced-motion`.
- Use the design workflow in `BUILD_PROMPTS.md`: Taste direction (variance 6,
  motion 3, density 4), implementation after approvals, Impeccable critique /
  audit / layout / typeset, Emil motion review, Playwright at 1440px and 375px
  plus break-ui, SEO, then final polish. A tool named in the workflow is a
  capability to check, not evidence it is installed or available. Report missing
  tools and blocked reviews explicitly; never claim a review or check succeeded
  unless it actually ran.

## Safe editing and verification

- Inspect relevant documents or archive members before proposing edits. When
  sources disagree, identify the discrepancy and ask which source is
  authoritative.
- Keep changes narrow. Do not copy example credentials or private tenant data
  into prompts, logs, fixtures, or commits. Keep authentication and environment
  values local; do not disable permission checks or commit personal settings.
- Use actual manifests when present. In this checkout there are no runnable
  application manifests or application commands to verify. Any future setup,
  build, lint, or test commands must be labeled proposed until verified against
  the actual approved source and its manifests.
- For documentation-only changes, check relative links, inspect the diff, and
  run `git diff --check`. Do not claim application tests passed.
- Before preparing a change, review changed files for secrets, unintended
  binary/archive changes, extracted sources, dependencies, and generated output.
  Report exactly which checks ran and any limitations.

See [Claude Code workflows](docs/claude-code.md) for local guidance.

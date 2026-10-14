# Historic-Broyhill: Claude Code instructions

## Repository context

This checkout is a collection of project blueprints and packaged source, not an
unpacked application. Do not assume the directories described in the Markdown
exist on disk.

- `Complete Code-historic-broyhill.md`: collected architecture and code examples.
- Numbered batch Markdown files: supplemental proposals and code examples; they
  may differ from the complete package.
- `enterprise_nexus_platform.zip`: packaged pnpm workspace, including
  `apps/web-portal`, `apps/admin-dashboard`, `apps/ai-workers`, and
  `packages/database`.
- `inspinia-template-main.zip`: separate static HTML/CSS/JavaScript UI template.
- `KILLED Guide.pdf`: reference material; preserve the original.

The proposed application uses TypeScript, Next.js, NestJS, PostgreSQL/Prisma,
Redis/BullMQ, and Playwright. These are blueprint/archive contents, not verified
working services in this checkout.

## Working conventions and boundaries

- Inspect the relevant document or archive member before proposing a change.
  When sources disagree, identify the discrepancy and ask which is authoritative.
- Keep edits scoped to the request and match the surrounding style. Preserve
  historical code packages rather than reformatting or rewriting them wholesale.
- Do not unpack archives into the repository, replace binary assets, scaffold an
  application, install dependencies, or add CI/deployment configuration unless
  explicitly requested. Inspect archives read-only; use a temporary directory
  outside the repository for approved experiments.
- For approved application work, follow the actual manifest and local code style.
  Preserve TypeScript typing and app/shared-package separation; do not infer
  executable configuration from Markdown examples alone.
- Require explicit approval for schema/data migrations, tenant/authentication
  changes, infrastructure, deployments, paid API calls, or outbound email/SMS.
  Never run these against production data as part of verification.
- Never read or copy local credentials or private tenant data into prompts,
  logs, fixtures, or commits. Example credentials in source documents are not
  approved secrets. Keep authentication and environment values local.
- Review shell commands and file edits before granting permission. Do not
  disable Claude Code permission checks or commit personal Claude settings.

## Verification

There is no root `package.json`, lockfile, installed application, or runnable
test/lint/build setup. For documentation-only changes, check links and commands,
run `git diff --check`, and review `git diff` and `git status --short`.
Do not claim application tests passed.

The application archive declares pnpm scripts, but they are conditional guidance
only. Before any approved code work, inspect the extracted manifests, workspace
packages, lockfile, environment requirements, and tests. Run only applicable
existing checks and report missing prerequisites rather than inventing scripts.
See [the workflow guide](docs/claude-code.md) for the command inventory.

Before preparing a PR, inspect every changed file for secrets, unintended binary
changes, extracted sources, dependencies, and generated output. Summarize the
scope, verification performed, and anything that could not be verified.
# Historic Broyhill Center — Website Repo

Read this file in full before any work. Then read PRODUCT.md and DIRECTION.md if they exist.

## What this site is
Office complex + conference/event center.
Historic Broyhill Center, 3540 Clemmons Road, Clemmons, NC 27012. 62,500 SF.
Goal: a site that feels like heritage (Greenbrier, Homestead, Graylyn) and works like a modern planner tool.
No on-site hotel. Guest rooms come from partner hotels via group-block requests.

## Known facts (from the current site, www.broyhill.net, read 2026-10-13)
- 1920s school building, converted to an office complex and event center around 2006. "Nearly 100 years" serving the community.
- Event rooms: Magnolia Room, The Boardrooms, The Dock, The Loft. Capacities and sizes: [CONFIRM].
- Also: executive office suites, Virtual Office Program ($150/mo, 12-month term), The HB Podcast Studio.
- Bookings currently run through Skedda (broyhill.skedda.com). The new calendar should link to it or read from it, not replace it, until Ed decides.
- Instagram: https://www.instagram.com/historicbroyhill/ (link in header/footer and in schema sameAs). Facebook page exists: URL [CONFIRM].
- Contact: Info@Broyhill.net, 336-793-1191, 3540 Clemmons Road, Suite 111, Clemmons, NC 27012. Suite inquiries: Kristin@Broyhill.net.
- Keep from the current site: tenant testimonials (real, reuse with permission), staff bios, Work Order Request Form, Request a Tour.
- Fix from the current site: placeholder hero image, empty "Available Suites" list, duplicated Suites/Event copy, typos, no room capacities, page title is just "Broyhill".

## Design pipeline — use in this order (from the $10K Website Kit guide)
The stages run across BUILD_PROMPTS.md, one stage per prompt and one PR per stage:
stage 1 = Prompt 2, stage 2 = Prompt 3, stages 3-4 = Prompt 5, stage 5 = Prompt 6, stage 6 = Prompt 7.
A prompt's PR only needs its own stage done.
1. design-taste-frontend (Taste Skill): set direction before code. Dials: variance 6, motion 3, density 4.
2. Build: plain HTML/CSS/JS in /site, no build step.
3. impeccable: critique -> audit -> layout -> typeset. Run critique before polish.
4. emil-design-eng + improve-animations + review-animations: all motion.
5. Playwright MCP: test at 1440px and 375px until a full pass finds zero problems. Include break-ui.
6. SEO basics, then /impeccable polish last.

## Motion rules (Emil)
Ease-out on enter/exit. Nothing over 300ms. Buttons scale 0.97 on press.
Pop-ups start at 0.95, never 0. Respect prefers-reduced-motion. No bounce or elastic easing.

## Reference sites — borrow PATTERNS only
- greenbrier.com: per-room spec sheet with that room's history and an archival photo
- omnihotels.com/hotels/homestead-virginia/meetings: filter spaces by sq ft / capacity / setup, "Add to RFP"
- graylyn.com: estate storytelling, butler-level service copy
- omnihotels.com/history: heritage timeline hub
- broadmoor.com: interactive meeting-facilities map
- gccec.com.au/event-planning-tool/virtual-tour: 3D / 360 / interactive floor plan benchmark
Never copy their photos, copy text, logos or fonts.

## Existing files in this repo — leave them alone
The root already holds the "enterprise-nexus" admin-platform notes (numbered batch .md files,
Complete Code-historic-broyhill.md, enterprise_nexus_platform.zip, inspinia-template-main.zip)
and KILLED Guide.pdf (the design-pipeline guide this file follows).
The admin platform is a separate internal tool for the event and office managers.
The public website lives only in /site (data in /site/data) and /docs. Do not edit, move, rename or delete
the existing files unless Ed asks.

## Hard rules
- Images: labeled placeholder boxes with the exact size needed (TODO-PHOTO). Real photos go in /photos later.
- No invented facts. Building history, dates, room names and capacities come from /site/data or from Ed. Missing -> write [CONFIRM: ...] in the copy, never guess.
- Room and availability data live in /site/data/*.json so Ed can edit without touching code.
  They sit inside /site because Netlify Drop publishes only the /site folder. Fetch them with relative paths (data/spaces.json).
- Forms: Netlify Forms (data-netlify="true" + hidden form-name) with a thank-you page.
- Mobile-first. No horizontal scroll at 375px. Tap targets >= 44px.
- Git: commit after every pipeline stage with a clear message. One PR per phase. Never merge your own PR.
- If a reference site blocks fetching or screenshots, say so in the PR. Do not describe a site you did not see.

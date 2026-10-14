# Historic Broyhill Center — Website Repo

Read this file in full before any work. Then read PRODUCT.md and DIRECTION.md if they exist.

## What this site is
Office complex + conference/event center.
Historic Broyhill Center, 3540 Clemmons Road, Clemmons, NC 27012. 62,500 SF.
Goal: a site that feels like heritage (Greenbrier, Homestead, Graylyn) and works like a modern planner tool.
No on-site hotel. Guest rooms come from partner hotels via group-block requests.

## Design pipeline — use in this order, every build (from the $10K Website Kit guide)
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
The public website lives only in /site, /data and /docs. Do not edit, move, rename or delete
the existing files unless Ed asks.

## Hard rules
- Images: labeled placeholder boxes with the exact size needed (TODO-PHOTO). Real photos go in /photos later.
- No invented facts. Building history, dates, room names and capacities come from /data or from Ed. Missing -> write [CONFIRM: ...] in the copy, never guess.
- Room and availability data live in /data/*.json so Ed can edit without touching code.
- Forms: Netlify Forms (data-netlify="true" + hidden form-name) with a thank-you page.
- Mobile-first. No horizontal scroll at 375px. Tap targets >= 44px.
- Git: commit after every pipeline stage with a clear message. One PR per phase. Never merge your own PR.
- If a reference site blocks fetching or screenshots, say so in the PR. Do not describe a site you did not see.

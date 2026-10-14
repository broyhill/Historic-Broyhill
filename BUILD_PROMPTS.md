# Build Prompts — Historic Broyhill Center

Paste these into Claude Code one at a time, in order. Each one ends with a PR, or with a stop for your review.
On GitHub: open one issue per prompt and start the body with @claude.

---

## Prompt 0 — Setup check
```
Read CLAUDE.md. List every skill and MCP server you have, one line each.
Confirm you have: design-taste-frontend, impeccable, emil-design-eng, animate,
review-animations, improve-animations, break-ui, playwright.
If any is missing, stop and tell me which. Do not build anything.
Then run /impeccable init. It creates PRODUCT.md. The answers are in the Brief section of Prompt 2 below.
Commit PRODUCT.md on a branch and open a PR.
```

---

## Prompt 1 — Research the reference sites (PR #1: docs/design-research.md)
```
Use Playwright to open each reference site in CLAUDE.md at 1440px and 375px.
Screenshot the home page, the meetings/events page, and one room/space detail page.
Save the screenshots to docs/research/.
If a site has no page of a given type (for example, the history page has no room detail),
write "none" for it. Never fill a gap with guesses.

Write docs/design-research.md with one table row per site:
- heritage device (history per room, archival photos, timeline, storytelling copy)
- planner tools (space filter, capacity chart, floor plan, 3D/360 tour, calendar, RFP flow)
- guest rooms / room-block handling
- the ONE pattern we should take, and how we would do it better

Then add a section titled "What they all do the same" and a section titled
"Our edge". None of them has a public availability calendar. We will have one.
Keep it to about 2 pages. Open the PR and stop.
```

---

## Prompt 2 — Direction (PR #2: DIRECTION.md)
```
Use the design-taste-frontend skill and docs/design-research.md.
Before writing any code, give me 3 distinct design directions. For each one:
a name, the mood in one sentence, the font pairing, the palette with hex codes,
the layout style, the motion level, and the Taste dials. Recommend one and say why.

Brief:
Business: Historic Broyhill Center, a historic office complex and conference/event
center in Clemmons, NC (Winston-Salem area). [CONFIRM: building history and year built]
Who it is for: corporate meeting planners, associations, nonprofits, civic and
political groups, wedding/social planners, and office tenants.
What they should do on the site: check availability, pick spaces, send an RFP;
tenants request an office tour.
Brands whose look I like: greenbrier.com, graylyn.com, omnihotels.com/history
Vibe I want to avoid: generic hotel-chain template, stock-photo boardrooms,
purple gradients, cold corporate.

When I pick a direction, save it to DIRECTION.md. Open the PR and stop.
```

---

## Prompt 3 — Build (PR #3: /site)
```
Read CLAUDE.md, DIRECTION.md and PRODUCT.md (made in Prompt 0; if it is missing, stop and say so).
Build the full site in /site. Reviews, motion, testing and SEO come in later prompts.
Use design-taste-frontend and impeccable for every decision and emil-design-eng for all motion.

Data first. Create these with sample data marked SAMPLE:
- /site/data/spaces.json: name, sq ft, dimensions, ceiling height, windows,
  capacity by setup (theater, classroom, banquet, reception, U-shape, boardroom),
  a history note, photo placeholder
- /site/data/availability.json: date, space, status (open | held | booked)
- /site/data/partner-hotels.json: name, distance, group-rate link, notes

Pages:
1. Home: heritage hero with one promise and one button ("Check Availability"),
   the Broyhill story teaser, featured spaces, how booking works in 3 steps,
   testimonials as placeholders only (no invented quotes), final CTA.
2. Heritage: a timeline with archival-photo slots. All dates [CONFIRM].
3. Event Spaces: filter by guest count, setup and sq ft (Omni pattern).
   Each space card shows its own history note (Greenbrier pattern),
   a capacity table, a floor-plan slot and an "Add to my event" button.
4. Availability: a month calendar, color-coded open / held / booked, read from
   availability.json. Clicking a date shows which spaces are open.
   Selecting a date + space adds it to "my event".
5. Plan Your Event: an RFP form pre-filled with the spaces and dates in "my event"
   (keep it in localStorage, wrapped in try/catch). Netlify Forms + thank-you page.
6. Stay: partner hotels, with a group-block request form.
7. Office Suites: available suites, amenities, request-a-tour form.
8. Contact & Directions.
Every page: an Instagram link (https://www.instagram.com/historicbroyhill/) in the footer.

Copy: real and specific, no lorem ipsum, no buzzwords. Any fact you do not have
-> [CONFIRM: ...].
When done, start a local preview, give me the link, open the PR and stop.
```

---

## Prompt 4 — My notes (run after you click through the preview)
```
Here is what I don't like, in plain words:
1. [ ]
2. [ ]
3. [ ]
Fix each one. Use Playwright to show a before and after screenshot of each fix.
Don't change anything I didn't mention.
Commit on a new branch and open a PR.
```

---

## Prompt 5 — Designer review + motion (PR #4)
```
Run in order and fix what each finds:
/impeccable critique home
/impeccable critique event-spaces
/impeccable audit
/impeccable layout
/impeccable typeset
Then use improve-animations to audit every animation and apply the fixes.
Then use review-animations to check strictly against Emil's rules, and fix any failures.
Commit after each step. Open the PR and stop.
```

---

## Prompt 6 — Playwright test loop (PR #5)
```
Start the preview. Use Playwright to test the whole site like a picky first-time
meeting planner. Repeat until a full pass finds zero problems:
1. Open every page at 1440px and 375px. Screenshot each and look at it carefully.
2. Click every link and button. Filter spaces. Pick a date on the calendar, add
   two spaces, and confirm the RFP form pre-fills them. Submit every form with
   test data and confirm it reaches the thank-you page.
3. Check the console for errors.
4. List every problem: broken links, cut-off text, sideways scroll on phone,
   small tap targets, missing hover/focus states, janky motion.
5. Fix all of them and run the full check again.
Also use break-ui: a 60-character space name, a month with zero open dates,
a space with no photo, and a 1,000-guest filter. Fix anything that breaks.
Stop only at zero problems. Report what you found and fixed. Open the PR.
```

---

## Prompt 7 — SEO + polish (PR #6)
```
Add a unique title and meta description per page, a social share image,
sitemap.xml, robots.txt, and LocalBusiness + EventVenue schema:
Historic Broyhill Center, 3540 Clemmons Road, Clemmons, NC 27012,
phone 336-793-1191, hours [CONFIRM],
sameAs: https://www.instagram.com/historicbroyhill/ (add the Facebook URL once confirmed). Add descriptive alt text on every image.
Then run /impeccable polish. Open the PR.
```

---

## Prompt 8 — Real photos (after you drop them in /photos)
```
My photos are in /photos. Replace each placeholder with the best match, crop it
to the labeled size, convert it to WebP under 200KB, and write alt text for each one.
Archival photos go on the Heritage page and in the space history notes.
```

---

## Launch
Drag /site onto app.netlify.com/drop. Then go to Forms -> Enable form detection,
and drag /site in again. Send yourself a test RFP.
Before launch, open the live link and check the calendar, the space filter and the hotel list load their data.

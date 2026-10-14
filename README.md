# ai-generated-project
AI-generated project created by Claude development coordinator

## Claude Code

Use Claude Code to review the project blueprints, plan scoped features, debug
unpacked code, and prepare reviewable changes. This checkout currently contains
Markdown code packages, ZIP archives, and a PDF—not a runnable application.

- [Local setup, workflows, and verification](docs/claude-code.md)
- [Repository instructions loaded by Claude Code](CLAUDE.md)

No Claude API integration, credentials, or application dependencies are required
by these documentation changes.

## Public site preview (draft, on hold pending approvals)

A mobile-first venue, heritage, and office-leasing site built with Next.js and Tailwind CSS.

### Run locally

```sh
npm install
npm run dev
```

Run `npm run build` to create a production build and `npm run start` to serve it.
`npm run typecheck` checks the TypeScript source.

### Sample content

- Edit `data/rooms.json` to change the event-space listings, capacities, setups, and room notes.
- Edit `data/availability.json` to change the default calendar status, the first month shown (`initialMonth`, as `YYYY-MM`), or set individual dates to `open`, `held`, or `booked`.
- Edit `data/suites.json` to change the sample office-suite listings.

Sample room and suite details, lodging categories, timeline copy, and availability
must be confirmed before launch. Photo slots are marked `TODO-PHOTO`. Inquiry
forms are front-end previews and do not transmit or store submissions.

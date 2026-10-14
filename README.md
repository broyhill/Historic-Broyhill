# Historic Broyhill

A mobile-first venue, heritage, and Class A office-leasing site built with Next.js and Tailwind CSS.

## Claude Code

Use Claude Code to review the project blueprints, plan scoped features, debug
unpacked code, and prepare reviewable changes. This checkout contains the public
website alongside historical Markdown code packages, ZIP archives, and a PDF.

- [Local setup, workflows, and verification](docs/claude-code.md)
- [Repository instructions loaded by Claude Code](CLAUDE.md)

No Claude API integration, credentials, or application dependencies are required
by the Claude Code documentation.

## Run locally

```sh
npm install
npm run dev
```

Run `npm run build` to create a production build and `npm run start` to serve it.
`npm run typecheck` checks the TypeScript source.

## Sample content

- Edit `data/rooms.json` to change the event-space listings, capacities, setups, and room notes.
- Edit `data/availability.json` to change the default calendar status or set individual dates to `open`, `held`, or `booked`.
- Edit `data/suites.json` to change the sample office-suite listings.

Office suites are Class A offices for lease. Event spaces and event planning
remain separate from office leasing.

Sample event-room and office-suite details, timeline copy, and availability
must be confirmed before launch. Photo slots are marked `TODO-PHOTO`. Inquiry
forms are front-end previews and do not transmit or store submissions.

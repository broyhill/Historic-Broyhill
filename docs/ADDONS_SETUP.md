# Add-ons setup — "The $10K Website Kit"

Maps the five pieces from the kit guide to what's actually wired into this
Claude Code **cloud** session (claude.ai/code). Note: the guide is written for a
**local** terminal install; in a cloud session, skills and connectors come from
your **account**, not from `npx … -g` commands — so most of the kit is already
on without re-installing.

## Status

| Kit piece | Guide source | This session | How to use |
|---|---|---|---|
| **Taste Skill** (art director) | `Leonxlnx/taste-skill` → `design-taste-frontend` | ✅ **Live** as `anthropic-skills:design-taste-frontend` | Invoke the skill before building; it sets design direction and bans generic AI looks |
| **Impeccable** (senior designer, 24 cmds) | `pbakaus/impeccable` | ✅ **Live** as `anthropic-skills:impeccable` | Critique / audit / layout / typeset / polish passes on any UI |
| **Emil's motion skills** | `emilkowalski/skills` (emil-design-eng, animate, review-animations, improve-animations, break-ui) | ⚠️ **Partial** — core `anthropic-skills:emil-design-eng` is live (covers animation decisions + polish); the 4 motion-specific sub-skills are not separately enabled | Use `emil-design-eng` for motion/easing guidance |
| **Figma MCP** | `figma@claude-plugins-official` / `mcp.figma.com/mcp` | ✅ **Connected**, authed as `ed@broyhill.net` — but **Starter plan / "View" seat = ~6 tool-calls/month**, limited write | Paste a Figma frame URL → code; capture site → Figma (sparingly, within the 6-call cap) |
| **Playwright** (the eyes) | `@playwright/mcp@latest` | ✅ **Working now** via the pre-installed Playwright 1.56 + Chromium library; **MCP added to `.mcp.json`** (activates next session) | Drive the site in a real browser, click, resize to phone, screenshot |

## Not part of this kit (optional, currently down)
- **Magic MCP** (`@21st-dev/magic`) — needs a fresh API key from **https://21st.dev/mcp**, then set it in `.mcp.json`. Used for generating UI components; not required by the kit.
- **Higgsfield MCP** — proxy blocked (`403`); AI video/image, not required by the kit.

## The kit's workflow (prompts), adapted to this session
1. **Brief / direction** — use `design-taste-frontend`; produce 3 directions, pick one → save to `DIRECTION.md`.
2. **Build** — build with `design-taste-frontend` + `impeccable` + `emil-design-eng`; real copy, no lorem; responsive 375→1440.
3. **Say what you don't like** — plain-language fixes; before/after screenshots via Playwright.
4. **Designer review** — Impeccable passes: critique → audit → layout → typeset → polish.
5. **Motion pass** — `emil-design-eng`: subtle, fast, ease-out, ≤300ms, respect reduced-motion.
6. **Playwright test loop** — open every page at 1440 + 375, click everything, check console, fix until a full pass finds zero problems.
7. **Launch** — plain build output; host on Hetzner / Vercel / Netlify.

> The E68 Wizard app in `web/` was already built following this loop
> (direction → build → verify with Playwright, zero console errors).

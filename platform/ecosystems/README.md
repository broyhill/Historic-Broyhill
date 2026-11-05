# Historic Broyhill — Ecosystem Shelf

Copied (not moved) from `broyhill/BroyhillGOP/ECO_CANONICAL/` on 2026-10-30,
per Ed's instruction: "copy rvm eco for voice mail, copy print, and copy any of
100 apps there in 100 ecos to complete historic broyhill."

Each `E##/` directory is the canonical BroyhillGOP ecosystem folder verbatim
(code + sql + docs). These are reference/source-of-truth copies for the venue
business; BroyhillGOP remains upstream — do not edit here and push back.

## The 25 ecosystems on this shelf, by job they do for the venue

**Delivery lanes**
- E17 — RVM ringless voicemail (Slybroadcast-style drops, sound engine, gateway)
- E14 — Print production (LettrLabs job log + production)
- E18 — Print advertising
- E33 — Direct mail
- E30 — Email engine (enterprise sender, sequences, deliverability, ML loop)
- E31 — SMS/MMS
- E36 — Messenger integration
- E57 — Messaging center
- E67 — Push gateway (not copied — add if needed)

**Social / ads**
- E19 — Social media (arsenal + personalization)
- E36 — Messenger integration
- E70 — Digital ads gateway
- E23 — Creative asset 3D engine
- E45 — Video studio
- E46 — Broadcast hub

**People & data**
- E01 — Data import engine
- E15 — Contact directory
- E52 — Contact intelligence engine

**Events & scheduling (core venue ops)**
- E34 — Events
- E37 — Event management
- E54 — Calendar scheduling

**Content & brain**
- E08 — Communications library
- E09 — Content creation AI
- E41 — Journey engine
- E27 — Realtime dashboard
- E29 — Analytics dashboard
- E06 — Analytics engine

## Not copied (political-only)

Donor/FEC/compliance/canvassing ecosystems (E02 donations, E03–E05
activist/volunteer, E10 compliance, E11–E13 campaign ops/tattoos, E16 TV/radio,
E20–E22 brain/clustering, E24–E26 onboarding/routing, E28 finance, E32 call
center, E39–E44, E47–E53, E55–E56, E58–E99) are candidate-platform machinery;
say the word and any of them can be added the same way.

## Credentials wiring

The Meta (FB/IG) credentials minted 2026-10-30 feed E19/E36/E57:
- `FB_HISTORIC_BROYHILL_PAGE_TOKEN` — non-expiring page token (page `191945305625`)
- `FB_ED_BROYHILL_USER_TOKEN` — 60-day user token backup
- `FB_HISTORIC_BROYHILL_APP_SECRET` — app `105663368964` secret
- IG Business Account ID: `17841410951261766`

Tokens live in the Devin secret store, not in this repo.

# Claude — BGOP Engage

You are looking at **BGOP Engage**, the native engagement app.

## Hard rules

1. **Clone, do not subscribe.** No Iterable account, no `ITERABLE_API_KEY`, no `api.iterable.com` product wire.  
2. Email delivery goes through **E30** (`ecosystems/e30_email`). Engage does not become a second ESP.  
3. **E60 LP decides** ask/channel/budget/fatigue. Engage feeds coefficients + runs journeys.
   <!-- 2026-10-03: pre-canon 'E19 LP' corrected to E60 per PORT_LIST §2. E19 is Social Media. -->  
4. Ed = EDGAR. Writes need **`I AUTHORIZE THIS ACTION`**.  
5. Canary doctrine: cluster `372171` = 147 / `$332,631.30` (ask Cursor for live check).  
6. **No dryrun burial.** Schema lives at `database/migrations/062_BGOP_ENGAGE.sql`.

## Read order

1. `README.md`  
2. `ARCHITECTURE.md`  
3. `docs/NO_VENDOR_SUBSCRIBE.md`  
4. `docs/ITERABLE_CLONE_MAP.md`  
5. `MANIFEST.json` + `modules/`

## When Ed asks you to extend Engage

- Add native modules under `modules/`  
- Extend `engage.*` via new numbered migrations (not dryrun-only)  
- Keep E30 as the send adapter  
- Ask Ed to authorize any Hetzner apply the same session  

## Reply line after loading this app

`BGOP ENGAGE LOADED — NATIVE CLONE — NO ITERABLE SUBSCRIBE`

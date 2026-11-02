# Vendored Iterable-clone additions (from BroyhillGOP)

Reference copies vendored for the XSELLNET/HB test ground — the Iterable
counterpart to the agency spine already merged in `lib/wizard/`.

- `bgop-engage/` — BGOP Engage: the native engagement engine built as an
  Iterable clone (no Iterable account; email delivery still goes through E30,
  E60 LP decides ask/channel/fatigue).
- `iterable/ITERABLE_CLONE_MAP.md` — the vendor→native clone map.
- `iterable/e30-bridge/` — E30↔Iterable bridge (`iterable_client.py`,
  `iterable_propensity_sync.py`, `api/iterable_bridge.py`, `ITERABLE.md`) —
  dormant until Ed binds a provider.
- `iterable/migrations/` — `061_ITERABLE_COMPLETE_PLATFORM.sql`,
  `062_BGOP_ENGAGE.sql` (reference; not applied).
- `iterable/teardown/` — Nova propensity teardown + full capability inventory;
  the Nova propensity taxonomy already lives in the merged code at
  `lib/wizard/feeder/nova.ts`.

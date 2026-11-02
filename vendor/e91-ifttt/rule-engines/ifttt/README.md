# IFTTT — trigger/rules engine (XSELLNET lane)

**Port note (2026-10-30, devin).** Canonical copies lifted read-only from
`broyhill/BroyhillGOP`. Nothing in BroyhillGOP was moved, renamed, or deleted.
Ed's rule: take only named canonical components — no drifted orphans
("cuddies"). Skipped strays are listed below; no ` 2.html` duplicates, no
NONDEPLOYED_ORPHANS, no duplicate `AS_DEPLOYED` twins beyond the deployed
receipt files themselves.

IFTTT drifted across ~5 ecos in BroyhillGOP; each piece below is the
canonical copy for its lane:

- `e20/brain_worker.py` — rule evaluator/executor (fires `ifttt.rules`;
  AS_DEPLOYED_HETZNER_2026-07-30 receipt copy).
- `e40/ecosystem_40_automation_control_panel_complete.py` — the IFTTT
  console service (AS_DEPLOYED receipt).
- `e40/1766013160623_ecosystem_40_admin_dashboard.html` — control panel UI.
- `e40/2026-06-09_brain_triggers_load_e40_catalog.sql` — loads the
  trigger catalog into `brain.triggers`.
- `e40/ECO_MODEL.md` — E40 lane model.
- `e26/DRYRUN_E26_NURTURE_ROUTING_RULES_2026-06-20.sql` — per-contact
  trigger→journey routing rules.
- `db/DRYRUN_IFTTT_MARKETO_MECHANICS_UPGRADE_2026-07-08.sql` —
  `ifttt.rules` mechanics upgrade (Marketo-style agent proposal surface).
- `docs/E40_INDEX.md` — E40 parts index (canonical/orphan ledger).

Skipped strays (left in BroyhillGOP): ` 2.html` dashboard duplicates,
`ecosystem_40_automation_control_panel.py` (superseded twin), non-deployed
`ecosystem_20_intelligence_brain*.py` variants, NONDEPLOYED_ORPHANS, and
wiring-only mentions in E22/E37/E48/E79.

Live `ifttt.rules` rows are DB truth on Hetzner — not copied here; schema
DDL comes with the engine binding PR. This lane is reference code until it
is bound to the XSELLNET tenant data plane; nothing executes.

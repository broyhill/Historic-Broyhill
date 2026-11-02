# E20 pointer — `007_brain_crm.sql` (founding D365 sync fabric)

**Status:** REFERENCE ONLY — not installed, not deployable, not a dry run
**Lane:** E20 Intelligence Brain (`-- ECOSYSTEMS: E20` is line 1 of the file)
**Date:** 2026-08-31
**Authority:** absorb-not-discard; ECO_CANONICAL E20 entry rule; ACTIVATION_PROTOCOL_2026-08-09
**Not a weapon.** Sync fabric for a Dynamics 365 *mirror*, never system of record.

This file is the sanctioned form. The lane entry rule forbids copying the SQL into
`ECO_CANONICAL/E20/sql/` (or `code/` or `tests/`). Quote:

> Nothing enters `ECO_CANONICAL/E20/code|sql|tests` unless it is transaction-wrapped,
> idempotent, canary-gated, writes `ops.deploy_log` at apply time, schema-qualified,
> and declares its rollback. **Everything else stays where it is and is referenced,
> not installed.**

The SQL fails that gate. It stays where it is. This pointer is the E20-lane form.
SPINE_INDEX registration is already on PR #818 (`b4da362e1`, Claude) — one Tier 3
block, not a second. Nothing was moved, renamed, or deleted.

---

## What it is

Eleven CRM sync tables: `crm_systems`, `crm_entity_types`, `crm_field_mappings`,
`crm_field_mapping_history`, `crm_sync_jobs`, `crm_sync_job_details`, `crm_sync_records`,
`crm_sync_conflicts`, `crm_sync_statistics_daily`, `crm_webhooks`, `crm_webhook_events`.

Doctrine (still CANONICAL, cited by Master Plan v2):
`docs/canonical/DYNAMICS365_CRM_ARCHITECTURE_2026-06-08.md`

That doctrine is filed with the Wizard because it is about **CRM shape** (Dataverse
contact/account, pipeline stages, BPF). The schema artifact is Brain. Both placements
are correct; they are different artifacts. Do not re-file the SQL under E68.

Sync rule (doctrine 2026-06-13): Hetzner holds donor signature, grades, triggers, and
`wizard.*` state. D365 receives contact/stage mirrors — bidirectional for contacts only,
never authoritative for microsegments or gun fire.

---

## Read copy (do not apply)

| Role | Path | sha256 | Lines |
|---|---|---|---:|
| **Read copy** | `database/schemas/007_brain_crm.sql` | `e58e7f413124b10501c220945acc25f6b39ed68e85ab5654230816c35e5e499e` | 413 |
| Same bytes | `archive/recovered/2026-06-27/nexus/BroyhillGOP-CURSOR-codex-stage-a/database/schemas/007_brain_crm.sql` | same | 413 |

This copy already lives on `main` under `database/schemas/`. It is **not** lost-and-found-only.
It has `-- ECOSYSTEMS: E20` and `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`.
That is partial idempotency, not the six-gate standard.

---

## Other copies (provenance; do not prefer)

| Path | sha256 | Diff from read copy |
|---|---|---|
| `archive/lost-and-found/schemas/007_brain_crm.sql` | `b1b345a1e4e6ba8a7e0b4b309652e354ca2189891f710cd73d917fdb961a3740` | E20 tag present; **no** `IF NOT EXISTS` on tables or indexes |
| `DESKTOP_RECOVERY/database/schemas/007_brain_crm.sql` | same as lost-and-found | byte-identical to lost-and-found |
| `AGENT_BOOT/ED_DROP_2026-08-08_ARCHIVE_ZIP/brain_sql_schema/007_brain_crm.sql` | `5b2f32559136075f18f3c1d219afd68f753680bd07604874a991c7c07e51f631` | no E20 tag; no `IF NOT EXISTS` |
| `archive/recovered/2026-06-27/nexus/BROYHILLGOP_SQL_COMPLETE/007_brain_crm.sql` | same as ED_DROP | byte-identical to ED_DROP |

Three hash families, not two. The "one added comment line" story is the ED_DROP → read-copy
delta **plus** the `IF NOT EXISTS` stamp. Lost-and-found is a third family (E20 tag, still
bare `CREATE TABLE`).

---

## Six-gate check (read copy)

| Gate | Result |
|---|---|
| transaction-wrapped (`BEGIN`/`COMMIT`) | NO |
| idempotent | PARTIAL — `IF NOT EXISTS` on the read copy only; lost-and-found/ED_DROP fail this outright |
| canary-gated (cluster 372171) | NO |
| writes `ops.deploy_log` | NO |
| schema-qualified | **NO — defect, see below** |
| declares rollback | NO |

Zero of six on the lost-and-found/ED_DROP copies. One partial of six on the read copy.
The file predates the standard. It cannot enter `sql/`.

Not in `database/migrations/`. Not in `ECO_CANONICAL/E20/sql/`. Correct.

---

## Defect: `search_path` / unqualified names

```
SET search_path TO brain_control, public;
CREATE TABLE IF NOT EXISTS crm_systems ...
```

Bare table names behind a session `search_path`. There is no `CREATE SCHEMA`.
Whether the eleven tables land in `brain_control` depends on session state at apply time.
Run it from a session with a different `search_path` and they materialize somewhere
nobody expects.

`brain_control` itself is **not** a phantom schema. The v3 coupling map already lists
`brain_control.ecosystems`, `brain_control.v_e64_retention_monitor`, and
`brain_control.v_e64_step4_lift`. What the coupling map does **not** list is any
`crm_*` object. Graphify AST communities see the SQL file; live coupling does not.

Likely explanation for "nothing reads these tables": they were never applied, **or** they
were applied into a schema/name nothing else references. Hetzner has been dark since
2026-08-27; this sitting did not re-query `information_schema`. Last honest live claim
is: no `crm_*` object in `docs/graphify/db_coupling_report_v3.md` (built 2026-08-23 from
`sql_schema_read_v3.csv`).

**First wrap-to-standard fix, when a consumer exists:** qualify every object
`brain_control.<table>`, do not rely on `SET search_path`. That is the first fix, not
the last. Then the other five gates.

Do **not** wrap it in this sitting. No consumer. ACTIVATION_PROTOCOL: installing eleven
empty sync tables with nothing that speaks to them is furniture in a house with no
electricity. Dry-run law: a dry run without intent to deploy is wasted work.

---

## What this pointer does not do

- No copy into `ECO_CANONICAL/E20/sql/`
- No copy into `database/migrations/` or `database/migrations/dryrun/`
- No executor row, no worker, no D365 tenant
- No eco reassignment (not E68, not E85, not a new number)

Consumer comes first. Schema follows it. Seed-order spec already exists:
`nexus-claude-cursor/CLAUDE_007_BRAIN_CRM_SEED_ORDER_SPEC_2026-06-13.md`
(systems → entity_types → field_mappings). That spec is also not an apply.

---

## Companion index (do not duplicate)

SPINE_INDEX Tier 3 block lives on **PR #818**, commit `b4da362e1`:
"The D365 CRM fabric — the founding architecture artifact, in lost-and-found."

This PR does not add a second SPINE_INDEX block. If that block is edited, fold in
what this pointer measured: the `database/schemas/` read copy, three hash families
(not one comment-line delta), lane **E20 settled** (doctrine stays E68-filed because
it is shape), and the `search_path` / unqualified-name defect as the first wrap fix.

# Iterable → BGOP Engage clone map

Source teardown (research only):  
`docs/canonical/seamless-research/ITERABLE_NOVA_TEARDOWN_PROPENSITY_REFERENCE_2026-06-13.md`  
`docs/canonical/seamless-research/ITERABLE_FULL_CAPABILITY_INVENTORY_2026-06-13.md`

| Iterable (paid SaaS) | BGOP Engage (native) | Downstream |
|---|---|---|
| Users / dataFields | `engage.profiles` + `modules/profiles.py` | E01 intensity join |
| Brand Affinity / Predictive Goals | `engage.propensities` + `modules/propensities.py` | E60 LP coefficients |
| Channel / STO / Frequency decisioning | propensity fields → LP | E60 |
| Catalog + Collections | `engage.catalog_items` + `modules/catalog.py` | E59 / ask matching |
| Journeys (tiles) | `engage.journeys` + `modules/journeys.py` | E26/E40 patterns |
| Campaigns / email target API | `engage.campaigns` → **E30 send** | E30 |
| Data Feed (LP at send time) | `modules/data_feed.py` → E60 | E55-style gateway |
| System Webhooks | `modules/webhooks.py` → `brain.event_queue` | E20/E57 pattern |
| Nova Decisioning as SoR | **Rejected** | E60 remains SoR |

2026-10-03: pre-canon 'E19 LP' corrected to E60 per PORT_LIST §2. E19 is Social Media.

**There is no Iterable ecosystem and no Iterable subscription in this map.**

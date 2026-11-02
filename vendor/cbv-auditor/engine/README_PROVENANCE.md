# E60 C/B/V package — provenance

These 12 Python files + migration are the C/B/V (Cost/Benefit/Variance) ML control
package, copied verbatim from `ECO_CANONICAL/E72/code/` and `ECO_CANONICAL/E72/sql/`
on 2026-08-11 to execute Ed's ruling that **E60 houses C/B/V**.

Provenance chain: **E61** C/B/V ML Brain Control (original) → **E72** (July 1 2026
split ruling) → **E87** (brief lock 2026-08-10, superseded same day) → **E60**
(Ed ruling 2026-08-10/11: E60 = ML review engine, houses cost/benefit/variance,
A/B hub for every ecosystem). The E72 copies are retained as history — never
delete/move historical artifacts. E87's number stays reserved but inactive.

| File | Role |
|---|---|
| welford.py | Streaming variance (Welford) |
| bayesian.py | Bayesian / Thompson action selection |
| budget_optimizer.py | Budget optimization |
| attribution_resolver.py | Benefit attribution |
| variance_snapshotter.py | Variance emission |
| anomaly_detector.py | Cost/benefit anomaly detection |
| throttle_controller.py / throttle_reader.py | Automation throttling |
| signal_emitter.py / brain_consumer.py | Brain (E20) signaling |
| network_prior_recomputer.py | Prior recomputation |
| orchestrator.py | Package orchestrator |

None of this is deployed. Internal `e61.*` schema references must be renamed to the
E60-owned C/B/V namespace before any live apply, which requires Ed's exact phrase
`I AUTHORIZE THIS ACTION`.

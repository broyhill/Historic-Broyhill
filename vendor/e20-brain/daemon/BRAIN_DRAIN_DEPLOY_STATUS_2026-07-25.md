# Brain drain deploy status — 2026-07-25

**Ed authorization:** `I AUTHORIZE THIS ACTION` (Cursor session 2026-07-25 ~02:42 UTC) — dark drain only (`SENDS_ENABLED=False`). No external sends.

**Canary pre:** 147 / $332,631.30 PASS

## LIVE APPLY: BLOCKED

Cursor cloud SSH to `root@37.27.169.232` → `Permission denied (publickey)`.
Local keys are **not** on Hetzner `authorized_keys`. No file renamed. No live write performed.

## Repo prep (exact names only)

| Path | Role |
|------|------|
| `backend/python/brain/brain_drain_patch.py` | Claude patch source (#1055) |
| `backend/python/brain/brain_worker.py` | Patched from `docs/handoffs/brain_worker.py` + `DRAIN_PATCH_SOURCE` |
| `/opt/bgop/brain/brain_worker.py` | LIVE target — **not touched** |

`backend/python/brain/brain_worker.py` is **not** proven byte-identical to live. When SSH works: SCP live → backup → re-apply → verify `SENDS_ENABLED=False` → SCP back → restart → canary.

## Unblock (one line on Hetzner as root)

```bash
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIA4fi+IoHIKq1g8bmri1nEN65JhTMUzsqsJslMH5Oivy claude-sandbox-hetzner@broyhillgop.local' >> /root/.ssh/authorized_keys
```

Cursor egress IPs seen this session: `3.214.111.192`, `184.72.220.21` (whitelist in UFW if SSH filtered).

Then tell Cursor: continue drain deploy (authorization already on record for dark apply).

## R4 (Claude #1070)

Opponent-donors: **flag for Wizard** (not suppress entirely). Notes only — no schema rename.

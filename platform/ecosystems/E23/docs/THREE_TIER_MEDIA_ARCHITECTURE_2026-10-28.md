# Three-tier candidate media architecture

Date: 2026-10-28
Status: PROPOSED; documentation only. No storage vendor or runtime installed.

## Separation
Vault: private binary object storage. Brain/index: Hetzner metadata, provenance, search and authorization. Studio: temporary human/GPU production workspaces. R2 is a leading candidate, not a ratified canonical winner. Shade is considered as an internal creative desk only; its integration capabilities require verification.

## Security boundaries
Separate private sources/drafts, published derivatives and licensed commons. Tenant prefixes organize objects but do not authorize access. Proposed private key: tenants/{tenant_id}/assets/{asset_id}/versions/{version_id}/source. Tenant identifies the verified committee boundary, not the candidate person. No private media bucket is exposed through a public bucket endpoint/custom domain. No client bucket credentials or listing access.

Lifecycle: upload -> quarantine -> validate -> index -> review -> approve -> publish -> retire/revoke. A finished GPU render or webhook creates a private derivative, not approved publication. Track ownership/license, permitted use, voice/avatar consent, source evidence, parent version, content hash, approval, retention and revocation.

## Transfers and delivery
Direct browser/object-storage and worker/object-storage transfers keep media payloads off Vercel. Standard function bundle size and request payload limits are different constraints; verify the actual deployed plan rather than calling 250 MB a media-library limit.

R2 presigned URLs authorize an exact object/operation and are bearer capabilities until expiry. They cannot be reused directly on custom domains. Authenticated branded delivery requires a separately reviewed mechanism. Published media is intentional public disclosure. Suspension of database metadata does not remove already public/cached bytes. White-label URLs are presentation, not a legal firewall or substitute for required attribution.

## Cost and ownership limits
The original roughly $165/month for 11,000 GB at $0.015/GB-month is storage-only. Budget operations, derivatives, AI/transcription/indexing, workspaces, recovery copies and retention separately. Do not adopt unsupported competitor cost tables or 'pennies' indexing claims.
The inspected roster names E50 Opponent Intelligence and E13 Donor Tattoo/Warehouse, not generic GPU/AI processing services. Do not inherit those ownership assignments from the pasted proposal. Resolve producer/consumer ownership before implementation.

Sources inspected during discussion: https://developers.cloudflare.com/r2/pricing/ ; https://developers.cloudflare.com/r2/api/s3/presigned-urls/ ; https://developers.cloudflare.com/r2/buckets/public-buckets/ . E23 placement is supported by its ECO_MODEL.md creative asset/versioning scope; historical LIVE labels are not fresh operational evidence.

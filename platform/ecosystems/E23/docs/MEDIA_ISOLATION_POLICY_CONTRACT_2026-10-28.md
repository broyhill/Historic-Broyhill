# Media isolation policy contract

Date: 2026-10-28
Status: PROPOSED; no deployed policies. SQL/schema/helper/role names require discovery.

## Actor and record boundaries
Candidate/staff: explicitly granted tenants only. Workers: assigned input versions and output reservations only. Publisher: exact approved version/job/destination. Agency operations has no implicit creative access. Public recipients see only intentionally published derivatives.
Every asset, version, transcript, tag, embedding, approval and publication carries tenant_id. Composite tenant-scoped foreign keys prevent foreign parent links. Finalized versions are immutable; revisions create child versions with lineage.

## RLS and grants
Enable and FORCE RLS on protected media relations. Restrictive FOR ALL policy checks current tenant, active membership and allowed tenant lifecycle in USING and WITH CHECK. Separate permissive SELECT/INSERT/UPDATE policies require media.read/upload/edit; insertion attributes the verified principal. Restrictive policies alone grant nothing. No ordinary DELETE policy/grant.
Normal users may update descriptive columns only. No direct mutation of tenant/asset identity, creator, bucket/key, content hash, approval/publication state or approver. Inspect effective inherited grants. App/workers must not own protected tables or hold superuser/BYPASSRLS. Helper authorization must be nonrecursive and privilege-reviewed. Session variables carry verified backend context, not proof of identity.

## Approval and publication
Controlled transitions bind tenant, finalized version, content hash, expected record version, approver and destination. Revalidate current permissions, tenant-scoped references, rights/consent evidence, freshness and revocation. Editing/uploading does not imply approval/publication. GPU/webhook output remains private until separately approved. Transition functions are requirements, not implementations supplied here.

## Storage authorization
Private buckets have no public endpoint/custom domain, client credentials or client listing. Backend allocates tenant/version keys and authorizes stored pointers, never arbitrary browser bucket/key inputs. Reserve upload, issue object/operation-specific short-lived capability, verify object size/type/hash at finalization. Do not log signed URLs. Anyone possessing a valid presigned URL can use it until expiry. R2 S3 signatures do not directly authenticate custom-domain delivery.
Published derivatives use a separate delivery boundary. Public copies are not tenant-confidential. Define expiry, cache removal and in-flight limitations rather than claim database suspension retracts all copies.

## Jobs/search/commons
Worker grants bind job, principal, tenant, input versions, permitted output IDs/operations, expiry and revocation. A broad permissive policy must not defeat the job boundary. No worker approval/publication/membership authority.
Search enforces tenant scope on transcripts/tags/embeddings before snippets/results/counts; privileged functions and caches cannot bypass it. Cache keys include access scope. Licensed commons uses explicit tenant-use grants; derivatives become tenant-owned. No tenant_id NULL universal exception.

## Release tests
Foreign-tenant metadata/transcript/version inaccessible; foreign FK rejected; immutable columns protected; uploader/editor cannot publish; worker cannot read unrelated input; revoked user cannot obtain fresh URL; missing context denied; pooled context and search cache do not leak; private object unavailable through public delivery; hash mismatch blocks publication; suspended queued jobs held. Normalize constraint errors to avoid identity disclosure.

References: https://www.postgresql.org/docs/16/ddl-rowsecurity.html ; https://www.postgresql.org/docs/current/sql-createpolicy.html ; https://developers.cloudflare.com/r2/api/s3/presigned-urls/ . Database RLS does not itself protect publicly accessible objects or certify a legal common-vendor firewall.

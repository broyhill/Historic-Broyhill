# Historic-Broyhill: Claude Code instructions

## Repository context

This checkout is a collection of project blueprints and packaged source, not an
unpacked application. Do not assume the directories described in the Markdown
exist on disk.

- `Complete Code-historic-broyhill.md`: collected architecture and code examples.
- Numbered batch Markdown files: supplemental proposals and code examples; they
  may differ from the complete package.
- `enterprise_nexus_platform.zip`: packaged pnpm workspace, including
  `apps/web-portal`, `apps/admin-dashboard`, `apps/ai-workers`, and
  `packages/database`.
- `inspinia-template-main.zip`: separate static HTML/CSS/JavaScript UI template.
- `KILLED Guide.pdf`: reference material; preserve the original.

The proposed application uses TypeScript, Next.js, NestJS, PostgreSQL/Prisma,
Redis/BullMQ, and Playwright. These are blueprint/archive contents, not verified
working services in this checkout.

## Working conventions and boundaries

- Inspect the relevant document or archive member before proposing a change.
  When sources disagree, identify the discrepancy and ask which is authoritative.
- Keep edits scoped to the request and match the surrounding style. Preserve
  historical code packages rather than reformatting or rewriting them wholesale.
- Do not unpack archives into the repository, replace binary assets, scaffold an
  application, install dependencies, or add CI/deployment configuration unless
  explicitly requested. Inspect archives read-only; use a temporary directory
  outside the repository for approved experiments.
- For approved application work, follow the actual manifest and local code style.
  Preserve TypeScript typing and app/shared-package separation; do not infer
  executable configuration from Markdown examples alone.
- Require explicit approval for schema/data migrations, tenant/authentication
  changes, infrastructure, deployments, paid API calls, or outbound email/SMS.
  Never run these against production data as part of verification.
- Never read or copy local credentials or private tenant data into prompts,
  logs, fixtures, or commits. Example credentials in source documents are not
  approved secrets. Keep authentication and environment values local.
- Review shell commands and file edits before granting permission. Do not
  disable Claude Code permission checks or commit personal Claude settings.

## Verification

There is no root `package.json`, lockfile, installed application, or runnable
test/lint/build setup. For documentation-only changes, check links and commands,
run `git diff --check`, and review `git diff` and `git status --short`.
Do not claim application tests passed.

The application archive declares pnpm scripts, but they are conditional guidance
only. Before any approved code work, inspect the extracted manifests, workspace
packages, lockfile, environment requirements, and tests. Run only applicable
existing checks and report missing prerequisites rather than inventing scripts.
See [the workflow guide](docs/claude-code.md) for the command inventory.

Before preparing a PR, inspect every changed file for secrets, unintended binary
changes, extracted sources, dependencies, and generated output. Summarize the
scope, verification performed, and anything that could not be verified.

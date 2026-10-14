# Using Claude Code with Historic-Broyhill

Claude Code is a local coding assistant for understanding this repository,
planning small features, investigating defects, and preparing focused PRs.
It is not an application runtime dependency or an integration with the
platform's AI workers.

## Local setup

1. Install Claude Code using the platform-specific instructions in the
   [official setup guide](https://code.claude.com/docs/en/setup).
   Install the CLI locally, not as a dependency of this repository.
2. Open a terminal at the root of your local Historic-Broyhill checkout and run:

   ```sh
   claude --version
   claude
   ```

3. Follow the first-run authentication prompts using your authorized account.
   See [authentication options](https://code.claude.com/docs/en/authentication)
   for account access and organization-managed provider setup. CLI access may
   require a supported subscription or billed API account; it is not provided
   by this repository.
4. Claude Code automatically loads the root [CLAUDE.md](../CLAUDE.md) as project
   instructions. Ask it to summarize the repository and propose a plan before
   editing. Review requested permissions and commands individually.

Do not paste authentication tokens, API keys, environment files, or private
tenant information into prompts or commit them. Check your organization's
data-handling policy before sharing code or archive contents with an AI service.
Keep personal configuration outside version control. This integration does not
require MCP servers, hooks, shared permission grants, or repository credentials.

## What is available here

The root contains Markdown code packages, two ZIP archives, and a PDF. It has
no executable package manifest, lockfile, or test suite. The complete Markdown
package describes a TypeScript monorepo; the numbered batches contain further
examples. Treat these as references, not proof that an application is deployed
or that the examples run.

`enterprise_nexus_platform.zip` contains the proposed application workspace.
`inspinia-template-main.zip` is a separate static UI template, not a Next.js app.
Inspect archive listings and selected members read-only first. If extraction
is needed, agree on the source and destination with the maintainer and use a
temporary directory outside the checkout; do not commit extracted contents or
modify the archives as incidental setup.

## Public website (separate from the archived platform)

The owner has selected Next.js + Tailwind for the future public website, as an
isolated project under `/site` with editable sample data in `/site/data`. No
source or setup commands for it exist yet. Its work follows the approval gates
in [CLAUDE.md](../CLAUDE.md) and the phases in
[BUILD_PROMPTS.md](../BUILD_PROMPTS.md): research only, then an approved design
direction, then separately authorized implementation. Hosting, forms,
deployment and outbound email need the owner's approval.

## Developer command inventory

**In the current checkout:** there is no app install/dev/build/lint/test command
to run. Documentation changes need only the review checks below.

**For separately approved work on unpacked application source:** the archive's
`enterprise_nexus_platform/package.json` requires Node.js >=20 and declares
pnpm workspace scripts. These are an inventory, not a verified setup recipe:

| Purpose | Command at the unpacked workspace root |
| --- | --- |
| Install dependencies | `pnpm install` |
| Development | `pnpm run dev` |
| Build | `pnpm run build` |
| Lint | `pnpm run lint` |
| End-to-end tests | `pnpm run test:e2e` |
| Generate Prisma client | `pnpm run prisma:generate` |

First inspect each script and workspace manifest, confirm a compatible pnpm
version, and check for the required source/configuration and test files. The
archive has no pnpm lockfile; do not promise reproducible installs or use
`--frozen-lockfile` without one. In particular, inspect the root `dev` script
before running it; it is not a verified workspace launcher. Do not run these
commands from this documentation-only checkout.

There is no generic `test` script in that manifest. Playwright checks require
their configuration, browser installation, and an appropriate local test
environment. Use existing targeted checks only when available, and report
missing prerequisites. Database push/seed scripts, backups, exports, and
service integrations are not default verification steps; obtain approval and
use isolated, non-production data.

## Recommended workflows

- **Feature work:** name the goal and acceptance criteria, identify the relevant
  blueprint/archive members, and request a plan with a narrow file scope.
  Confirm whether the task is a documentation correction or approved work on
  unpacked code before editing. Follow existing conventions and add targeted
  tests only when executable code and an appropriate test setup exist.
- **Debugging:** provide a sanitized reproduction, expected/actual behavior,
  and relevant error output. Ask Claude to inspect the source and explain a
  likely cause before changing anything. Distinguish defects in examples from
  failures reproduced in runnable code; use mocks or isolated test services
  rather than contacting production systems.
- **PR preparation:** ask for a small diff, a summary, verification results,
  and remaining limitations. Preserve tenant isolation and authorization;
  require human review for database, authentication, deployment, external
  messaging, and billing-related changes.

Example task prompt:

> Goal: clarify one setup step in the developer guide. Scope: documentation
> only; preserve archives and code packages. First inspect the relevant files
> and propose a plan. Acceptance: instructions match the current checkout,
> links resolve, and no application behavior changes. Verification: review the
> diff and run git diff --check. Flag uncertain commands instead of inventing
> an application setup.

## Verification before a PR

From your checkout root:

```sh
git diff --check
git diff --stat
git diff
git status --short
```

Check relative links and file names, distinguish actual files from archive
members, and verify command claims against their manifests. Review every changed
file for secrets and ensure archives, credentials, local Claude configuration,
dependencies, and generated files are not included. State exactly which checks
ran and which app checks were unavailable; documentation review does not prove
the packaged application builds or runs.

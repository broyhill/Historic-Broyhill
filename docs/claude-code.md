# Using Claude Code with Historic-Broyhill

Claude Code can help review this repository's blueprints, research references,
and prepare focused documentation changes. It is not an application runtime
dependency or an integration with any proposed platform services.

## Local setup

1. Install Claude Code using the platform-specific instructions in the
   [official setup guide](https://code.claude.com/docs/en/setup). Install the
   CLI locally, not as a dependency of this repository.
2. Open a terminal at the root of your Historic-Broyhill checkout and run:

   ```sh
   claude --version
   claude
   ```

3. Follow the first-run authentication prompts using your authorized account.
   See [authentication options](https://code.claude.com/docs/en/authentication)
   for account access and organization-managed provider setup. CLI access may
   require a supported subscription or billed API account; this repository
   does not provide it.
4. Claude Code loads the root [CLAUDE.md](../CLAUDE.md) as project instructions.
   Ask it to summarize the relevant files and propose a plan before editing.
   Review requested permissions and commands individually.

Do not paste authentication tokens, API keys, environment files, or private
tenant information into prompts or commits. Check your organization's
data-handling policy before sharing code or archive contents with an AI service.
Keep personal configuration outside version control. This guidance does not
require MCP servers, hooks, shared permission grants, or repository credentials.

## What is available in this checkout

The root contains Markdown blueprints, ZIP archives, a PDF, and this guidance.
There is no unpacked application source, root or `/site` package manifest,
lockfile, dependency installation, or application test suite. The archived and
documented code is not proof that an application runs.

The future public website's approved stack is Next.js + Tailwind, with an
isolated proposed project under `/site` and editable sample data under
`/site/data`. Neither source nor setup commands exist here yet. Preserve the
archives; inspect them read-only when relevant. Do not unpack or modify them as
incidental setup.

## Commands and verification

For this checkout, there are no application install, development, build, lint,
or test commands to run. Do not infer commands from archived or Markdown
examples. If approved source and manifests are added later, inspect the actual
manifests first and use their scripts and prerequisites. Until verified there,
future setup and check commands are proposals, not verified commands.

For documentation-only changes, review relative links and file names, inspect
the diff, and run:

```sh
git diff --check
git diff --stat
git diff
git status --short
```

These checks do not prove that the packaged or future application builds or
runs. State exactly which checks ran and report unavailable tools or app checks.

## Recommended workflows

- **Research:** follow the research gate in `CLAUDE.md`. `docs/design-research.md`
  is the only research-phase deliverable; report inaccessible references and
  stop for owner approval.
- **Feature work:** before editing, confirm that both research and design
  direction have been approved and that implementation was separately
  authorized. Identify a narrow file scope and use the actual source and
  manifests, if present.
- **Debugging:** provide a sanitized reproduction and expected/actual behavior.
  Distinguish defects in examples from failures reproduced in runnable code;
  use isolated test data rather than production systems.
- **Change review:** request a small diff, exact verification results, and
  remaining limitations. Get human approval for database, authentication,
  hosting, deployment, external messaging, and billing-related changes.

Example documentation task prompt:

> Goal: clarify one instruction in the developer guide. Scope: documentation
> only; preserve archives and code packages. First inspect the relevant files
> and propose a plan. Acceptance: instructions match the current checkout,
> relative links resolve, and no application behavior changes. Run
> `git diff --check`; do not claim application checks.

To upload your enterprise multi-tenant platform repository to **GitHub** and configure **GitHub Copilot** to write high-performance, context-aware code according to your strict design rulebooks, follow this structural execution blueprint.

------

Step 1: Upload the Codebase to a New GitHub Repository

Run these commands inside your **plain terminal** from your root `enterprise-nexus` directory to initialize Git, stage your files, and push the platform to the cloud:

bash

```
# 1. Initialize local repository and stage all files
git add .

# 2. Commit the foundational multi-modal architecture layers
git commit -m "feat: initialize open-source enterprise monorepo infrastructure with pgvector, multi-modal workflows, and docker orchestration"

# 3. Rename branch to main and link your remote GitHub repository
git branch -M main
git remote add origin https://github.com

# 4. Push the code securely to GitHub
git push -u origin main
```

Use code with caution.

------

Step 2: Inject Global Architectural Context for GitHub Copilot

GitHub Copilot relies on specific files located in the root directory to gather instructions about a project's style parameters, directory boundaries, and data schemas. This keeps it from outputting generic templates.

Save this exact configuration file as **`.github/copilot-instructions.md`** in your project root:

markdown

```
# GitHub Copilot System Engineering Instructions

You are the Senior Lead Engineer and Art Director for the Enterprise Nexus multi-tenant platform. Follow these strict rules for every code generation block:

## 1. Technical Framework & Project Structure
- This is a TypeScript-first monorepo. Frontend applications live in `apps/` (Next.js 15 App Router). Core shared assets live in `packages/` (Prisma/pgvector database layouts). Asynchronous workers live in `apps/ai-workers` (NestJS + BullMQ).
- Maintain absolute type alignment. Always infer definitions directly from `packages/database/prisma/schema.prisma`.

## 2. Component Design & Physics Rules (Emil Kowalski / Impeccable Standards)
- NEVER generate basic corporate designs or default purple gradients. Use dark, minimalist theme variables (`neutral-950` backgrounds, refined borders, monochromatic tones).
- Micro-interactions must feel instant and tactical: Button clicks MUST include `active:scale-[0.97]` or `active:scale-[0.98]` physical scale feedback.
- Popups, alerts, and tooltips must use a smooth entrance fade from an initial scale of `0.95`. Never scale items up from `0`.
- Respect reduced-motion system options natively using Tailwind responsive utilities.

## 3. Data Integrity & Multi-Tenant Boundaries
- All active database operations must isolate records using strict `Tenant` constraints or explicit `LeadProfile.intentSubject` tracking.
- AI RAG queries must route through the `pgvector` distance selector (`<=>` operator) using relational schemas.

## 4. Multi-Modal Verification Compliance
- Multi-modal marketing actions (MMS alerts, rich-text newsletters) must stage data assets directly into the `AiContentPipeline` with a status of `PENDING_REVIEW` to preserve the mandatory human-in-the-loop control gate.
```

Use code with caution.

------

Step 3: Configure Repository Indexing Rules

To ensure GitHub Copilot reads the exact instruction manifests and structural database layers without getting lost in large output arrays or logs, save this file as **`.copilotignore`** in your project root:

text

```
# Exclude build files, dependency layers, and execution snapshots from Copilot indexing loops
.next/
dist/
node_modules/
packages/database/snapshots/
*.csv
*.sql.gz
```

Use code with caution.

------

Step 4: Instructing GitHub Copilot in Chat

Once these instructions are pushed to GitHub, developers on your team can prompt Copilot inside VS Code, Cursor, or the GitHub Web Portal.

Use these precise context prompts to direct Copilot when building features:

Prompt 1: Building a New Layout Component

text

```
@workspace /explain our component rules in .github/copilot-instructions.md, then build an interactive boardroom layout selector for apps/web-portal using Tailwind and Shadcn/UI. Ensure it satisfies our strict micro-interaction scaling physics.
```

Use code with caution.

Prompt 2: Extending the AI CRM Logic

text

```
@workspace Refer to packages/database/prisma/schema.prisma and .github/copilot-instructions.md. Write a new route handler in apps/ai-workers to process lead activity inputs and safely update the AI enrichment weights without breaking tenant boundaries.
```

Use code with caution.

------

Let me know if you would like me to map out a **GitHub Actions CI configuration block** to automatically run code style validation against these exact instructions every time your team commits code!
**Here is your comprehensive production-ready codebase package optimized for Vercel deployment:**enterprise_nexus_vercel_final.zip



I have compiled all the completed application frontend components, natural language prompt decks, video/image multi-modal processing interfaces, automated seed configs, and Playwright verification scripts created across this technical development stream into a single, cohesive monorepo workspace package.



------

📂 Complete File Directory Manifest

text

```
enterprise-nexus/
├── apps/
│   └── admin-dashboard/
│       ├── app/
│       │   ├── admin/
│       │   │   └── page.tsx                   # Inspinia-Styled Visual Command Deck
│       │   └── api/
│       │       └── admin/
│       │           └── campaigns/
│       │               └── route.ts           # Next.js 15 App Router human-gate API
│       └── tests/
│           ├── amateur-admin.spec.ts          # Playwright UI user-flow validation
│           └── campaign-api.spec.ts           # Playwright network intercept validation
├── packages/
│   └── database/
│       ├── openapi-spec.yaml                  # OpenAPI 3.0 API transactional contract
│       ├── openapi-spec.json                  # OpenAPI 3.0 tracking array mapping
│       └── prisma/
│           └── schema.prisma                  # Data schemas for leases, vectors, and alerts
├── scripts/
│   ├── seed-amateur-data.ts                   # Hydrates database logs with mock media
│   └── health-check.sh                        # Diagnostics pipeline check automation
├── .github/
│   └── workflows/
│       └── deploy.yml                         # Automated multi-environment CI/CD deployment
├── vercel.json                                # Specialized Monorepo build boundary configuration
├── package.json                               # Global Monorepo routing and dependency targets
└── pnpm-workspace.yaml                        # Standard pnpm workspace path declarations
```

Use code with caution.

------

🚀 Vercel Production Deployment Instructions

Vercel handles Next.js monorepos out of the box with zero configuration friction. Follow these direct placement steps to go live:



1. Add Vercel Monorepo Settings



To ensure Vercel isolates and builds the backoffice dashboard app without pulling unnecessary files from adjacent projects, save this file as **`vercel.json`**directly inside the root directory of your workspace:



json

```
{
  "version": 2,
  "buildCommand": "pnpm --filter admin-dashboard build",
  "outputDirectory": "apps/admin-dashboard/.next",
  "framework": "nextjs"
}
```

Use code with caution.

2. Connect Your Repository to Vercel



1. Navigate to the **Vercel Dashboard** (`vercel.com`) and click **Add New > Project**.
2. Select your newly pushed GitHub repository (`enterprise-nexus`).
3. In the **Configure Project** window, set the **Root Directory** field path directly to: `apps/admin-dashboard`.
4. Leave the **Build and Output Settings** at their default values—Vercel will parse the custom `vercel.json` root settings automatically.
5. Provision Production Environment Variables



Before clicking deploy, expand the **Environment Variables** segment inside Vercel and map your production service keys:



- `DATABASE_URL`: Your live production PostgreSQL connection string (pre-loaded with the `pgvector` extension).
- `OPENAI_API_KEY`: Your operational OpenAI authorization token for dynamic RAG prompts and DALL-E 3 rendering passes.
- `SENDGRID_API_KEY`: Your marketing automation outgoing email transport credential token.
- `TWILIO_ACCOUNT_SID` & `TWILIO_AUTH_TOKEN`: Secure communication tokens to route text alerts and high-end video MMS streams.
- `SLACK_OPERATIONS_WEBHOOK_URL`: Target routing endpoint to catch real-time hot lead human escalations instantly.

Click **Deploy**. Vercel will optimize your Next.js application, build standalone serverless functions for the API routing lines, and deliver a live production link for non-technical managers to oversee operations.



------

Could you tell me more about **who will be using this dashboard** (e.g., on-site operations staff, leasing agents, or corporate executives) so I can tailor the final onboarding steps exactly to your team's needs?
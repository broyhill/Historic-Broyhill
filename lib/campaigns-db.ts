import { prisma } from "@/lib/prisma";

// The campaigns table is created on first use, additively and idempotently, so no
// separate migration step is needed. This statement mirrors `model EmailCampaign`
// in prisma/schema.prisma and touches no other table.
const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS "EmailCampaign" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "subject" TEXT NOT NULL DEFAULT '',
  "previewText" TEXT NOT NULL DEFAULT '',
  "fromName" TEXT NOT NULL DEFAULT '',
  "fromEmail" TEXT NOT NULL DEFAULT '',
  "replyTo" TEXT,
  "recipientFilter" JSONB,
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "designType" TEXT NOT NULL DEFAULT 'plain',
  "body" TEXT NOT NULL DEFAULT '',
  "aiBrief" JSONB,
  "testSends" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailCampaign_pkey" PRIMARY KEY ("id")
)`;

let ready: Promise<void> | null = null;

export function ensureCampaignTable(): Promise<void> {
  if (!ready) {
    ready = prisma.$executeRawUnsafe(CREATE_TABLE).then(() => undefined);
    // Retry on the next call if it failed (for example a dropped connection).
    ready.catch(() => { ready = null; });
  }
  return ready;
}

import { prisma } from "@/lib/prisma";
import { STARTER_JOURNEYS } from "@/lib/journeys";

// Journey tables are created on first use, additively and idempotently (CREATE ... IF NOT EXISTS),
// mirroring `model Journey` and `model JourneyRun` in prisma/schema.prisma. No other table is
// changed. The only reference to an existing table is JourneyRun.leadId -> LeadProfile(id), so a
// deleted lead's journey history goes with it.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "Journey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAUSED',
    "approvalMode" TEXT NOT NULL DEFAULT 'REVIEW',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Journey_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE IF NOT EXISTS "JourneyRun" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "stepIndex" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "stoppedReason" TEXT,
    "log" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JourneyRun_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "JourneyRun_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "Journey"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JourneyRun_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "LeadProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "JourneyRun_status_nextRunAt_idx" ON "JourneyRun"("status", "nextRunAt")`,
  `CREATE INDEX IF NOT EXISTS "JourneyRun_leadId_idx" ON "JourneyRun"("leadId")`,
];

export const JOURNEY_DDL = STATEMENTS;

let ready: Promise<void> | null = null;

export function ensureJourneyTables(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      for (const sql of STATEMENTS) await prisma.$executeRawUnsafe(sql);
      // First time only: add the three starter journeys, paused and in review mode.
      if ((await prisma.journey.count()) === 0) {
        for (const j of STARTER_JOURNEYS) {
          await prisma.journey.create({ data: { name: j.name, trigger: j.trigger, status: "PAUSED", approvalMode: "REVIEW", steps: j.steps } });
        }
      }
    })();
    // Try again on the next call if this one failed (for example a dropped connection).
    ready.catch(() => { ready = null; });
  }
  return ready;
}

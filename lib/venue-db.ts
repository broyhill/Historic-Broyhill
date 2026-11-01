import { prisma } from "@/lib/prisma";
import { AVAILABILITY, SPACES, type Availability, type Status } from "@/lib/spaces";

// Venue tables (VenueEvent, AvailabilityBlock, ExpressBookRequest) are created on first
// use, additively and idempotently (CREATE ... IF NOT EXISTS), mirroring the models in
// prisma/schema.prisma. No other table is touched. Optional references to LeadProfile(id)
// are kept as plain columns, not foreign keys, so a removed lead never breaks an event.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "VenueEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" TEXT,
    "leadId" TEXT,
    "spaces" JSONB NOT NULL DEFAULT '[]',
    "dateStart" TEXT,
    "dateEnd" TEXT,
    "guests" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'INQUIRY',
    "notes" TEXT,
    "proposalDraft" TEXT,
    "beoDraft" TEXT,
    "shareToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VenueEvent_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "VenueEvent_shareToken_key" ON "VenueEvent"("shareToken")`,
  `CREATE INDEX IF NOT EXISTS "VenueEvent_leadId_idx" ON "VenueEvent"("leadId")`,
  `CREATE INDEX IF NOT EXISTS "VenueEvent_status_idx" ON "VenueEvent"("status")`,
  `CREATE TABLE IF NOT EXISTS "AvailabilityBlock" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AvailabilityBlock_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AvailabilityBlock_spaceId_date_key" ON "AvailabilityBlock"("spaceId", "date")`,
  `CREATE INDEX IF NOT EXISTS "AvailabilityBlock_date_idx" ON "AvailabilityBlock"("date")`,
  `CREATE TABLE IF NOT EXISTS "ExpressBookRequest" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "guests" INTEGER,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "leadId" TEXT,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpressBookRequest_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ExpressBookRequest_status_idx" ON "ExpressBookRequest"("status")`,
];

let ready: Promise<void> | null = null;

export function ensureVenueTables(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      for (const sql of STATEMENTS) await prisma.$executeRawUnsafe(sql);
    })();
    // Try again on the next call if this one failed (for example a dropped connection).
    ready.catch(() => { ready = null; });
  }
  return ready;
}

export const EVENT_STATUSES = ["INQUIRY", "TENTATIVE", "BOOKED", "COMPLETED", "CANCELLED"] as const;
export const BLOCK_STATUSES = ["open", "held", "booked"] as const;
export const VALID_SPACE_IDS = new Set(SPACES.map((s) => s.id));

export function newShareToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Date string in YYYY-MM-DD form (same validation the calendar uses). */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Public-calendar availability: the editable JSON defaults overlaid with the
 * staff-maintained AvailabilityBlock rows. Falls back to the JSON when the
 * database is unreachable so the public page always renders.
 */
export async function getAvailability(): Promise<Availability> {
  const base: Availability = {
    sample: AVAILABILITY.sample,
    defaultStatus: AVAILABILITY.defaultStatus,
    rooms: Object.fromEntries(
      Object.entries(AVAILABILITY.rooms).map(([room, days]) => [room, { ...days }]),
    ),
  };
  try {
    await ensureVenueTables();
    const blocks = await prisma.availabilityBlock.findMany();
    for (const block of blocks) {
      if (!VALID_SPACE_IDS.has(block.spaceId)) continue;
      if (!BLOCK_STATUSES.includes(block.status as Status)) continue;
      if (!isDateKey(block.date)) continue;
      (base.rooms[block.spaceId] ??= {})[block.date] = block.status as Status;
    }
    return base;
  } catch {
    return base;
  }
}

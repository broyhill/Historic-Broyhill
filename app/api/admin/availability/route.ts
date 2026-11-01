import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BLOCK_STATUSES, ensureVenueTables, isDateKey, VALID_SPACE_IDS } from "@/lib/venue-db";

// Staff-maintained availability rows. Auth via /api/admin middleware.
// These rows overlay app/data/availability.json when the public calendar renders.

export async function GET(request: Request) {
  try {
    await ensureVenueTables();
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // YYYY-MM, optional
    const where = month && /^\d{4}-\d{2}$/.test(month) ? { date: { startsWith: month } } : {};
    const blocks = await prisma.availabilityBlock.findMany({ where, orderBy: [{ date: "asc" }, { spaceId: "asc" }] });
    return NextResponse.json({ success: true, blocks });
  } catch (error: any) {
    console.error("availability list failed", error);
    return NextResponse.json({ error: "Could not load availability." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { spaceId, date, status, note } = await request.json();
    if (!VALID_SPACE_IDS.has(spaceId)) return NextResponse.json({ error: "Unknown space." }, { status: 400 });
    if (!isDateKey(date)) return NextResponse.json({ error: "Date must be YYYY-MM-DD." }, { status: 400 });
    if (!BLOCK_STATUSES.includes(status)) return NextResponse.json({ error: "Status must be open, held or booked." }, { status: 400 });

    await ensureVenueTables();
    const block = await prisma.availabilityBlock.upsert({
      where: { spaceId_date: { spaceId, date } },
      update: { status, note: note ?? null },
      create: { spaceId, date, status, note: note ?? null },
    });
    return NextResponse.json({ success: true, block });
  } catch (error: any) {
    console.error("availability update failed", error);
    return NextResponse.json({ error: "Could not save availability." }, { status: 500 });
  }
}

// Removing a row returns that room+date to the JSON default status.
export async function DELETE(request: Request) {
  try {
    const { spaceId, date } = await request.json();
    if (!VALID_SPACE_IDS.has(spaceId) || !isDateKey(date)) {
      return NextResponse.json({ error: "spaceId and date are required." }, { status: 400 });
    }
    await ensureVenueTables();
    await prisma.availabilityBlock.deleteMany({ where: { spaceId, date } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("availability delete failed", error);
    return NextResponse.json({ error: "Could not clear that date." }, { status: 500 });
  }
}

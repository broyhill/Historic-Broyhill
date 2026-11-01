import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ensureVenueTables, isDateKey, VALID_SPACE_IDS } from "@/lib/venue-db";
import { processCapture } from "@/lib/capture";

const bodySchema = z.object({
  spaceId: z.string().trim().min(1).max(80),
  date: z.string().trim().min(1).max(10),
  guests: z.number().int().min(1).max(10000).optional().nullable(),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
});

// Public self-serve date request. Creates a PENDING ExpressBookRequest and routes the
// guest through the standard capture pipeline (scored lead + draft reply in the review
// queue). Sends nothing itself; staff approve or decline in admin.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
    }
    const { spaceId, date, guests, name, email, phone, notes } = parsed.data;

    if (!VALID_SPACE_IDS.has(spaceId)) {
      return NextResponse.json({ error: "Unknown space." }, { status: 400 });
    }
    if (!isDateKey(date)) {
      return NextResponse.json({ error: "Date must be YYYY-MM-DD." }, { status: 400 });
    }

    await ensureVenueTables();

    // Route the guest through the same pipeline as the RFP form (lead + staged draft).
    const capture = await processCapture({
      business_id: "broyhill-01",
      email,
      name,
      phone: phone ?? undefined,
      notes: notes ?? "",
      tags: ["express-book", `space:${spaceId}`, `date:${date}`],
    });
    const captureData = await capture.json();
    if (!capture.ok || !captureData?.lead?.id) {
      return NextResponse.json({ error: captureData?.error || "Could not record your request." }, { status: capture.status });
    }

    const existing = await prisma.expressBookRequest.findFirst({
      where: { spaceId, date, status: "PENDING", email: { not: email } },
    });
    const created = await prisma.expressBookRequest.create({
      data: {
        spaceId,
        date,
        guests: guests ?? null,
        name,
        email: email.toLowerCase(),
        phone: phone ?? null,
        notes: notes ?? null,
        leadId: captureData.lead.id,
      },
    });

    return NextResponse.json({
      success: true,
      request: { id: created.id, spaceId, date, status: created.status },
      waitingBehind: existing ? 1 : 0,
    });
  } catch (error: any) {
    console.error("express-book error:", error);
    return NextResponse.json({ error: "Could not record your request." }, { status: 500 });
  }
}

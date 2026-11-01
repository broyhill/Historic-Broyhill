import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureVenueTables, newShareToken } from "@/lib/venue-db";
import { spaceById } from "@/lib/spaces";

// Express-book request queue. Auth via /api/admin middleware.
// APPROVE creates a tentative VenueEvent and marks the room+date held;
// DECLINE closes the request. Nothing is emailed from here.

export async function GET(request: Request) {
  try {
    await ensureVenueTables();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "PENDING";
    const where = status === "ALL" ? {} : { status };
    const requests = await prisma.expressBookRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    return NextResponse.json({ success: true, requests });
  } catch (error: any) {
    console.error("list express requests failed", error);
    return NextResponse.json({ error: "Could not load requests." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, action } = await request.json();
    if (!id || !action) return NextResponse.json({ error: "id and action are required." }, { status: 400 });

    await ensureVenueTables();
    const req = await prisma.expressBookRequest.findUnique({ where: { id } });
    if (!req) return NextResponse.json({ error: "Request not found." }, { status: 404 });
    if (req.status !== "PENDING") {
      return NextResponse.json({ error: `Request is already ${req.status.toLowerCase()}.` }, { status: 409 });
    }

    if (action === "DECLINE") {
      const updated = await prisma.expressBookRequest.update({ where: { id }, data: { status: "DECLINED" } });
      return NextResponse.json({ success: true, request: updated });
    }

    if (action === "APPROVE") {
      const spaceName = spaceById(req.spaceId)?.name ?? req.spaceId;
      const event = await prisma.venueEvent.create({
        data: {
          name: `${req.name} — ${spaceName}`,
          eventType: "Express request",
          leadId: req.leadId,
          spaces: [req.spaceId],
          dateStart: req.date,
          guests: req.guests,
          status: "TENTATIVE",
          notes: req.notes,
          shareToken: newShareToken(),
        },
      });
      // Mark the date held on the public calendar (staff can still change it).
      await prisma.availabilityBlock.upsert({
        where: { spaceId_date: { spaceId: req.spaceId, date: req.date } },
        update: { status: "held" },
        create: { spaceId: req.spaceId, date: req.date, status: "held" },
      });
      const updated = await prisma.expressBookRequest.update({
        where: { id },
        data: { status: "APPROVED", eventId: event.id },
      });
      return NextResponse.json({ success: true, request: updated, event });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error: any) {
    console.error("express request update failed", error);
    return NextResponse.json({ error: "Could not update the request." }, { status: 500 });
  }
}

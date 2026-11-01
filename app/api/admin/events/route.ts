import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { claudeEnabled, claudeJson } from "@/lib/ai";
import { EVENT_STATUSES, ensureVenueTables, isDateKey, newShareToken, VALID_SPACE_IDS } from "@/lib/venue-db";
import { SPACES } from "@/lib/spaces";

// The venue's event spine: inquiry → tentative → booked → completed. Auth via
// /api/admin middleware. Proposals and run-of-day docs are AI drafts kept on the
// event row; the public /proposal/<shareToken> link renders them read-only.

const FACTS = `Venue facts (use ONLY these; they are the only verified details):
- Historic Broyhill is a 1920s school building in Clemmons, NC (3540 Clemmons Road), converted to offices and event space around 2006.
- Event spaces: Magnolia Room (20–120 seated, up to 140 reception), The Boardrooms (day or half-day), The Dock (outdoor covered stage), The Loft (up to 20).
- Bookings are confirmed by the venue team; some rooms can also be held through broyhill.skedda.com.
- Contact: Sonja Kennedy, events — 336-908-8382; office 336-793-1191; Info@Broyhill.net.
Never state or imply prices, capacities, dimensions, amenities or dates not given here or in the event details.`;

const draftSchema = z.object({ draft: z.string() });

function templateDraft(kind: "proposal" | "beo", e: { name: string; eventType: string | null; spaces: any; dateStart: string | null; guests: number | null; notes: string | null }): string {
  const rooms = (Array.isArray(e.spaces) ? e.spaces : [])
    .map((id) => SPACES.find((s) => s.id === id)?.name ?? id)
    .join(", ") || "To be confirmed";
  const when = e.dateStart ?? "Date to be confirmed";
  const who = e.guests ? `${e.guests} guests` : "guest count to be confirmed";
  const lines = [
    `${e.name}`,
    ``,
    `Prepared by Historic Broyhill · 3540 Clemmons Road, Suite 111 · Clemmons, NC 27012`,
    `336-793-1191 · Info@Broyhill.net`,
    ``,
    `Event: ${e.eventType ?? "Private event"}`,
    `Spaces: ${rooms}`,
    `Date: ${when}`,
    `Guests: ${who}`,
  ];
  if (e.notes) lines.push(``, `Notes: ${e.notes}`);
  lines.push(
    ``,
    kind === "proposal"
      ? `Next steps: the venue team confirms availability for ${when}, then walks you through room options, setup and timing. Reply to this proposal or call 336-908-8382 to move forward.`
      : `Run of day: arrival and setup window, guest arrival, program, breakdown — the venue team finalizes timing with you on confirmation.`,
  );
  return lines.join("\n");
}

function cleanSpaces(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s) => typeof s === "string" && VALID_SPACE_IDS.has(s));
}

export async function GET() {
  try {
    await ensureVenueTables();
    const events = await prisma.venueEvent.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    const leadIds = events.map((e) => e.leadId).filter((id): id is string => Boolean(id));
    const leads = leadIds.length
      ? await prisma.leadProfile.findMany({ where: { id: { in: leadIds } }, select: { id: true, name: true, email: true, company: true } })
      : [];
    const byId = new Map(leads.map((l) => [l.id, l]));
    return NextResponse.json({
      success: true,
      events: events.map((e) => ({ ...e, lead: e.leadId ? byId.get(e.leadId) ?? null : null })),
    });
  } catch (error: any) {
    console.error("list events failed", error);
    return NextResponse.json({ error: "Could not load events." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "Event name is required." }, { status: 400 });
    if (body.dateStart && !isDateKey(body.dateStart)) return NextResponse.json({ error: "Date must be YYYY-MM-DD." }, { status: 400 });
    if (body.dateEnd && !isDateKey(body.dateEnd)) return NextResponse.json({ error: "End date must be YYYY-MM-DD." }, { status: 400 });

    await ensureVenueTables();

    let leadId: string | null = null;
    if (typeof body.leadEmail === "string" && body.leadEmail.trim()) {
      const lead = await prisma.leadProfile.findUnique({ where: { email: body.leadEmail.trim().toLowerCase() }, select: { id: true } });
      if (!lead) return NextResponse.json({ error: "No lead with that email on file." }, { status: 404 });
      leadId = lead.id;
    }

    const event = await prisma.venueEvent.create({
      data: {
        name,
        eventType: typeof body.eventType === "string" && body.eventType.trim() ? body.eventType.trim() : null,
        leadId,
        spaces: cleanSpaces(body.spaces),
        dateStart: body.dateStart ?? null,
        dateEnd: body.dateEnd ?? null,
        guests: Number.isInteger(body.guests) ? body.guests : null,
        notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
        shareToken: newShareToken(),
      },
    });
    return NextResponse.json({ success: true, event });
  } catch (error: any) {
    console.error("create event failed", error);
    return NextResponse.json({ error: "Could not create the event." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, action } = body;
    if (!id || !action) return NextResponse.json({ error: "id and action are required." }, { status: 400 });

    await ensureVenueTables();
    const event = await prisma.venueEvent.findUnique({ where: { id } });
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });

    if (action === "update") {
      const data: Record<string, any> = {};
      if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
      if (typeof body.eventType === "string") data.eventType = body.eventType.trim() || null;
      if (body.spaces !== undefined) data.spaces = cleanSpaces(body.spaces);
      if (body.dateStart !== undefined) {
        if (body.dateStart && !isDateKey(body.dateStart)) return NextResponse.json({ error: "Date must be YYYY-MM-DD." }, { status: 400 });
        data.dateStart = body.dateStart || null;
      }
      if (body.dateEnd !== undefined) {
        if (body.dateEnd && !isDateKey(body.dateEnd)) return NextResponse.json({ error: "End date must be YYYY-MM-DD." }, { status: 400 });
        data.dateEnd = body.dateEnd || null;
      }
      if (body.guests !== undefined) data.guests = Number.isInteger(body.guests) ? body.guests : null;
      if (typeof body.status === "string") {
        if (!(EVENT_STATUSES as readonly string[]).includes(body.status)) {
          return NextResponse.json({ error: "Unknown status." }, { status: 400 });
        }
        data.status = body.status;
      }
      if (typeof body.notes === "string") data.notes = body.notes.trim() || null;
      const updated = await prisma.venueEvent.update({ where: { id }, data });
      return NextResponse.json({ success: true, event: updated });
    }

    if (action === "generate_proposal" || action === "generate_beo") {
      const kind = action === "generate_proposal" ? "proposal" : "beo";
      let draft = "";
      if (claudeEnabled()) {
        const parsed = await claudeJson({
          system: `You are the event sales director at Historic Broyhill writing a ${kind === "proposal" ? "client-facing event proposal" : "banquet event order (run of day)"}. Plain, warm, concrete language. No invented facts.\n\n${FACTS}`,
          user: `Event details:\nName: ${event.name}\nType: ${event.eventType ?? "not given"}\nSpaces: ${(Array.isArray(event.spaces) ? event.spaces : []).join(", ") || "to be confirmed"}\nDate: ${event.dateStart ?? "to be confirmed"}${event.dateEnd ? ` – ${event.dateEnd}` : ""}\nGuests: ${event.guests ?? "not given"}\nNotes: ${event.notes ?? "none"}\n\nWrite the ${kind} as plain text. Return {"draft": "..."}.`,
          schema: draftSchema,
          maxTokens: 2500,
        });
        draft = parsed?.draft?.trim() ?? "";
      }
      const ai = Boolean(draft);
      if (!draft) draft = templateDraft(kind, event);
      const updated = await prisma.venueEvent.update({
        where: { id },
        data: kind === "proposal" ? { proposalDraft: draft } : { beoDraft: draft },
      });
      return NextResponse.json({ success: true, event: updated, source: ai ? "ai" : "template" });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error: any) {
    console.error("update event failed", error);
    return NextResponse.json({ error: "Could not update the event." }, { status: 500 });
  }
}

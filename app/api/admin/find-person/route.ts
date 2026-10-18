import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { domainOf, isFreeDomain } from "@/lib/enrich";
import { findPerson } from "@/lib/findperson";

// Web searches run inside the request; give it room.
export const maxDuration = 120;

const DEFAULT_BATCH = 10;

// Web-search person lookup for nameless corporate leads. Each call does a small
// batch (default 10) so you can review before scaling. Only confident matches
// are saved (name/LinkedIn); every processed lead is marked searched so it is
// never looked up (or charged) twice. Auth via /api/admin middleware.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(Math.max(Number(body.limit) || DEFAULT_BATCH, 1), 25);

    // Scan un-searched, nameless leads; skip personal mailboxes.
    const window = await prisma.leadProfile.findMany({
      where: { personSearchedAt: null, name: null },
      orderBy: { createdAt: "asc" },
      take: 300,
      select: { id: true, email: true, company: true, linkedinId: true, customFields: true },
    });

    const now = new Date();
    const freeIds: string[] = [];
    const corporate: typeof window = [];
    for (const l of window) {
      if (isFreeDomain(domainOf(l.email))) freeIds.push(l.id); else corporate.push(l);
    }
    if (freeIds.length) {
      await prisma.leadProfile.updateMany({ where: { id: { in: freeIds } }, data: { personSearchedAt: now } });
    }

    const targets = corporate.slice(0, limit);
    const found = await Promise.all(targets.map((l) => findPerson(l.email, l.company)));

    const results: any[] = [];
    let applied = 0;
    let apiError: string | null = null;

    for (let i = 0; i < targets.length; i++) {
      const lead = targets[i];
      const r = found[i];
      if (r.error && !apiError) apiError = r.error;

      const strong = r.confidence === "high" || r.confidence === "medium";
      const data: Record<string, unknown> = { personSearchedAt: now };
      const willName = strong && Boolean(r.name); // these leads are all name-null by query
      const willLinkedin = strong && Boolean(r.linkedin) && !lead.linkedinId;
      if (willName) data.name = r.name;
      if (willLinkedin) data.linkedinId = r.linkedin;
      // Keep the evidence trail on the record for auditing.
      const cf = (lead.customFields && typeof lead.customFields === "object" && !Array.isArray(lead.customFields)) ? lead.customFields as Record<string, unknown> : {};
      data.customFields = { ...cf, personTitle: r.title, personSource: r.source, personConfidence: r.confidence };

      await prisma.leadProfile.update({ where: { id: lead.id }, data });
      if (willName || willLinkedin) applied++;

      results.push({
        email: lead.email,
        company: lead.company,
        name: r.name,
        title: r.title,
        linkedin: r.linkedin,
        confidence: r.confidence,
        source: r.source,
        applied: Boolean(willName || willLinkedin),
      });
    }

    const remaining = await prisma.leadProfile.count({ where: { personSearchedAt: null, name: null } });

    return NextResponse.json({
      success: true,
      searched: targets.length,
      applied,
      skippedPersonal: freeIds.length,
      remaining,
      results,
      apiError,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

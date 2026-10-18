import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_TRACK = "Client List";

interface IncomingLead {
  email?: string;
  name?: string | null;
  company?: string | null;
  phone?: string | null;
  linkedinId?: string | null;
}

// Bulk importer for the lead directory. Load-only: it upserts LeadProfile
// rows and never stages outreach or calls any AI, so importing a large client
// list can't email anyone. Auth is enforced by the /api/admin middleware.
//
// POST { rows: IncomingLead[], commit: boolean, businessId?: string }
//   commit=false -> dry run: returns counts only, writes nothing
//   commit=true  -> upserts and returns the same counts
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rows: IncomingLead[] = Array.isArray(body.rows) ? body.rows : [];
    const commit = body.commit === true;
    const businessId = typeof body.businessId === "string" ? body.businessId : "broyhill-01";

    if (rows.length === 0) return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    if (rows.length > 20000) return NextResponse.json({ error: "Too many rows (limit 20,000 per import)" }, { status: 413 });

    const business = await prisma.businessProfile.findUnique({ where: { id: businessId } });
    if (!business) return NextResponse.json({ error: `Business '${businessId}' not found` }, { status: 404 });

    // Normalize + validate, then dedupe within the file (last occurrence wins)
    let skipped = 0;
    const byEmail = new Map<string, IncomingLead & { email: string }>();
    for (const r of rows) {
      const email = (r.email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) { skipped++; continue; }
      byEmail.set(email, {
        email,
        name: r.name?.toString().trim() || null,
        company: r.company?.toString().trim() || null,
        phone: r.phone?.toString().trim() || null,
        linkedinId: r.linkedinId?.toString().trim() || null,
      });
    }
    const cleaned = Array.from(byEmail.values());
    if (cleaned.length === 0) {
      return NextResponse.json({ success: true, committed: false, counts: { total: rows.length, toCreate: 0, toUpdate: 0, skipped } });
    }

    // Which of these emails already exist?
    const existing = await prisma.leadProfile.findMany({
      where: { email: { in: cleaned.map((l) => l.email) } },
      select: { email: true },
    });
    const existingSet = new Set(existing.map((e) => e.email));
    const toCreate = cleaned.filter((l) => !existingSet.has(l.email)).length;
    const toUpdate = cleaned.length - toCreate;

    const counts = { total: rows.length, toCreate, toUpdate, skipped };

    if (!commit) {
      return NextResponse.json({ success: true, committed: false, counts });
    }

    // Upsert in chunks. On update we only overwrite a field when the import
    // actually supplies a value, so re-importing never blanks out good data or
    // changes a lead's track/score/status set by the real capture flow.
    const CHUNK = 100;
    for (let i = 0; i < cleaned.length; i += CHUNK) {
      const slice = cleaned.slice(i, i + CHUNK);
      await prisma.$transaction(
        slice.map((l) =>
          prisma.leadProfile.upsert({
            where: { email: l.email },
            update: {
              ...(l.name ? { name: l.name } : {}),
              ...(l.company ? { company: l.company } : {}),
              ...(l.phone ? { phone: l.phone } : {}),
              ...(l.linkedinId ? { linkedinId: l.linkedinId } : {}),
            },
            create: {
              businessId: business.id,
              email: l.email,
              name: l.name,
              company: l.company,
              phone: l.phone,
              linkedinId: l.linkedinId,
              leadScore: 0,
              leadStatus: "CLIENT",
              primaryTrack: DEFAULT_TRACK,
              leadSource: "IMPORT",
            },
          })
        )
      );
    }

    return NextResponse.json({ success: true, committed: true, counts });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

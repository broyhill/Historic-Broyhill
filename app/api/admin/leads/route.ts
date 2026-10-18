import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildLeadWhere, LEAD_SELECT } from "@/lib/leads-query";

// Lead directory for the Operations Console. Auth is enforced by middleware
// (every /api/admin/* path requires an admin session).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const where = buildLeadWhere({
      q: searchParams.get("q"),
      track: searchParams.get("track"),
      status: searchParams.get("status"),
      gap: searchParams.get("gap"),
    });

    // The rows the table shows, plus the distinct values that populate the
    // filter dropdowns (computed over the whole table, not just this page,
    // so the filters stay stable as you narrow the search).
    const [leads, trackRows, statusRows] = await Promise.all([
      prisma.leadProfile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 1000,
        select: LEAD_SELECT,
      }),
      prisma.leadProfile.findMany({ distinct: ["primaryTrack"], select: { primaryTrack: true }, orderBy: { primaryTrack: "asc" } }),
      prisma.leadProfile.findMany({ distinct: ["leadStatus"], select: { leadStatus: true }, orderBy: { leadStatus: "asc" } }),
    ]);

    return NextResponse.json({
      success: true,
      leads,
      tracks: trackRows.map((r) => r.primaryTrack).filter(Boolean),
      statuses: statusRows.map((r) => r.leadStatus).filter(Boolean),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

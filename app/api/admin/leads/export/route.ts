import { prisma } from "@/lib/prisma";
import { buildLeadWhere, LEAD_SELECT } from "@/lib/leads-query";

// RFC 4180 field: wrap in quotes and double any internal quotes whenever the
// value contains a comma, quote, or newline. Null/undefined become empty.
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADERS = [
  "Name", "Company", "Email", "Phone", "LinkedIn", "Company LinkedIn",
  "City", "State", "Score", "Status", "Interest", "Source", "Est. Value", "Captured",
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const where = buildLeadWhere({
      q: searchParams.get("q"),
      track: searchParams.get("track"),
      status: searchParams.get("status"),
    });

    const leads = await prisma.leadProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: LEAD_SELECT,
    });

    const rows = leads.map((l) => [
      l.name, l.company, l.email, l.phone, l.linkedinId, l.companyLinkedin,
      l.city, l.state, l.leadScore, l.leadStatus, l.primaryTrack, l.leadSource,
      l.estimatedValue, l.createdAt.toISOString(),
    ].map(csvCell).join(","));

    // Prepend a UTF-8 BOM so Excel opens accented names correctly.
    const csv = "﻿" + [HEADERS.join(","), ...rows].join("\r\n");
    const stamp = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="historic-broyhill-leads-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return new Response(`Export failed: ${error.message}`, { status: 500 });
  }
}

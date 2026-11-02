import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordTripwire } from "@/lib/tripwires";

// 1×1 open-tracking pixel. GET /api/t/open?lid=<leadId>&c=<campaignId>
const GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(req: Request) {
  const u = new URL(req.url);
  const lid = u.searchParams.get("lid");
  const c = u.searchParams.get("c");
  const email = u.searchParams.get("e");

  if (lid || email) {
    const lead = lid
      ? await prisma.leadProfile.findUnique({ where: { id: lid } }).catch(() => null)
      : await prisma.leadProfile.findUnique({ where: { email: email! } }).catch(() => null);
    if (lead) {
      await recordTripwire({
        leadId: lead.id, type: "open", source: "email", campaignId: c ?? undefined,
        metadata: { ua: req.headers.get("user-agent") ?? undefined },
      });
    }
  }

  return new NextResponse(GIF, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

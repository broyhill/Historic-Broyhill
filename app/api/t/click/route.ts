import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordTripwire } from "@/lib/tripwires";

// Click-through wire: logs the click then 302s to the destination.
// GET /api/t/click?lid=<leadId>&c=<campaignId>&to=<url>
export async function GET(req: Request) {
  const u = new URL(req.url);
  const lid = u.searchParams.get("lid");
  const c = u.searchParams.get("c");
  const to = u.searchParams.get("to") ?? "/";

  let safeTo = "/";
  try {
    const dest = new URL(to, req.url);
    if (dest.protocol === "http:" || dest.protocol === "https:") safeTo = dest.toString();
  } catch { /* fall through to "/" */ }

  if (lid) {
    const lead = await prisma.leadProfile.findUnique({ where: { id: lid } }).catch(() => null);
    if (lead) {
      await recordTripwire({
        leadId: lead.id, type: "click", source: "link", campaignId: c ?? undefined,
        detail: to, metadata: { ua: req.headers.get("user-agent") ?? undefined },
      });
    }
  }

  return NextResponse.redirect(safeTo, 302);
}

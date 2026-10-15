import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "PENDING_REVIEW";
    const where = status === "ALL" ? {} : { status };

    const campaigns = await prisma.aiContentPipeline.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { business: { select: { businessName: true } } }
    });
    return NextResponse.json({ success: true, campaigns });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, action, suggestedDraft } = body;
    if (!id || !action) return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });

    let status = "PENDING_REVIEW";
    let publishedAt: Date | null = null;
    if (action === "APPROVE") {
      status = "PUBLISHED";
      publishedAt = new Date();
    } else if (action === "DISMISS") {
      status = "DISMISSED";
    }

    const updated = await prisma.aiContentPipeline.update({
      where: { id },
      data: {
        status,
        publishedAt,
        ...(suggestedDraft ? { suggestedDraft } : {})
      }
    });
    return NextResponse.json({ success: true, campaign: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

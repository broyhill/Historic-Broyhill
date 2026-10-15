import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [totalLeads, pendingCount, publishedCount, vipCount] = await Promise.all([
      prisma.leadProfile.count(),
      prisma.aiContentPipeline.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.aiContentPipeline.count({ where: { status: "PUBLISHED" } }),
      prisma.leadProfile.count({
        where: {
          OR: [
            { primaryTrack: { contains: "VIP", mode: "insensitive" } },
            { leadScore: { gte: 80 } }
          ]
        }
      })
    ]);

    const reviewRate = (pendingCount + publishedCount) > 0
      ? Math.round((publishedCount / (pendingCount + publishedCount)) * 100)
      : 0;

    return NextResponse.json({
      success: true,
      metrics: {
        totalLeads,
        pendingReview: pendingCount,
        publishedBroadcasts: publishedCount,
        vipLeads: vipCount,
        reviewRate: `${reviewRate}%`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

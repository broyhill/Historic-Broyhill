import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureJourneyTables } from "@/lib/journeys-db";

// Read-only for now: lists journeys with how many leads are in each. Creating the tables and the
// three paused starter journeys happens on first call. Auth via /api/admin middleware.
export async function GET() {
  try {
    await ensureJourneyTables();
    const journeys = await prisma.journey.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { runs: true } } },
    });
    const running = await prisma.journeyRun.groupBy({ by: ["journeyId"], where: { status: "RUNNING" }, _count: { _all: true } });
    const runningBy = new Map(running.map((r) => [r.journeyId, r._count._all]));
    return NextResponse.json({
      success: true,
      journeys: journeys.map((j) => ({
        id: j.id, name: j.name, trigger: j.trigger, status: j.status, approvalMode: j.approvalMode,
        steps: j.steps, totalRuns: j._count.runs, running: runningBy.get(j.id) ?? 0,
      })),
    });
  } catch (error: any) {
    console.error("list journeys failed", error);
    return NextResponse.json({ error: "Could not load journeys." }, { status: 500 });
  }
}

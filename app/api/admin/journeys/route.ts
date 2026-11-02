import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { ensureJourneyTables } from "@/lib/journeys-db";
import { enrollLead, runDueSteps } from "@/lib/journey-runner";
import { TRIGGERS } from "@/lib/journeys";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Journeys: list, activate/pause, switch review mode, enroll a lead, and run due
// steps by hand (the cron route does it on a schedule). Auth via /api/admin middleware.
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

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, action } = body;

    if (action === "set_status" || action === "set_mode") {
      if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });
      await ensureJourneyTables();
      if (action === "set_status") {
        if (!["ACTIVE", "PAUSED"].includes(body.status)) return NextResponse.json({ error: "status must be ACTIVE or PAUSED." }, { status: 400 });
        await prisma.journey.update({ where: { id }, data: { status: body.status } });
      } else {
        if (!["REVIEW", "AUTO"].includes(body.approvalMode)) return NextResponse.json({ error: "approvalMode must be REVIEW or AUTO." }, { status: 400 });
        await prisma.journey.update({ where: { id }, data: { approvalMode: body.approvalMode } });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "enroll") {
      const email = typeof body.leadEmail === "string" ? body.leadEmail.trim().toLowerCase() : "";
      const trigger = typeof body.trigger === "string" ? body.trigger : "MANUAL";
      if (!email || !(TRIGGERS as readonly string[]).includes(trigger)) {
        return NextResponse.json({ error: "leadEmail and a valid trigger are required." }, { status: 400 });
      }
      await ensureJourneyTables();
      const lead = await prisma.leadProfile.findUnique({ where: { email }, select: { id: true } });
      if (!lead) return NextResponse.json({ error: "No lead with that email on file." }, { status: 404 });
      const enrolled = await enrollLead(lead.id, trigger);
      return NextResponse.json({ success: true, enrolled });
    }

    if (action === "stop_run") {
      if (!body.runId) return NextResponse.json({ error: "runId required." }, { status: 400 });
      await ensureJourneyTables();
      await prisma.journeyRun.updateMany({ where: { id: body.runId, status: "RUNNING" }, data: { status: "STOPPED", stoppedReason: "stopped by staff" } });
      return NextResponse.json({ success: true });
    }

    if (action === "run_now") {
      const counts = await runDueSteps({ resend });
      return NextResponse.json({ success: true, counts });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error: any) {
    console.error("journeys update failed", error);
    return NextResponse.json({ error: "Could not update journeys." }, { status: 500 });
  }
}

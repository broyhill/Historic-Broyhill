import { NextResponse } from "next/server";
import { Resend } from "resend";
import { runDueSteps } from "@/lib/journey-runner";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Scheduled journeys runner (Vercel cron calls this daily; see vercel.json).
// Not under /api/admin, so it checks CRON_SECRET itself: Vercel sends it as a
// Bearer token. When CRON_SECRET is unset the route refuses — fail closed.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const counts = await runDueSteps({ resend });
    return NextResponse.json({ success: true, counts });
  } catch (error: any) {
    console.error("journeys cron failed", error);
    return NextResponse.json({ error: "Runner failed." }, { status: 500 });
  }
}

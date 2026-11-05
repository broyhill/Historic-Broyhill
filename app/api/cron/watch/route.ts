import { NextResponse } from "next/server";
import { runWatchers } from "@/lib/watchers";

// Daily sweep of the wizard's eyes (see vercel.json). Same CRON_SECRET
// fail-closed guard as /api/cron/journeys.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const results = await runWatchers();
    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("watch cron failed", error);
    return NextResponse.json({ error: "Watchers failed." }, { status: 500 });
  }
}

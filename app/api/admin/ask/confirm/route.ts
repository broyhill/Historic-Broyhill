import { NextResponse } from "next/server";
import { executeGated } from "@/lib/assistant";

// Runs one change the assistant proposed, only after the user clicked Confirm.
// executeGated allow-lists the tools and validates the input; auth via /api/admin middleware.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const tool = typeof body.tool === "string" ? body.tool : "";
    const input = body.input && typeof body.input === "object" ? (body.input as Record<string, unknown>) : {};
    const message = await executeGated(tool, input);
    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Could not do that." }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { claudeEnabled, NOT_CONFIGURED, aiErrorMessage } from "@/lib/ai";
import { runAssistant } from "@/lib/assistant";

// Several model + database round trips can happen in one request.
export const maxDuration = 60;

const MAX_QUESTION_CHARS = 2000;
const MAX_HISTORY_MESSAGES = 12;

// Staff assistant. Stateless: the client sends the recent conversation each time.
// It can look things up and stage drafts; changes wait for /api/admin/ask/confirm.
// Auth via /api/admin middleware.
export async function POST(request: Request) {
  try {
    if (!claudeEnabled()) {
      return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const raw: unknown[] = Array.isArray(body.messages) ? body.messages : [];

    const messages = raw
      .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .map((m: any) => ({ role: m.role as "user" | "assistant", content: String(m.content).slice(0, MAX_QUESTION_CHARS) }))
      .slice(-MAX_HISTORY_MESSAGES);

    // The API requires the conversation to start with, and end on, a user turn.
    while (messages.length && messages[0].role !== "user") messages.shift();
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
    }

    const result = await runAssistant(messages);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("ask failed", error);
    return NextResponse.json({ error: aiErrorMessage(error) }, { status: 500 });
  }
}

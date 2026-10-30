import { NextResponse } from "next/server";
import { brandContext } from "@/lib/brand-context";
import { z } from "zod";
import { claudeEnabled, claudeJson } from "@/lib/ai";
import { VENUE_FACTS, WRITING_RULES } from "@/lib/platform-briefing";
import { smsChecks, smsInfo } from "@/lib/sms-rules";

export const maxDuration = 60;

const OPT_OUT = "Reply STOP to opt out.";
const clip = (v: unknown, n = 1000) => (typeof v === "string" ? v.trim().slice(0, n) : "");

// Suggests text-message drafts. Nothing is saved or sent; the page shows the options and the user clicks Use.
// Auth via /api/admin middleware.
export async function POST(request: Request) {
  const BRAND = await brandContext();
  try {
    if (!claudeEnabled()) {
      return NextResponse.json({ error: "Claude is not configured (ANTHROPIC_API_KEY is not set)." }, { status: 503 });
    }
    const b = await request.json().catch(() => ({}));
    const channel: "sms" | "mms" = b.channel === "mms" ? "mms" : "sms";
    const goal = clip(b.goal);
    if (!goal) return NextResponse.json({ error: "Say what the text is for." }, { status: 400 });
    const link = clip(b.link, 300);
    const include = clip(b.include);
    if (link && !/^https:\/\//i.test(link)) return NextResponse.json({ error: "The link must start with https://" }, { status: 400 });

    const limit = channel === "sms" ? "Aim for 160 characters or fewer including the opt-out line (never more than 300). Use plain characters only: no emoji, curly quotes or dashes beyond a simple hyphen." : "Up to 600 characters.";
    const out = await claudeJson({
      system: `${BRAND}
You write marketing text messages for Historic Broyhill. Venue facts you may use (and no others):\n${VENUE_FACTS}\n\n${WRITING_RULES}\nEvery message must: say it is from Historic Broyhill, be one short idea with one clear next step, include {{firstName}} at most once, include the link exactly as given at most once (never invent or shorten a link), and end with "${OPT_OUT}". ${limit} Give 3 genuinely different options.`,
      user: `Goal: ${goal}\nLink: ${link || "(none)"}\nInclude or avoid: ${include || "(none)"}`,
      schema: z.object({ options: z.array(z.object({ body: z.string() })).min(1).max(3) }),
      maxTokens: 1500,
    });
    if (!out?.options.length) return NextResponse.json({ error: "Claude could not write a text. Try again with more detail." }, { status: 422 });

    // Safety net: make sure the opt-out line is there, then run the same rule checks the Templates page shows.
    const options = out.options.map((o) => {
      let body = o.body.trim();
      if (!/\bstop\b/i.test(body)) body = `${body} ${OPT_OUT}`;
      const info = smsInfo(body);
      const issues = smsChecks(body, channel).filter((c) => !c.ok).map((c) => c.label);
      return { body, length: info.length, segments: info.segments, issues };
    });
    return NextResponse.json({ success: true, options });
  } catch (error: any) {
    console.error("text draft failed", error);
    return NextResponse.json({ error: "Something went wrong reaching Claude. Try again in a moment." }, { status: 500 });
  }
}

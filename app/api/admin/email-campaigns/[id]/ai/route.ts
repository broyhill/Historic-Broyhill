import { NextResponse } from "next/server";
import { brandContext } from "@/lib/brand-context";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { devinEnabled, devinJson } from "@/lib/devin";
import { ensureCampaignTable } from "@/lib/campaigns-db";
import { MAX_PREVIEW_CHARS, MAX_SUBJECT_CHARS, MAX_SUBJECT_WORDS } from "@/lib/campaign-rules";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

const FACTS = `You write email for Historic Broyhill, a 1920s school building in Clemmons, NC (3540 Clemmons Road) converted to offices and event space around 2006. Event spaces: Magnolia Room, The Boardrooms, The Dock, The Loft. These are the only verified venue details.
Do not state or imply capacities, room sizes, amenities, pricing, dates, availability or any venue detail not listed. If unsure, say the team will follow up with specifics.
Never use bracket placeholders like [Name]. Do not invent staff names, titles or contact details. Do not mention internal CRM data, scores or tracks.
Plain text only: short paragraphs, no markdown, no HTML. Do not add a signature block, address or unsubscribe line; the platform adds the legal footer.`;

const SUBJECT_RULES = `Subject lines: at most ${MAX_SUBJECT_WORDS} words and ${MAX_SUBJECT_CHARS} characters, at most 3 ! or ? marks, at most 1 emoji, never all caps. Preview text: at most ${MAX_PREVIEW_CHARS} characters, and it should add to the subject, not repeat it.`;

// Everything here is a suggestion. Nothing is saved until the user clicks Use on the page.
export async function POST(request: Request, { params }: Ctx) {
  const BRAND = await brandContext();
  try {
    if (!devinEnabled()) {
      return NextResponse.json({ error: "Devin is not configured (CURSOR_API_KEY is not set)." }, { status: 503 });
    }
    await ensureCampaignTable();
    const { id } = await params;
    const c = await prisma.emailCampaign.findUnique({ where: { id } });
    if (!c) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

    const b = await request.json().catch(() => ({}));
    const clip = (v: unknown, n = 1000) => (typeof v === "string" ? v.trim().slice(0, n) : "");

    if (b.action === "subjects") {
      const basis = c.body.trim() || clip(b.goal);
      if (!basis) return NextResponse.json({ error: "Write the email body first (or give a goal), then ask for subject lines." }, { status: 400 });
      const out = await devinJson({
        system: `${FACTS}
${BRAND}\n${SUBJECT_RULES}\nGive 5 different subject lines with matching preview text for this email.`,
        user: `Campaign name: ${c.name}\nCurrent subject: ${c.subject || "(none)"}\nEmail:\n${basis.slice(0, 6000)}`,
        schema: z.object({ options: z.array(z.object({ subject: z.string(), previewText: z.string() })).min(1).max(5) }),
      });
      if (!out) return NextResponse.json({ error: "Devin could not suggest subject lines. Try again." }, { status: 422 });
      return NextResponse.json({ success: true, options: out.options });
    }

    if (b.action === "draft") {
      const goal = clip(b.goal);
      if (!goal) return NextResponse.json({ error: "Say what this campaign is for." }, { status: 400 });
      const brief = { goal, callToAction: clip(b.callToAction, 200), callToActionLink: clip(b.callToActionLink, 300), include: clip(b.include) };
      const out = await devinJson({
        system: `${FACTS}
${BRAND}\n${SUBJECT_RULES}\nWrite a complete email: subject, preview text and a 2-4 short paragraph body. Warm and specific, not salesy. If a call-to-action link is given, include it once on its own line, exactly as written.`,
        user: `Campaign name: ${c.name}\nGoal: ${brief.goal}\nCall to action: ${brief.callToAction || "(none)"}\nCall-to-action link: ${brief.callToActionLink || "(none)"}\nInclude or avoid: ${brief.include || "(none)"}`,
        schema: z.object({ subject: z.string(), previewText: z.string(), body: z.string() }),
        maxTokens: 2500,
      });
      if (!out?.body.trim()) return NextResponse.json({ error: "Devin could not write a draft. Try again with more detail." }, { status: 422 });
      await prisma.emailCampaign.update({ where: { id }, data: { aiBrief: brief } });
      return NextResponse.json({ success: true, draft: out });
    }

    if (b.action === "rewrite") {
      const instruction = clip(b.instruction, 500);
      if (!instruction || !c.body.trim()) return NextResponse.json({ error: "Write some body text and say how to change it." }, { status: 400 });
      const out = await devinJson({
        system: `${FACTS}
${BRAND}\nRewrite the email body following the instruction. Keep any links exactly as written. Return only the new body.`,
        user: `Instruction: ${instruction}\n\nCurrent body:\n${c.body.slice(0, 8000)}`,
        schema: z.object({ body: z.string() }),
        maxTokens: 2500,
      });
      if (!out?.body.trim()) return NextResponse.json({ error: "Devin could not rewrite that. Try again." }, { status: 422 });
      return NextResponse.json({ success: true, body: out.body });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error: any) {
    console.error("campaign ai failed", error);
    return NextResponse.json({ error: "Something went wrong reaching Claude. Try again in a moment." }, { status: 500 });
  }
}

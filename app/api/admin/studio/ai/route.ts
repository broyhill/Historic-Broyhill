import { NextResponse } from "next/server";
import { z } from "zod";
import { claudeEnabled, claudeJson } from "@/lib/ai";
import { MAX_PREVIEW_CHARS, MAX_SUBJECT_CHARS, MAX_SUBJECT_WORDS } from "@/lib/campaign-rules";
import { allowedFrom, normalizeDesign, renderPlainText, sanitizeAlternative, type RawAlt } from "@/lib/studio";

const ALT_SCHEMA = z.object({
  alternatives: z.array(z.object({
    name: z.string(),
    accent: z.string(),
    background: z.string(),
    font: z.enum(["serif", "sans"]),
    blocks: z.array(z.object({
      type: z.enum(["heading", "text", "image", "button", "divider", "spacer"]),
      text: z.string(), label: z.string(), link: z.string(), url: z.string(), alt: z.string(),
      align: z.enum(["left", "center", "right"]), height: z.number(),
    })).max(20),
  })).min(1).max(3),
});

export const maxDuration = 60;

const FACTS = `You write email for Historic Broyhill, a 1920s school building in Clemmons, NC (3540 Clemmons Road) converted to offices and event space around 2006. Event spaces: Magnolia Room, The Boardrooms, The Dock, The Loft. These are the only verified venue details.
Do not state or imply capacities, room sizes, amenities, pricing, dates, availability or any venue detail not listed. If unsure, say the team will follow up with specifics.
Never use bracket placeholders like [Name]; {{firstName}} is the only allowed merge tag. Do not invent staff names, titles or contact details.
Plain text only: short paragraphs, no markdown, no HTML. Do not add a signature, address or unsubscribe line; the platform adds the legal footer.`;

const clip = (v: unknown, n = 1500) => (typeof v === "string" ? v.trim().slice(0, n) : "");

// Suggestions only: nothing is changed until the person clicks Use in the Studio.
export async function POST(request: Request) {
  try {
    if (!claudeEnabled()) return NextResponse.json({ error: "Claude is not configured (ANTHROPIC_API_KEY is not set)." }, { status: 503 });
    const b = await request.json().catch(() => ({}));
    const context = renderPlainText(normalizeDesign(b.studio)).slice(0, 6000);

    if (b.action === "rewrite") {
      const text = clip(b.text, 3000);
      const how = clip(b.instruction, 300) || "Make it warmer and clearer.";
      if (!text) return NextResponse.json({ error: "Write something in the block first." }, { status: 400 });
      const out = await claudeJson({
        system: `${FACTS}\nRewrite the given block text as asked. Keep the same facts; add none. Return 3 different versions.`,
        user: `Instruction: ${how}\nBlock type: ${b.blockType === "heading" ? "heading (short, under 8 words)" : "body text"}\nText:\n${text}\n\nRest of the email, for context:\n${context}`,
        schema: z.object({ options: z.array(z.string()).min(1).max(3) }),
      });
      if (!out) return NextResponse.json({ error: "Claude could not rewrite that. Try again." }, { status: 422 });
      return NextResponse.json({ success: true, options: out.options });
    }

    if (b.action === "draft") {
      const goal = clip(b.goal, 800);
      if (!goal) return NextResponse.json({ error: "Say what this email is for." }, { status: 400 });
      const out = await claudeJson({
        system: `${FACTS}\nDraft an email as blocks: one heading, 2-3 short text paragraphs, and a short button label. Warm and specific, not salesy.`,
        user: `Goal: ${goal}`,
        schema: z.object({ heading: z.string(), paragraphs: z.array(z.string()).min(1).max(4), buttonLabel: z.string() }),
      });
      if (!out) return NextResponse.json({ error: "Claude could not draft that. Try again." }, { status: 422 });
      return NextResponse.json({ success: true, draft: out });
    }

    if (b.action === "redesign") {
      const current = normalizeDesign(b.studio);
      if (!current.blocks.length) return NextResponse.json({ error: "Build or draft the email first, then ask for a redesign." }, { status: 400 });
      const library: { url: string; name: string }[] = (Array.isArray(b.photos) ? b.photos : [])
        .filter((p: any) => p && typeof p.url === "string" && typeof p.name === "string").slice(0, 40)
        .map((p: any) => ({ url: p.url as string, name: String(p.name).slice(0, 80) }));
      const allowed = allowedFrom(current, library.map((p) => p.url));
      const direction = clip(b.direction, 300) || "A clearly more designed, more polished version.";
      const out = await claudeJson({
        system: `${FACTS}
You are a senior email designer. Redesign the given email into 3 clearly different alternatives (for example: elegant and airy; bold and photo-led; warm and simple). Use only these block types: heading, text, image, button, divider, spacer. Colors are 6-digit hex like #8a5a2b; background is the page color around the email.
Strict rules: keep every fact the original states and add none. You may tighten or reorder the wording, but do not invent offers, dates, prices or details. Reuse the original button links exactly as written; never invent a link. Use images only from the photo list, by exact url, with a short plain description; skip images if none fit. For blocks where a field doesn't apply, use an empty string (0 for height). Aim for a strong visual rhythm: a clear opening, short paragraphs, one clear call to action.`,
        user: `Direction: ${direction}\n\nCurrent email (as plain text):\n${renderPlainText(current).slice(0, 5000)}\n\nCurrent colors: button ${current.brand.accent}, page ${current.brand.background}, font ${current.brand.font}\n\nButton links available (use exactly): ${[...allowed.links].join(", ") || "none"}\n\nPhotos available:\n${library.map((p) => `${p.name}: ${p.url}`).join("\n") || "none"}${b.like ? `\n\nThe person liked this one, so make 3 variations in that spirit: ${clip(b.like, 100)}` : ""}`,
        schema: ALT_SCHEMA,
        maxTokens: 6000,
      });
      if (!out) return NextResponse.json({ error: "Claude could not redesign that. Try again." }, { status: 422 });
      const alternatives = out.alternatives
        .map((a) => sanitizeAlternative(a as RawAlt, allowed))
        .filter((a) => a.design.blocks.length > 0);
      if (!alternatives.length) return NextResponse.json({ error: "Claude's ideas didn't come out usable. Try again." }, { status: 422 });
      return NextResponse.json({ success: true, alternatives });
    }

    if (b.action === "review") {
      const out = await claudeJson({
        system: `${FACTS}\nYou review a finished email for a venue manager. Give up to 5 short, concrete suggestions (clarity, tone, a missing call to action, claims that need checking). Also give 3 subject lines (at most ${MAX_SUBJECT_WORDS} words and ${MAX_SUBJECT_CHARS} characters each) with preview text of at most ${MAX_PREVIEW_CHARS} characters.`,
        user: `Email:\n${context}`,
        schema: z.object({ suggestions: z.array(z.string()).max(5), subjects: z.array(z.object({ subject: z.string(), previewText: z.string() })).max(3) }),
      });
      if (!out) return NextResponse.json({ error: "Claude could not review that. Try again." }, { status: 422 });
      return NextResponse.json({ success: true, ...out });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error: any) {
    console.error("studio ai failed", error);
    return NextResponse.json({ error: "Claude had a problem. Try again." }, { status: 500 });
  }
}

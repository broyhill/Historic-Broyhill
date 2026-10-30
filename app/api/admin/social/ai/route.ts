import { NextResponse } from "next/server";
import { brandContext } from "@/lib/brand-context";
import { z } from "zod";
import { claudeEnabled, claudeJson } from "@/lib/ai";
import { PLATFORMS, cleanTags, isPlatform, type Platform } from "@/lib/social";

const STYLE: Partial<Record<Platform, string>> = {
  youtube: "This is for a YouTube video. The first line is the video title (under 70 characters), then a blank line, then the description. Do not claim anything about what the video shows beyond what the request says.",
  tiktok: "This is a TikTok video caption: a short hook in the first line, then at most one more short line. Do not claim anything about what the video shows beyond what the request says.",
  x: "This is for X: it must fit in 280 characters including hashtags. Punchy, one idea.",
  linkedin: "This is for LinkedIn: professional and community-minded, written for local business owners, planners and organizations.",
};

export const maxDuration = 60;

const FACTS = `You write social media posts for Historic Broyhill, a 1920s school building in Clemmons, NC (3540 Clemmons Road) converted to offices and event space around 2006. Event spaces: Magnolia Room (the stage theater, a former school auditorium), The Boardrooms, The Dock (patio), The Loft. These are the only verified venue details.
Do not state or imply capacities, room sizes, amenities, pricing, dates, availability, awards or any venue detail not listed above or given in the request. If unsure, leave it out.
Never use bracket placeholders like [Name]. Do not invent staff names, quotes, reviews or contact details. Plain text only: no markdown, no HTML.`;

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

// Suggestions only: the person picks one and edits it. Nothing is posted.
export async function POST(request: Request) {
  const BRAND = await brandContext();
  try {
    if (!claudeEnabled()) return NextResponse.json({ error: "Claude is not configured (ANTHROPIC_API_KEY is not set)." }, { status: 503 });
    const b = await request.json().catch(() => ({}));
    if (!isPlatform(b.platform)) return NextResponse.json({ error: "Pick a platform." }, { status: 400 });
    const platform: Platform = b.platform;
    const p = PLATFORMS[platform];
    const goal = clip(b.goal, 800);

    if (b.action === "write") {
      if (!goal) return NextResponse.json({ error: "Say what the post is about." }, { status: 400 });
      const out = await claudeJson({
        system: `${FACTS}
${BRAND}\nWrite 3 different ${p.label} post options (different angles, not rewordings). Aim for about ${p.goodChars} characters or fewer. ${p.maxTags ? `Give at most ${p.goodTags} relevant hashtags per option, without the # sign, in the hashtags list (not inside the caption).` : "Do not use hashtags; return an empty hashtags list."} ${p.linksClickable ? "" : "Do not put a web link in the caption; say \"link in bio\" or \"call us\" only if the request gives that."} Warm, specific, local. Tone: ${clip(b.tone, 60) || "warm and welcoming"}. ${STYLE[platform] ?? ""}`,
        user: `What the post is about: ${goal}\nPicture: ${clip(b.photoNote, 200) || "none chosen"}`,
        schema: z.object({ options: z.array(z.object({ caption: z.string(), hashtags: z.array(z.string()) })).min(1).max(3) }),
        maxTokens: 3000,
      });
      if (!out) return NextResponse.json({ error: "Claude could not write that. Try again." }, { status: 422 });
      return NextResponse.json({ success: true, options: out.options.map((o) => ({ caption: o.caption.trim(), hashtags: cleanTags(o.hashtags).slice(0, p.goodTags) })) });
    }

    if (b.action === "rewrite") {
      const caption = clip(b.caption, 3000);
      if (!caption) return NextResponse.json({ error: "Write something first." }, { status: 400 });
      const out = await claudeJson({
        system: `${FACTS}
${BRAND}\nRewrite this ${p.label} post as asked. Keep the same facts and add none. Return 3 versions, about ${p.goodChars} characters or fewer. Put hashtags only in the hashtags list.`,
        user: `Instruction: ${clip(b.instruction, 200) || "Make it warmer and clearer."}\nPost:\n${caption}`,
        schema: z.object({ options: z.array(z.object({ caption: z.string(), hashtags: z.array(z.string()) })).min(1).max(3) }),
        maxTokens: 3000,
      });
      if (!out) return NextResponse.json({ error: "Claude could not rewrite that. Try again." }, { status: 422 });
      return NextResponse.json({ success: true, options: out.options.map((o) => ({ caption: o.caption.trim(), hashtags: cleanTags(o.hashtags).slice(0, p.goodTags) })) });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error: any) {
    console.error("social ai failed", error);
    return NextResponse.json({ error: "Claude had a problem. Try again." }, { status: 500 });
  }
}

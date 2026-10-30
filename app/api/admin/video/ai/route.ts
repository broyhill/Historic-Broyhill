import { NextResponse } from "next/server";
import { brandContext } from "@/lib/brand-context";
import { z } from "zod";
import { claudeEnabled, claudeJson } from "@/lib/ai";
import { MAX_CAPTION, MAX_SCENES, normalizeStoryboard, withShortSceneIds } from "@/lib/video";

export const maxDuration = 60;

const FACTS = `You help make short videos for Historic Broyhill, a 1920s school building in Clemmons, NC (3540 Clemmons Road) converted to offices and event space around 2006. Event spaces: Magnolia Room (the stage theater, a former school auditorium), The Boardrooms, The Dock (patio), The Loft. These are the only verified venue details.
Captions are short (at most ${MAX_CAPTION} characters). Do not state or imply capacities, room sizes, amenities, pricing, dates, availability, awards or any venue detail not listed above or in the request. Never use bracket placeholders. Do not invent quotes, names, reviews or contact details. Plain text only.`;

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const photos = (v: unknown): { url: string; name: string }[] =>
  (Array.isArray(v) ? v : []).filter((p: any) => p && typeof p.url === "string" && typeof p.name === "string").slice(0, 60).map((p: any) => ({ url: p.url as string, name: String(p.name).slice(0, 80) }));

// Suggestions only: the page checks every edit and the person can undo it. Nothing is rendered or posted here.
export async function POST(request: Request) {
  const BRAND = await brandContext();
  try {
    if (!claudeEnabled()) return NextResponse.json({ error: "Claude is not configured (ANTHROPIC_API_KEY is not set)." }, { status: 503 });
    const b = await request.json().catch(() => ({}));
    const lib = photos(b.photos);
    const listing = lib.map((p) => `${p.name}: ${p.url}`).join("\n") || "none";

    if (b.action === "draft") {
      const goal = clip(b.goal, 600);
      if (!goal) return NextResponse.json({ error: "Say what the video is for." }, { status: 400 });
      if (!lib.length) return NextResponse.json({ error: "Your Photo Library has no pictures yet, so there is nothing to build from." }, { status: 400 });
      const out = await claudeJson({
        system: `${FACTS}
${BRAND}\nPlan a short storyboard (4 to 8 scenes, about 25 to 40 seconds in total) using ONLY pictures from the list, by exact url, each at most once. Each scene: the picture url, a short plain description of what the picture shows (alt), seconds (3 to 6), an optional caption (empty string if none), and a camera move (push, pull or none). Open strong, keep the order logical, end with the address line only if asked.`,
        user: `Goal: ${goal}\n\nPictures available (name: url):\n${listing}`,
        schema: z.object({ scenes: z.array(z.object({ url: z.string(), alt: z.string(), seconds: z.number(), caption: z.string(), motion: z.enum(["push", "pull", "none"]) })).min(1).max(MAX_SCENES) }),
        maxTokens: 3000,
      });
      if (!out) return NextResponse.json({ error: "Claude could not plan that. Try again." }, { status: 422 });
      return NextResponse.json({ success: true, scenes: out.scenes });
    }

    if (b.action === "command") {
      const instruction = clip(b.instruction, 500);
      if (!instruction) return NextResponse.json({ error: "Type what you'd like changed." }, { status: 400 });
      const sb = normalizeStoryboard(b.storyboard);
      if (!sb.scenes.length) return NextResponse.json({ error: "Add a picture or ask for a draft first." }, { status: 400 });
      const short = withShortSceneIds(sb);
      const listingScenes = sb.scenes.map((s) => `${short.toShort.get(s.id)}: ${s.seconds}s, caption "${s.caption}", move ${s.motion}, caption at ${s.captionPos}, picture ${s.alt || s.url}${s.kind === "endcard" ? " (end card)" : ""}`).join("\n");
      const out = await claudeJson({
        system: `${FACTS}
${BRAND}
You are the editing assistant in a video builder. Answer a plain-words command with the smallest set of edits (at most 8) and one short friendly sentence. Refer to scenes only by short id (s1, s2…). Allowed edits (op): set_caption (sceneId, caption), set_seconds (sceneId, seconds 1.5-12), set_motion (sceneId, motion push|pull|none), set_caption_position (sceneId, captionPos lower|center), set_picture (sceneId, url, alt), add_scene (url, alt, caption, seconds; afterId = a scene id, START, or empty for the end), remove_scene (sceneId), move_scene (sceneId, afterId as above), set_music (volume 0-1 and/or fadeOutSeconds 0-8; only if music exists).
Rules: keep the facts; never invent details. Use a picture only by exact url from the list. Fill unused fields with an empty string (0 for numbers).`,
        user: `Command: ${instruction}\n\nThe video now:\n${listingScenes}\nMusic: ${sb.music ? `${sb.music.name}, volume ${sb.music.volume}, fade out ${sb.music.fadeOutSeconds}s` : "none"}\n\nPictures available (name: url):\n${listing}`,
        schema: z.object({
          reply: z.string(),
          ops: z.array(z.object({
            op: z.enum(["set_caption", "set_seconds", "set_motion", "set_caption_position", "set_picture", "add_scene", "remove_scene", "move_scene", "set_music"]),
            sceneId: z.string(), afterId: z.string(), url: z.string(), alt: z.string(), caption: z.string(), captionPos: z.string(), motion: z.string(),
            seconds: z.number(), volume: z.number(), fadeOutSeconds: z.number(),
          })).max(8),
        }),
        maxTokens: 3000,
      });
      if (!out) return NextResponse.json({ error: "Claude could not do that. Try rephrasing." }, { status: 422 });
      const ops = out.ops.map((o) => ({ ...o, sceneId: short.toReal.get(o.sceneId) ?? "", afterId: o.afterId === "START" ? "START" : short.toReal.get(o.afterId) ?? "" }));
      return NextResponse.json({ success: true, reply: out.reply.trim().slice(0, 400), ops });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error: any) {
    console.error("video ai failed", error);
    return NextResponse.json({ error: "Claude had a problem. Try again." }, { status: 500 });
  }
}

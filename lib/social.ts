// Social post drafts: platform limits and plain checks. Pure functions (no network, no database).
// Nothing here posts anywhere; drafts are written, checked and copied by a person.

export type Platform = "linkedin" | "facebook" | "instagram" | "youtube" | "x" | "tiktok";

// Limits are the commonly published ones and can change; they only drive friendly warnings.
// youtube/tiktok are video platforms: the draft is the title/caption, and the video is added when posting.
export const PLATFORMS: Record<Platform, { label: string; maxChars: number; goodChars: number; maxTags: number; goodTags: number; linksClickable: boolean; ratio: string; video: boolean }> = {
  linkedin: { label: "LinkedIn", maxChars: 3000, goodChars: 600, maxTags: 30, goodTags: 3, linksClickable: true, ratio: "1.91 / 1", video: false },
  facebook: { label: "Facebook", maxChars: 63206, goodChars: 400, maxTags: 30, goodTags: 3, linksClickable: true, ratio: "1.91 / 1", video: false },
  instagram: { label: "Instagram", maxChars: 2200, goodChars: 300, maxTags: 30, goodTags: 8, linksClickable: false, ratio: "1 / 1", video: false },
  youtube: { label: "YouTube", maxChars: 5000, goodChars: 500, maxTags: 15, goodTags: 3, linksClickable: true, ratio: "16 / 9", video: true },
  x: { label: "X", maxChars: 280, goodChars: 240, maxTags: 5, goodTags: 2, linksClickable: true, ratio: "16 / 9", video: false },
  tiktok: { label: "TikTok", maxChars: 2200, goodChars: 150, maxTags: 30, goodTags: 5, linksClickable: false, ratio: "9 / 16", video: true },
};

export const isPlatform = (v: unknown): v is Platform => typeof v === "string" && v in PLATFORMS;

export const cleanTag = (t: string) => t.replace(/^#+/, "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 40);
export function cleanTags(tags: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of Array.isArray(tags) ? tags : []) {
    const c = typeof t === "string" ? cleanTag(t) : "";
    if (c && !seen.has(c.toLowerCase())) { seen.add(c.toLowerCase()); out.push(c); }
  }
  return out.slice(0, 30);
}

// The text as it would be posted: the caption, then the hashtags on their own line.
export const composePost = (caption: string, tags: string[]) =>
  [caption.trim(), tags.length ? tags.map((t) => `#${t}`).join(" ") : ""].filter(Boolean).join("\n\n");

const EMOJI = /\p{Extended_Pictographic}/gu;

export interface SocialCheck { ok: boolean; message: string }
export function socialChecks(platform: Platform, caption: string, tags: string[], opts: { hasImage: boolean; imageAlt: string }): SocialCheck[] {
  const p = PLATFORMS[platform];
  const text = composePost(caption, tags);
  const out: SocialCheck[] = [];
  out.push({ ok: text.trim().length > 0, message: "Write the post." });
  out.push({ ok: text.length <= p.maxChars, message: `${p.label} allows up to ${p.maxChars.toLocaleString()} characters (this is ${text.length.toLocaleString()}).` });
  if (text.length > p.goodChars) out.push({ ok: false, message: `Shorter posts tend to be read more: aim for about ${p.goodChars} characters (this is ${text.length}).` });
  out.push({ ok: tags.length <= p.maxTags, message: p.maxTags ? `${p.label} allows up to ${p.maxTags} hashtags.` : `${p.label} doesn't use hashtags.` });
  if (tags.length > p.goodTags && p.maxTags) out.push({ ok: false, message: `Keep hashtags to about ${p.goodTags} or fewer.` });
  if (!p.linksClickable && /https?:\/\//i.test(caption)) out.push({ ok: false, message: `Links in a ${p.label} caption aren't clickable. Say "link in bio" or use the button instead.` });
  const letters = caption.replace(/[^A-Za-z]/g, "");
  if (letters.length > 12 && letters === letters.toUpperCase()) out.push({ ok: false, message: "Avoid writing the whole post in capitals." });
  if ((caption.match(EMOJI) || []).length > 4) out.push({ ok: false, message: "More than a few emoji can look spammy." });
  if (/\{\{|\[[A-Za-z ]+\]/.test(caption)) out.push({ ok: false, message: "There is a placeholder like [Name] or {{tag}} left in the text." });
  if (opts.hasImage) out.push({ ok: opts.imageAlt.trim().length > 0, message: "Describe the picture in a few words for people who can't see it." });
  else if (platform === "instagram") out.push({ ok: false, message: "Instagram posts need a picture." });
  if (p.video) out.push({ ok: true, message: `${p.label} is a video platform: add your video when you post.` });
  return out;
}

export const isClean = (checks: SocialCheck[]) => checks.every((c) => c.ok);

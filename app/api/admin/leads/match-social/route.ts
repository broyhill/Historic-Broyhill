import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aiErrorMessage, anthropicEnabled, CLAUDE_MODEL, getClient, NOT_CONFIGURED } from "@/lib/ai";

// Lead → social ID matcher. For each lead missing a LinkedIn, Claude searches the
// open web (web_search tool) for "Firstname Lastname company linkedin" and hands back
// URLs. Matches are written to linkedinId / customFields socials and stamped
// socialMatchedAt + verified:false — staff confirm on the profile before trusting one.
// POST { limit?: number (<=20, default 10) } → { matched, checked, remaining, results[] }.
// Auth via /api/admin middleware.

const SOCIAL_DOMAINS: { key: string; re: RegExp }[] = [
  { key: "facebookUrl", re: /https?:\/\/(?:[\w-]+\.)?facebook\.com\/(?!sharer|login|plugins)[\w.-]+\/?/i },
  { key: "instagramUrl", re: /https?:\/\/(?:[\w-]+\.)?instagram\.com\/(?!p\/|reel\/)[\w.-]+\/?/i },
  { key: "twitterUrl", re: /https?:\/\/(?:[\w-]+\.)?(?:twitter|x)\.com\/[\w.-]+\/?/i },
];
const LINKEDIN_RE = /https?:\/\/(?:[\w-]+\.)?linkedin\.com\/in\/[\w%._-]+\/?/i;

async function matchOne(lead: { id: string; firstName: string | null; lastName: string | null; name: string | null; company: string | null; city: string | null; state: string | null }) {
  const who = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || lead.name || "";
  if (!who) return { id: lead.id, ok: false, note: "no name" };
  const where = [lead.company, lead.city, lead.state].filter(Boolean).join(", ");
  const res = await getClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 2 } as any],
    system: "You find a specific person's public social profiles on the open web. Search once or twice, then answer. Reply with ONLY a compact JSON object: {\"linkedin\": \"<url or empty>\", \"facebook\": \"\", \"instagram\": \"\", \"twitter\": \"\", \"confidence\": \"high|medium|low\", \"note\": \"one short line\"}. Only URLs you actually found in search results — never guess or construct a URL. Leave a field empty when not found.",
    messages: [{ role: "user", content: `Person: ${who}${where ? `\nContext: ${where}` : ""}\nFind their personal social profile links, especially LinkedIn (linkedin.com/in/...).` }],
  });
  const text = res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(" ");
  let parsed: any = {};
  try { parsed = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { parsed = {}; }
  const urls: Record<string, string> = { linkedin: String(parsed.linkedin || ""), facebookUrl: String(parsed.facebook || ""), instagramUrl: String(parsed.instagram || ""), twitterUrl: String(parsed.twitter || "") };
  const linkedin = urls.linkedin.match(LINKEDIN_RE)?.[0];
  const socials: Record<string, string> = {};
  for (const { key, re } of SOCIAL_DOMAINS) { const m = urls[key]?.match(re)?.[0]; if (m) socials[key] = m; }
  if (!linkedin && !Object.keys(socials).length) {
    return { id: lead.id, ok: false, note: String(parsed.note || "no public profile found").slice(0, 120) };
  }
  const existing = await prisma.leadProfile.findUnique({ where: { id: lead.id }, select: { customFields: true } });
  const cf = (existing?.customFields && typeof existing.customFields === "object" && !Array.isArray(existing.customFields) ? existing.customFields : {}) as Record<string, unknown>;
  await prisma.leadProfile.update({
    where: { id: lead.id },
    data: {
      linkedinId: linkedin || undefined,
      customFields: { ...cf, ...socials, socialMatchedAt: new Date().toISOString(), socialVerified: false, socialMatchNote: String(parsed.note || "").slice(0, 200) } as any,
    },
  });
  return { id: lead.id, ok: true, linkedin: linkedin || null, socials: Object.keys(socials).length, confidence: parsed.confidence || "low" };
}

export async function POST(request: Request) {
  if (!anthropicEnabled()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 500 });
  let body: any; try { body = await request.json(); } catch { body = null; }
  const limit = Math.min(20, Math.max(1, Number(body?.limit) || 10));
  try {
    const leads = await prisma.leadProfile.findMany({
      where: { linkedinId: null, leadStatus: { not: "DELETED" } },
      orderBy: { leadScore: "desc" },
      take: limit,
      select: { id: true, firstName: true, lastName: true, name: true, company: true, city: true, state: true },
    });
    const remaining = await prisma.leadProfile.count({ where: { linkedinId: null, leadStatus: { not: "DELETED" } } }) - leads.length;
    const results = [];
    for (const l of leads) {
      try { results.push(await matchOne(l)); }
      catch (e: any) { results.push({ id: l.id, ok: false, note: String(e?.message || "search failed").slice(0, 120) }); }
    }
    return NextResponse.json({ success: true, checked: leads.length, matched: results.filter((r) => r.ok).length, remaining, results });
  } catch (e: any) {
    console.error("social match failed", e);
    return NextResponse.json({ error: aiErrorMessage(e) }, { status: 500 });
  }
}

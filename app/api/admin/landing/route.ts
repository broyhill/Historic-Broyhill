import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import catalogJson from "@/data/landing-templates/index.json";
import { prisma } from "@/lib/prisma";
import { brandContext } from "@/lib/brand-context";
import { aiErrorMessage, anthropicEnabled, CLAUDE_MODEL, getClient, groqChat, groqEnabled, NOT_CONFIGURED } from "@/lib/ai";

// AI landing-page composer. The pick-list is data/landing-templates/index.json
// (1,342 Base44/XSellNet templates, audience-tagged for venue use). Compose
// takes a template as the *shape reference* — the live source URL gives the
// model its structure — and drafts a venue landing page on the brand kit.
// Drafts save to the Review Queue as AiContentPipeline channel LANDING_PAGE.
// Auth via /api/admin middleware.

type Template = { slug: string; title: string; source: string; categories: string[]; audience: string };

// Bundled via import (not fs.readFile) — Vercel serverless functions ship the
// compiled bundle, not repo files, so a runtime readFile would find nothing.
let catalog: Template[] | null = null;
async function loadCatalog(): Promise<Template[]> {
  if (!catalog) catalog = catalogJson as Template[];
  return catalog;
}

// The catalog's `source` is the base44.com marketing listing; the actual
// template renders at https://<slug>.base44.app — that is what "Source" links
// and the compose gist should use.
const previewUrl = (slug: string) => `https://${slug}.base44.app/?hide_badge=true`;

// Best-effort: pull the live template's title/headings so the model composes
// against the real structure, not just a slug. Times out quietly — catalog-only
// composition still works.
async function sourceGist(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "user-agent": "HistoricBroyhill-composer/1.0" } });
    const html = await res.text();
    const pick = (re: RegExp) => Array.from(html.matchAll(re)).slice(0, 8).map((m) => m[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean);
    const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/gi)[0];
    const heads = pick(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi);
    const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/gi)[0];
    return [title && `title: ${title}`, desc && `description: ${desc}`, heads.length && `headings: ${heads.join(" | ")}`].filter(Boolean).join("\n");
  } catch {
    return "";
  }
}

export async function GET(request: Request) {
  try {
    const u = new URL(request.url);
    if (u.searchParams.get("drafts")) {
      const drafts = await prisma.aiContentPipeline.findMany({
        where: { channel: "LANDING_PAGE" },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, status: true, createdAt: true, metrics: true, suggestedDraft: false },
      });
      return NextResponse.json({ success: true, drafts });
    }
    const templates = await loadCatalog();
    const audience = u.searchParams.get("audience");
    if (audience) {
      const list = templates.filter((t) => t.audience === audience).map((t) => ({ ...t, preview: previewUrl(t.slug) }));
      return NextResponse.json({ success: true, templates: list });
    }
    const counts = new Map<string, number>();
    for (const t of templates) counts.set(t.audience, (counts.get(t.audience) ?? 0) + 1);
    return NextResponse.json({
      success: true,
      audiences: Array.from(counts.entries()).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
      total: templates.length,
    });
  } catch (e: any) {
    console.error("landing catalog failed", e);
    return NextResponse.json({ error: "Could not load the template catalog." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: any;
  try { body = await request.json(); } catch { body = null; }
  const slug = body?.slug;
  if (!slug) return NextResponse.json({ error: "Pick a template to compose from." }, { status: 400 });
  if (!anthropicEnabled() && !groqEnabled()) {
    return NextResponse.json({ error: NOT_CONFIGURED }, { status: 500 });
  }

  try {
    const templates = await loadCatalog();
    const tpl = templates.find((t) => t.slug === slug);
    if (!tpl) return NextResponse.json({ error: "Template not in the catalog." }, { status: 404 });

    const [brand, gist] = await Promise.all([brandContext(), sourceGist(previewUrl(tpl.slug))]);
    const notes = String(body?.notes ?? "").slice(0, 500);
    const mediaUrl = /^https?:\/\//.test(String(body?.mediaUrl ?? "")) ? String(body.mediaUrl) : "";

    const system = `You are the landing-page composer for an event venue. Output ONE complete standalone HTML page — no markdown fence, no commentary.

Hard rules:
- Single file: embedded <style>, no external CSS/JS except the tripwire script tag given below.
- Brand tokens: navy #13233b headings/navigation, cream #f6f1e6 background sections, gold #c9a227 accents/CTAs; serif display headings, clean sans body.
- Sections: hero with one clear headline + CTA, 3-4 content sections matching the venue's services, a social-proof strip, and a lead-capture form near the bottom.
- The lead form: <form data-tw="contract" action="/api/t/event" method="post"> with name/email/phone/date fields and a submit button labeled for the ask.
- If a hero image URL is given, use it as the hero background image (with a navy overlay for legibility); otherwise use a flat navy/gold hero, never a stock-photo URL.
- CTA buttons carry data-tw="rsvp". Include <script src="/tripwire.js" defer></script> before </body>.
- Mobile-first, no lorem ipsum, real copy for the venue described below. No invented prices; placeholders as [CONFIRM: ...] only where a venue fact is truly unknown.`;

    const user = `${brand}

Template to mirror (structure reference only — write for THIS business):
- title: ${tpl.title}
- categories: ${tpl.categories.join(", ")}
- audience: ${tpl.audience}
- source: ${tpl.source}
${gist ? `Its live structure:\n${gist}` : ""}
${mediaUrl ? `\nHero image to use: ${mediaUrl}` : ""}${notes ? `\nExtra direction: ${notes}` : ""}

Compose the venue landing page now — full HTML document.`;

    let html = "";
    if (anthropicEnabled()) {
      try {
        const res = await getClient().messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 8000,
          system,
          messages: [{ role: "user", content: user }],
        });
        html = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
      } catch (e) {
        if (!groqEnabled()) throw e;
      }
    }
    if (!html && groqEnabled()) {
      const res = await groqChat({ messages: [{ role: "system", content: system }, { role: "user", content: user }], max_tokens: 8000 });
      html = (res?.content ?? "").trim();
    }
    html = html.replace(/^```(?:html)?/i, "").replace(/```$/i, "").trim();
    if (!html.toLowerCase().includes("<html")) {
      return NextResponse.json({ error: "The composer returned something that wasn't a page. Try again." }, { status: 502 });
    }

    const draft = await prisma.aiContentPipeline.create({
      data: {
        businessId: "broyhill-01",
        channel: "LANDING_PAGE",
        suggestedDraft: html,
        status: "PENDING_REVIEW",
        metrics: { templateSlug: tpl.slug, templateTitle: tpl.title, audience: tpl.audience, source: tpl.source, notes: notes || null, mediaUrl: mediaUrl || null },
      },
    });

    return NextResponse.json({ success: true, id: draft.id, html });
  } catch (e: any) {
    console.error("landing compose failed", e);
    return NextResponse.json({ error: aiErrorMessage(e) }, { status: 500 });
  }
}

// Draft lifecycle: publish/unpublish to /p/<id>, attach media, rename. Auth via /api/admin middleware.
export async function PATCH(request: Request) {
  let body: any;
  try { body = await request.json(); } catch { body = null; }
  const id = String(body?.id ?? "");
  const action = String(body?.action ?? "");
  if (!id) return NextResponse.json({ error: "Missing draft id." }, { status: 400 });
  try {
    const draft = await prisma.aiContentPipeline.findFirst({ where: { id, channel: "LANDING_PAGE" }, select: { id: true, status: true, metrics: true } });
    if (!draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    const metrics = { ...(typeof draft.metrics === "object" && draft.metrics ? (draft.metrics as Record<string, unknown>) : {}) };
    if (action === "publish" || action === "unpublish") {
      const status = action === "publish" ? "APPROVED" : "PENDING_REVIEW";
      if (action === "publish") metrics.publishedAt = new Date().toISOString(); else delete metrics.publishedAt;
      await prisma.aiContentPipeline.update({ where: { id }, data: { status, metrics: metrics as Prisma.InputJsonValue } });
      return NextResponse.json({ success: true, id, status, url: action === "publish" ? `/p/${id}` : null });
    }
    if (action === "media") {
      const mediaUrl = /^https?:\/\//.test(String(body?.mediaUrl ?? "")) ? String(body.mediaUrl) : null;
      metrics.mediaUrl = mediaUrl;
      await prisma.aiContentPipeline.update({ where: { id }, data: { metrics: metrics as Prisma.InputJsonValue } });
      return NextResponse.json({ success: true, id, mediaUrl });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e: any) {
    console.error("landing draft update failed", e);
    return NextResponse.json({ error: "Could not update the draft." }, { status: 500 });
  }
}

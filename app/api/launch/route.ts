import { NextResponse } from "next/server";
import { z } from "zod";
import { brandFromHtml, brandFacts, httpUrl } from "@/lib/brand";
import { anthropicEnabled, CLAUDE_MODEL, claudeEnabled, claudeJson, getClient, groqChat, groqEnabled } from "@/lib/ai";

export const maxDuration = 60;

// Public front door ("the Larven step"): POST {website} → pull the caller's brand from their own
// site, then draft a starter campaign plan and likely competitors. Nothing is saved; the reveal is
// a preview. The 16-channel map is the platform's own — see CHANNELS below.

const BLOCKED_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[::1\]|169\.254\.)/i;

const CHANNELS = [
  "Landing pages", "Email", "SMS / text", "Voice notes", "Direct mail",
  "Social posts", "Paid social", "Search ads", "Events & RSVP", "Phone follow-up",
  "Print collateral", "Referral asks", "Reviews & testimonials", "Local press",
  "Community partners", "Retargeting",
] as const;

type BrandKit = ReturnType<typeof brandFromHtml>;

// Slice 2: draft the prospect's FIRST branded landing page on the spot — the Larven
// "first ad appears" beat. Standalone HTML in THEIR palette (not our navy/gold),
// form action="#" so the preview submits nowhere. AI draft first; the skeleton
// fallback means the reveal always has a page.
async function composePage(brand: BrandKit): Promise<string> {
  const system = `You are a landing-page composer. Output ONE complete standalone HTML page — no markdown fence, no commentary.

Hard rules:
- Single file with an embedded <style> block; no external CSS/JS/fonts except the business's own logo URL if given.
- Use the BUSINESS'S OWN brand: its primary color for headings/buttons, secondary for accents, its background color for page background. Serif display headings, clean sans body.
- Sections: hero (one headline + one CTA), 3 content sections fitted to what this business actually does, a trust strip, and a contact section with phone/email and a lead form whose action="#" (submits nowhere — this is a preview).
- Mobile-first, no lorem ipsum, no invented prices or claims. Use [CONFIRM: ...] only where a fact is genuinely unknown.`;
  const user = `Brand facts:\n${brandFacts(brand)}\nLogo URL: ${brand.logoUrl || "none"}\n\nCompose the page now — full HTML document.`;

  let html = "";
  if (anthropicEnabled()) {
    try {
      const res = await getClient().messages.create({ model: CLAUDE_MODEL, max_tokens: 8000, system, messages: [{ role: "user", content: user }] });
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
  return html.toLowerCase().includes("<html") ? html : skeletonPage(brand);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// Landing-page audit — the Larven /tools pattern: a free, unauthenticated check
// that demos the reader. Concrete pass/fail checks on the fetched HTML; score
// is the share passing. No invented findings — each check is observable.
function auditPage(html: string, finalUrl: string, brand: BrandKit) {
  const count = (re: RegExp) => (html.match(re) || []).length;
  const h1s = count(/<h1[\s>]/gi);
  const ctaWords = /(book|schedule|call|contact|quote|buy|shop|sign ?up|get started|rsvp|reserve|subscribe|donate|apply|join|free (quote|estimate|consult))/i;
  const linkText = Array.from(html.matchAll(/<(a|button)[^>]*>([\s\S]{0,160}?)<\/(a|button)>/gi)).map((m) => m[2].replace(/<[^>]+>/g, " ")).join(" ");
  const imgs = count(/<img[\s>]/gi);
  const withAlt = count(/<img[^>]+alt=["'][^"']+["']/gi);
  const checks: { name: string; pass: boolean; detail: string }[] = [
    { name: "Page title", pass: /<title[^>]*>[^<]{4,}/i.test(html), detail: "The title searchers see before they ever click." },
    { name: "Meta description", pass: /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(html), detail: "Your one-sentence pitch in the search result." },
    { name: "One clear headline", pass: h1s === 1, detail: h1s === 0 ? "No <h1> found — the page doesn't say what it is." : `${h1s} H1s — the page competes with itself.` },
    { name: "Mobile-ready", pass: /<meta[^>]+name=["']viewport["']/i.test(html), detail: "No viewport tag means phones get the desktop squeeze." },
    { name: "A next step", pass: ctaWords.test(linkText), detail: "A button or link that asks for the action — book, call, get a quote." },
    { name: "Way to reach you", pass: Boolean(brand.phone || brand.email), detail: "Phone or email visible without hunting." },
    { name: "Social proof", pass: Object.values(brand.socials).some(Boolean), detail: "Linked socials tell visitors a real business is behind this." },
    { name: "Images carry alt text", pass: imgs === 0 || withAlt / imgs >= 0.5, detail: imgs ? `${withAlt}/${imgs} images describe themselves to search and screen readers.` : "No images to check." },
    { name: "Runs on HTTPS", pass: finalUrl.startsWith("https://"), detail: "Browsers flag plain-HTTP pages as not secure." },
    { name: "A visible identity", pass: Boolean(brand.logoUrl || brand.name), detail: "Logo or business name up top — people check who you are in the first seconds." },
  ];
  const score = Math.round((checks.filter((c) => c.pass).length / checks.length) * 100);
  return { score, checks };
}

function skeletonPage(brand: BrandKit): string {
  const name = esc(brand.name || "Your business");
  const tag = esc(brand.tagline || "Built for you.");
  const primary = brand.colors.primary || "#1d3a55";
  const accent = brand.colors.secondary || "#c2a15a";
  const bg = brand.colors.background || "#f6f4ef";
  const phone = esc(brand.phone || "");
  const email = esc(brand.email || "");
  const logo = brand.logoUrl && /^https?:\/\//.test(brand.logoUrl) ? esc(brand.logoUrl) : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name}</title><style>
body{margin:0;font-family:Georgia,serif;background:${bg};color:#1c1c1c}header{padding:28px 6vw;display:flex;align-items:center;gap:14px}header img{height:44px}
.hero{background:${primary};color:#fff;text-align:center;padding:80px 6vw}.hero h1{font-size:clamp(28px,5vw,52px);margin:0 0 14px}.hero p{opacity:.85;font-size:18px;margin:0 0 28px}
.btn{display:inline-block;background:${accent};color:${primary};padding:14px 34px;border-radius:999px;font-weight:700;text-decoration:none}
section{padding:56px 6vw;max-width:960px;margin:0 auto}h2{color:${primary};font-size:26px}.cards{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.card{background:#fff;border:1px solid #e5e0d5;border-radius:14px;padding:22px}.card h3{margin:0 0 8px;color:${primary};font-size:18px}
form{display:grid;gap:12px;max-width:420px}input{padding:12px 16px;border:1px solid #d5cfc2;border-radius:10px;font-size:15px}button{background:${primary};color:#fff;border:0;padding:14px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer}
footer{background:${primary};color:#fff;text-align:center;padding:26px;font-size:14px;opacity:.9}
</style></head><body><header>${logo ? `<img src="${logo}" alt="">` : ""}<strong>${name}</strong></header>
<div class="hero"><h1>${tag}</h1><p>A page drafted in your brand — colors, voice, and offer.</p><a class="btn" href="#contact">Get in touch</a></div>
<section><h2>What we do</h2><div class="cards"><div class="card"><h3>Our work</h3><p>${name} — what we offer, told simply.</p></div><div class="card"><h3>Why us</h3><p>The local choice, built on what our customers say.</p></div><div class="card"><h3>How it works</h3><p>Reach out, talk it through, get it done.</p></div></div></section>
<section id="contact"><h2>Get in touch</h2>${phone ? `<p>${phone}</p>` : ""}${email ? `<p>${email}</p>` : ""}<form action="#" method="post"><input placeholder="Your name" required><input type="email" placeholder="Your email" required><button type="submit">Send</button></form></section>
<footer>${name}</footer></body></html>`;
}

const Plan = z.object({
  competitors: z.array(z.object({ name: z.string(), why: z.string() })).max(6),
  positioning: z.string(),
  plan: z.array(z.object({ step: z.string(), detail: z.string(), channel: z.string() })).min(4).max(8),
});

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}));
    let site = typeof b.website === "string" ? b.website.trim() : "";
    if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`;
    const url = httpUrl(site);
    if (!url) return NextResponse.json({ error: "Enter your website address, like broyhill.net." }, { status: 400 });
    const host = new URL(url).hostname;
    if (BLOCKED_HOST.test(host) || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host))
      return NextResponse.json({ error: "That doesn't look like a website address. Try something like broyhill.net." }, { status: 400 });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "follow", signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 HistoricBroyhillLaunch/1.0",
          Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9",
        },
      });
    } finally { clearTimeout(timer); }
    if (!res.ok) return NextResponse.json({ error: `Your site answered ${res.status}. Check the address.` }, { status: 502 });
    const html = (await res.text()).slice(0, 2_000_000);
    const brand = brandFromHtml(html, res.url || url);
    const found = [brand.logoUrl && "logo", brand.name && "name", brand.address.line1 && "address", brand.phone && "phone", brand.email && "email", Object.values(brand.socials).some(Boolean) && "social links"].filter(Boolean);

    // Free-tool mode: audit the page — concrete checks, no AI needed.
    if (b?.audit) {
      return NextResponse.json({ success: true, brand, found, audit: auditPage(html, res.url || url, brand) });
    }

    // Second pass (page:true): skip the plan, compose their first branded page.
    if (b?.page) {
      const page = await composePage(brand).catch((e) => { console.error("launch compose failed, using skeleton", e); return skeletonPage(brand); });
      return NextResponse.json({ success: true, brand, found, page });
    }

    let plan: z.infer<typeof Plan> | null = null;
    if (claudeEnabled()) {
      try {
      plan = await claudeJson({
        system: `You are a senior small-business marketing strategist. Given a business's brand facts, produce: (1) up to 4 likely real competitors in the same trade and locale — only name businesses you actually recognize; if unsure, name the competitor TYPE (e.g. "independent wedding venues nearby") instead of inventing a business name; (2) a one-sentence positioning line; (3) a starter campaign plan of 5-7 steps, each tagged to one of these channels: ${CHANNELS.join(", ")}. Ground every step in the actual brand facts. Keep it concrete and honest — no invented claims about the business.`,
        user: `Brand facts:\n${brandFacts(brand)}\nWebsite: ${brand.website}`,
        schema: Plan,
        maxTokens: 1200,
      });
      } catch (e) { console.error("launch plan draft failed, falling back to skeleton", e); plan = null; }
    }

    return NextResponse.json({
      success: true, brand, found,
      plan: plan ?? {
        competitors: [],
        positioning: brand.tagline || `${brand.name || "Your business"} — the local choice.`,
        plan: [
          { step: "Launch page", detail: `A dedicated campaign page in ${brand.name || "your"}'s colors, voice and offer — ready to share.`, channel: "Landing pages" },
          { step: "Welcome sequence", detail: "A short email arc that introduces the story and asks for the booking.", channel: "Email" },
          { step: "Social drumbeat", detail: "A week of posts built from your photos and brand voice.", channel: "Social posts" },
          { step: "Local reach", detail: "Follow-up touches to people who raised their hand.", channel: "SMS / text" },
          { step: "Fill the calendar", detail: "Repeat winners, test messages, keep what works.", channel: "Retargeting" },
        ],
      },
      channels: CHANNELS,
    });
  } catch (error: any) {
    const aborted = error?.name === "AbortError";
    console.error("launch route failed", error);
    return NextResponse.json({ error: aborted ? "The site took too long to answer." : "Could not read that site." }, { status: aborted ? 504 : 500 });
  }
}

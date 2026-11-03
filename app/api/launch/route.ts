import { NextResponse } from "next/server";
import { z } from "zod";
import { brandFromHtml, brandFacts, httpUrl } from "@/lib/brand";
import { claudeEnabled, claudeJson } from "@/lib/ai";

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

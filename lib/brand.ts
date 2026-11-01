// Brand kit: who the business is and how it looks, pulled from its website and confirmed by a person.
// Venue-agnostic and pure (no network, no database) so it can be reused by other products. The network
// fetch lives in the API route; this file only reads HTML and normalizes what came back.

export interface BrandKit {
  website: string;
  name: string;
  tagline: string;
  logoUrl: string;
  iconUrl: string;
  colors: { primary: string; secondary: string; background: string };
  fonts: { heading: string; body: string };
  address: { line1: string; line2: string; city: string; state: string; zip: string };
  phone: string;
  email: string;
  socials: { facebook: string; instagram: string; linkedin: string; x: string; youtube: string; tiktok: string };
  industry: string;
  businessType: string;
  confirmedAt: string | null; // ISO date when a person said "this matches my brand"
}

export const SOCIAL_KEYS = ["facebook", "instagram", "linkedin", "x", "youtube", "tiktok"] as const;
export const INDUSTRIES = ["Events & venues", "Hospitality", "Office & coworking", "Nonprofit", "Professional services", "Retail", "Restaurant & food", "Real estate", "Health & wellness", "Other"];
export const BUSINESS_TYPES = ["Small business", "Nonprofit", "Agency", "Franchise", "Other"];

export const emptyBrand = (): BrandKit => ({
  website: "", name: "", tagline: "", logoUrl: "", iconUrl: "",
  colors: { primary: "#182c3e", secondary: "#a8853f", background: "#f3f0e8" },
  fonts: { heading: "Playfair Display", body: "Source Sans 3" },
  address: { line1: "", line2: "", city: "", state: "", zip: "" },
  phone: "", email: "",
  socials: { facebook: "", instagram: "", linkedin: "", x: "", youtube: "", tiktok: "" },
  industry: "", businessType: "", confirmedAt: null,
});

const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const hex = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim().toLowerCase() : fallback);
export const httpUrl = (v: unknown): string => {
  const u = str(v, 600);
  return /^https?:\/\//i.test(u) ? u : "";
};

export function normalizeBrand(raw: unknown): BrandKit {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const d = emptyBrand();
  const a = r.address && typeof r.address === "object" ? r.address : {};
  const s = r.socials && typeof r.socials === "object" ? r.socials : {};
  const c = r.colors && typeof r.colors === "object" ? r.colors : {};
  const f = r.fonts && typeof r.fonts === "object" ? r.fonts : {};
  return {
    website: httpUrl(r.website), name: str(r.name, 120), tagline: str(r.tagline, 200),
    logoUrl: httpUrl(r.logoUrl), iconUrl: httpUrl(r.iconUrl),
    colors: { primary: hex(c.primary, d.colors.primary), secondary: hex(c.secondary, d.colors.secondary), background: hex(c.background, d.colors.background) },
    fonts: { heading: str(f.heading, 60) || d.fonts.heading, body: str(f.body, 60) || d.fonts.body },
    address: { line1: str(a.line1, 120), line2: str(a.line2, 120), city: str(a.city, 80), state: str(a.state, 40), zip: str(a.zip, 20) },
    phone: str(r.phone, 40), email: str(r.email, 120).replace(/^mailto:/i, ""),
    socials: Object.fromEntries(SOCIAL_KEYS.map((k) => [k, httpUrl(s[k])])) as BrandKit["socials"],
    industry: str(r.industry, 60), businessType: str(r.businessType, 60),
    confirmedAt: typeof r.confirmedAt === "string" && !Number.isNaN(Date.parse(r.confirmedAt)) ? r.confirmedAt : null,
  };
}

export const brandAddressLine = (b: BrandKit) =>
  [b.address.line1, b.address.line2, [b.address.city, b.address.state].filter(Boolean).join(", "), b.address.zip].filter(Boolean).join(", ");

// --- Reading a home page --------------------------------------------------------------------------
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const abs = (href: string, base: string) => { try { return new URL(href, base).toString(); } catch { return ""; } };
const attrs = (tag: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = decode(m[3] ?? m[4] ?? "");
  return out;
};
const lum = (h: string) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const sat = (h: string) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return (Math.max(...v) - Math.min(...v)) / 255; };
const SOCIAL_HOST: Record<(typeof SOCIAL_KEYS)[number], RegExp> = {
  facebook: /(^|\.)facebook\.com$/i, instagram: /(^|\.)instagram\.com$/i, linkedin: /(^|\.)linkedin\.com$/i,
  x: /(^|\.)(x|twitter)\.com$/i, youtube: /(^|\.)youtube\.com$/i, tiktok: /(^|\.)tiktok\.com$/i,
};
const SHARE_PATH = /\/(sharer|share|intent|dialog|plugins)\b/i;

// Best-effort read of a home page: logo, icon, colors, fonts, address, phone, email, socials. Anything not
// found stays empty for the person to fill in; nothing here is treated as verified until they confirm.
export function brandFromHtml(html: string, pageUrl: string): BrandKit {
  const b = emptyBrand();
  b.website = httpUrl(pageUrl);
  const head = html.slice(0, 400_000);
  const metas: Record<string, string> = {};
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) { const a = attrs(m[0]); const k = (a.property || a.name || "").toLowerCase(); if (k && a.content) metas[k] = a.content; }
  const title = decode(head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim();
  b.name = (metas["og:site_name"] || title.split(/\s[|–—-]\s/)[0] || "").trim().slice(0, 120);
  b.tagline = (metas["og:description"] || metas["description"] || "").slice(0, 200);

  // Logo: an <img> whose src/alt/class says logo, else the og:image. Icon: apple-touch-icon, else any icon.
  const imgs = Array.from(head.matchAll(/<img\b[^>]*>/gi)).map((m) => attrs(m[0]));
  const logo = imgs.find((a) => /logo|brand/i.test(`${a.src} ${a.alt} ${a.class}`) && a.src && !/\.svg\?|sprite/i.test(a.src)) ?? imgs.find((a) => /logo/i.test(a.src || ""));
  b.logoUrl = httpUrl(abs(logo?.src ?? "", pageUrl)) || httpUrl(abs(metas["og:image"] ?? "", pageUrl));
  const links = Array.from(head.matchAll(/<link\b[^>]*>/gi)).map((m) => attrs(m[0]));
  const icon = links.find((a) => /apple-touch-icon/i.test(a.rel || "")) ?? links.find((a) => /\bicon\b/i.test(a.rel || ""));
  b.iconUrl = httpUrl(abs(icon?.href ?? "", pageUrl));

  // Colors: theme-color first; otherwise the most-used saturated hex that isn't near-white/near-black.
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/#([0-9a-fA-F]{6})\b/g)) { const h = `#${m[1].toLowerCase()}`; counts.set(h, (counts.get(h) ?? 0) + 1); }
  const ranked = Array.from(counts.entries()).filter(([h]) => lum(h) > 0.02 && lum(h) < 0.8 && sat(h) > 0.25).sort((x, y) => y[1] - x[1]).map(([h]) => h);
  const theme = hex(metas["theme-color"], "");
  b.colors.primary = theme || ranked[0] || b.colors.primary;
  b.colors.secondary = ranked.find((h) => h !== b.colors.primary) ?? b.colors.secondary;
  const lights = Array.from(counts.entries()).filter(([h]) => lum(h) > 0.85 && lum(h) < 0.99).sort((x, y) => y[1] - x[1]).map(([h]) => h);
  b.colors.background = lights[0] ?? b.colors.background;

  // Fonts: Google Fonts families, first = heading if it reads as a display/serif face.
  const fams: string[] = [];
  for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"'&)]+)/gi)) for (const part of decodeURIComponent(m[1]).split("|")) { const f = part.split(":")[0].replace(/\+/g, " ").trim(); if (f && !fams.includes(f)) fams.push(f); }
  if (fams.length) {
    const serif = fams.find((f) => /playfair|garamond|serif|cormorant|lora|merriweather|libre|crimson|baskerville|dm serif/i.test(f));
    b.fonts.heading = serif ?? fams[0];
    b.fonts.body = fams.find((f) => f !== b.fonts.heading) ?? fams[0];
  }

  // Contact: tel:/mailto: links, then a US street address pattern in the visible text.
  b.phone = decode(html.match(/href="tel:([^"]+)"/i)?.[1] ?? "").replace(/[^\d+]/g, "").replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3");
  const mails = Array.from(html.matchAll(/href="mailto:([^"?]+)"/gi)).map((m) => decode(m[1]));
  b.email = mails.find((m) => /^info@|^hello@|^contact@/i.test(m)) ?? mails[0] ?? "";
  const text = decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
  const addr = text.match(/(\d{2,6}\s+[A-Z][A-Za-z0-9.' ]{2,40}?\s(?:Road|Rd|Street|St|Avenue|Ave|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct|Highway|Hwy|Parkway|Pkwy)\.?)(?:,?\s*(Suite|Ste|Unit|#)\s*([A-Za-z0-9-]+))?,?\s*([A-Z][A-Za-z.' -]{2,30}?),?\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?/);
  if (addr) b.address = { line1: addr[1].trim(), line2: addr[2] ? `${addr[2]} ${addr[3]}` : "", city: addr[4].trim(), state: addr[5], zip: addr[6] };

  // Socials: first profile link per network, skipping share/intent widgets.
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/gi)) {
    const u = decode(m[1]); let host = ""; let path = "";
    try { const p = new URL(u); host = p.hostname; path = p.pathname; } catch { continue; }
    if (!path || path === "/" || SHARE_PATH.test(path)) continue;
    for (const k of SOCIAL_KEYS) if (!b.socials[k] && SOCIAL_HOST[k].test(host)) b.socials[k] = u.split("?")[0];
  }
  return normalizeBrand(b);
}

// What the AI routes are told about the business, in plain words. Only what the person confirmed.
export function brandFacts(b: BrandKit): string {
  if (!b.name && !b.website) return "";
  const parts = [`Business: ${b.name || b.website}.`];
  if (b.tagline) parts.push(`Describes itself as: "${b.tagline}".`);
  if (b.industry) parts.push(`Industry: ${b.industry}.`);
  const addr = brandAddressLine(b); if (addr) parts.push(`Address: ${addr}.`);
  if (b.phone) parts.push(`Phone: ${b.phone}.`);
  if (b.email) parts.push(`Email: ${b.email}.`);
  if (b.website) parts.push(`Website: ${b.website}.`);
  const soc = SOCIAL_KEYS.filter((k) => b.socials[k]).map((k) => `${k}: ${b.socials[k]}`); if (soc.length) parts.push(`Social: ${soc.join("; ")}.`);
  return parts.join(" ");
}

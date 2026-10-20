// Studio: a block-based email builder. A design is a short list of blocks plus brand settings; the
// HTML is always generated from that data, never typed by hand, so it stays safe and consistent.
// Pure functions only (no database, no network) so they can be tested on their own.

export const VENUE_ADDRESS = "Historic Broyhill, 3540 Clemmons Road, Suite 111, Clemmons, NC 27012";
export const MAX_BLOCKS = 40;
export const UNSUBSCRIBE_MARKER = "{unsubscribe_url}"; // replaced with the real link when sending is turned on

export type Block =
  | { id: string; type: "heading"; text: string; align: Align }
  | { id: string; type: "text"; text: string; align: Align }
  | { id: string; type: "image"; url: string; alt: string; link: string }
  | { id: string; type: "button"; label: string; link: string; align: Align }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; height: number };

export type Align = "left" | "center" | "right";
export type BlockType = Block["type"];
export const BLOCK_TYPES: { type: BlockType; label: string }[] = [
  { type: "heading", label: "Heading" },
  { type: "text", label: "Text" },
  { type: "image", label: "Image" },
  { type: "button", label: "Button" },
  { type: "divider", label: "Divider" },
  { type: "spacer", label: "Spacer" },
];

export interface Brand { accent: string; background: string; font: "serif" | "sans" }
export interface Design { blocks: Block[]; brand: Brand }

export const defaultBrand = (): Brand => ({ accent: "#8a5a2b", background: "#f6f1e9", font: "serif" });
export const emptyDesign = (): Design => ({ blocks: [], brand: defaultBrand() });

const FONTS = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
};

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Only web links and email links are allowed; anything else (javascript:, data:) becomes empty.
export function safeUrl(v: unknown): string {
  if (typeof v !== "string") return "";
  const u = v.trim().slice(0, 600);
  return /^(https:\/\/|http:\/\/|mailto:)/i.test(u) ? u : "";
}
const safeColor = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback);
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");
const align = (v: unknown): Align => (v === "center" || v === "right" ? v : "left");

let counter = 0;
export const newId = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

export function newBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case "heading": return { id, type, text: "A heading", align: "left" };
    case "text": return { id, type, text: "Write your message here.", align: "left" };
    case "image": return { id, type, url: "", alt: "", link: "" };
    case "button": return { id, type, label: "Learn more", link: "", align: "center" };
    case "divider": return { id, type };
    case "spacer": return { id, type, height: 24 };
  }
}

// Cleans anything coming from the browser or the database into a valid design.
export function normalizeDesign(raw: unknown): Design {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const b = r.brand && typeof r.brand === "object" ? (r.brand as Record<string, unknown>) : {};
  const d = defaultBrand();
  const brand: Brand = { accent: safeColor(b.accent, d.accent), background: safeColor(b.background, d.background), font: b.font === "sans" ? "sans" : "serif" };
  const blocks: Block[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(r.blocks) ? r.blocks.slice(0, MAX_BLOCKS) : []) {
    if (!item || typeof item !== "object") continue;
    const x = item as Record<string, unknown>;
    let id = clip(x.id, 40).replace(/[^\w-]/g, "") || newId();
    if (seen.has(id)) id = newId();
    seen.add(id);
    switch (x.type) {
      case "heading": blocks.push({ id, type: "heading", text: clip(x.text, 300), align: align(x.align) }); break;
      case "text": blocks.push({ id, type: "text", text: clip(x.text, 5000), align: align(x.align) }); break;
      case "image": blocks.push({ id, type: "image", url: safeUrl(x.url), alt: clip(x.alt, 200), link: safeUrl(x.link) }); break;
      case "button": blocks.push({ id, type: "button", label: clip(x.label, 60), link: safeUrl(x.link), align: align(x.align) }); break;
      case "divider": blocks.push({ id, type: "divider" }); break;
      case "spacer": blocks.push({ id, type: "spacer", height: Math.min(80, Math.max(8, Math.round(Number(x.height)) || 24)) }); break;
    }
  }
  return { blocks, brand };
}

export function moveBlock(blocks: Block[], id: string, dir: -1 | 1): Block[] {
  const i = blocks.findIndex((b) => b.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= blocks.length) return blocks;
  const out = blocks.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function duplicateBlock(blocks: Block[], id: string): Block[] {
  const i = blocks.findIndex((b) => b.id === id);
  if (i < 0 || blocks.length >= MAX_BLOCKS) return blocks;
  const out = blocks.slice();
  out.splice(i + 1, 0, { ...blocks[i], id: newId() } as Block);
  return out;
}

const paragraphs = (text: string) =>
  esc(text).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => p.replace(/\n/g, "<br>"));

function renderBlock(b: Block, brand: Brand): string {
  const font = FONTS[brand.font];
  switch (b.type) {
    case "heading":
      return `<tr><td class="pad" style="padding:20px 32px 4px;text-align:${b.align};font-family:${font};font-size:26px;line-height:1.25;color:#2b2118;font-weight:bold">${esc(b.text)}</td></tr>`;
    case "text": {
      const ps = paragraphs(b.text).map((p) => `<p style="margin:0 0 14px">${p}</p>`).join("");
      return `<tr><td class="pad" style="padding:8px 32px;text-align:${b.align};font-family:${font};font-size:16px;line-height:1.6;color:#3a3028">${ps}</td></tr>`;
    }
    case "image": {
      if (!b.url) return "";
      const img = `<img src="${esc(b.url)}" alt="${esc(b.alt)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0">`;
      return `<tr><td style="padding:8px 0">${b.link ? `<a href="${esc(b.link)}">${img}</a>` : img}</td></tr>`;
    }
    case "button": {
      if (!b.label.trim() || !b.link) return "";
      return `<tr><td class="pad" style="padding:14px 32px;text-align:${b.align}"><a href="${esc(b.link)}" style="display:inline-block;background:${brand.accent};color:#ffffff;font-family:${font};font-size:16px;font-weight:bold;text-decoration:none;padding:12px 26px;border-radius:4px">${esc(b.label)}</a></td></tr>`;
    }
    case "divider":
      return `<tr><td class="pad" style="padding:12px 32px"><div style="border-top:1px solid #d9cfc0;line-height:1px;font-size:1px">&nbsp;</div></td></tr>`;
    case "spacer":
      return `<tr><td style="height:${b.height}px;line-height:${b.height}px;font-size:1px">&nbsp;</td></tr>`;
  }
}

// The footer is not a block: it is always added, cannot be removed or edited, and is where the legal
// address and the unsubscribe link live.
function renderFooter(brand: Brand): string {
  const font = FONTS.sans;
  return `<tr><td class="pad" style="padding:22px 32px 28px;border-top:1px solid #d9cfc0;text-align:center;font-family:${font};font-size:12px;line-height:1.6;color:#7a6f63">${esc(VENUE_ADDRESS)}<br>You are receiving this because you asked to hear from us. <a href="${UNSUBSCRIBE_MARKER}" style="color:${brand.accent}">Unsubscribe</a></td></tr>`;
}

export function renderHtml(design: Design, opts: { title?: string } = {}): string {
  const d = normalizeDesign(design);
  const rows = d.blocks.map((b) => renderBlock(b, d.brand)).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title ?? "Historic Broyhill")}</title><style>@media only screen and (max-width:620px){.wrap{width:100%!important}.pad{padding-left:18px!important;padding-right:18px!important}}</style></head><body style="margin:0;padding:0;background:${d.brand.background}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${d.brand.background}"><tr><td align="center" style="padding:20px 8px"><table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff">${rows}${renderFooter(d.brand)}</table></td></tr></table></body></html>`;
}

// What the design reads like with no styling, for the plain-text half of an email and for AI context.
export function renderPlainText(design: Design): string {
  const d = normalizeDesign(design);
  const parts: string[] = [];
  for (const b of d.blocks) {
    if (b.type === "heading" || b.type === "text") parts.push(b.text.trim());
    else if (b.type === "button" && b.label.trim() && b.link) parts.push(`${b.label.trim()}: ${b.link}`);
    else if (b.type === "image" && b.alt.trim()) parts.push(`[Image: ${b.alt.trim()}]`);
    else if (b.type === "divider") parts.push("---");
  }
  parts.push(VENUE_ADDRESS, `Unsubscribe: ${UNSUBSCRIBE_MARKER}`);
  return parts.filter(Boolean).join("\n\n");
}

export interface DesignIssue { blockId?: string; message: string }
export function designIssues(design: Design): DesignIssue[] {
  const d = normalizeDesign(design);
  const out: DesignIssue[] = [];
  if (!d.blocks.some((b) => (b.type === "text" || b.type === "heading") && b.text.trim())) out.push({ message: "Add some text so the email says something." });
  for (const b of d.blocks) {
    if (b.type === "image") {
      if (!b.url) out.push({ blockId: b.id, message: "An image block has no picture yet." });
      else if (!b.alt.trim()) out.push({ blockId: b.id, message: "Add a short description to the image for people who can't see it." });
    }
    if (b.type === "button" && (!b.label.trim() || !b.link)) out.push({ blockId: b.id, message: "A button needs a label and a web link (https://…)." });
  }
  return out;
}

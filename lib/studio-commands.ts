// Studio commands: Claude turns a plain-words request ("shorten the intro", "make the button gold")
// into a short list of small edits. This file checks every edit and applies the safe ones, and says
// in plain words what it did and what it refused. Pure functions: no network, no database.
import { MAX_BLOCKS, newBlock, newId, normalizeDesign, safeUrl, type Block, type BlockType, type Design } from "./studio";

export interface Op {
  op: string; blockId: string; afterId: string; blockType: string;
  text: string; label: string; link: string; url: string; alt: string; align: string; height: number;
  accent: string; background: string; font: string;
}

export interface Allowed { links: Set<string>; images: Set<string> }
export interface ApplyResult { design: Design; applied: string[]; skipped: string[] }

const TYPES: BlockType[] = ["heading", "text", "image", "button", "divider", "spacer"];
const isType = (v: string): v is BlockType => (TYPES as string[]).includes(v);
const snip = (s: string, n = 40) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

export const describeBlock = (b: Block) =>
  b.type === "heading" || b.type === "text" ? `${b.type} “${snip(b.text)}”`
    : b.type === "button" ? `button “${snip(b.label, 24)}”`
      : b.type === "image" ? `image${b.alt ? ` “${snip(b.alt, 24)}”` : ""}` : b.type;

// Web links the person typed in their own request count as allowed; links Claude made up do not.
export function linksIn(text: string): string[] {
  return Array.from(text.matchAll(/https?:\/\/[^\s"'<>)]+/gi)).map((m) => safeUrl(m[0].replace(/[.,;]+$/, ""))).filter(Boolean);
}

export function applyOps(input: Design, ops: Op[], allowed: Allowed): ApplyResult {
  let design = normalizeDesign(input);
  const applied: string[] = [];
  const skipped: string[] = [];
  const find = (id: string) => design.blocks.findIndex((b) => b.id === id);
  const set = (i: number, b: Block) => { design = { ...design, blocks: design.blocks.map((x, k) => (k === i ? b : x)) }; };

  for (const o of ops.slice(0, 15)) {
    const i = find(o.blockId);
    const b = i >= 0 ? design.blocks[i] : undefined;
    switch (o.op) {
      case "set_text": {
        if (!b || (b.type !== "heading" && b.type !== "text")) { skipped.push("Couldn't find the text block to change."); break; }
        if (!o.text.trim()) { skipped.push("Skipped an empty text change."); break; }
        set(i, { ...b, text: o.text.slice(0, b.type === "heading" ? 300 : 5000) });
        applied.push(`Changed the ${describeBlock({ ...b, text: o.text })}`); break;
      }
      case "set_button": {
        if (!b || b.type !== "button") { skipped.push("Couldn't find the button to change."); break; }
        let link = b.link;
        if (o.link) {
          const u = safeUrl(o.link);
          if (u && (allowed.links.has(u) || u === b.link)) link = u;
          else { skipped.push("Left the button link alone: it isn't a link already in your email or in your request."); }
        }
        const label = o.label.trim() ? o.label.trim().slice(0, 60) : b.label;
        set(i, { ...b, label, link });
        applied.push(`Updated the button “${snip(label, 24)}”`); break;
      }
      case "set_image": {
        if (!b || b.type !== "image") { skipped.push("Couldn't find the image to change."); break; }
        let url = b.url;
        if (o.url) {
          const u = safeUrl(o.url);
          if (u && allowed.images.has(u)) url = u;
          else skipped.push("Left the picture alone: it isn't in your Photo Library.");
        }
        set(i, { ...b, url, alt: o.alt.trim() ? o.alt.trim().slice(0, 200) : b.alt });
        applied.push("Updated an image"); break;
      }
      case "set_align": {
        const a = o.align === "center" || o.align === "right" ? o.align : o.align === "left" ? "left" : null;
        if (!b || !a || (b.type !== "heading" && b.type !== "text" && b.type !== "button")) { skipped.push("Couldn't change that alignment."); break; }
        set(i, { ...b, align: a });
        applied.push(`Aligned the ${describeBlock(b)} ${a}`); break;
      }
      case "set_spacer": {
        if (!b || b.type !== "spacer") { skipped.push("Couldn't find the spacer."); break; }
        const h = Math.min(80, Math.max(8, Math.round(o.height) || b.height));
        set(i, { ...b, height: h });
        applied.push(`Set a spacer to ${h}px`); break;
      }
      case "add_block": {
        if (!isType(o.blockType)) { skipped.push("Skipped adding an unknown kind of block."); break; }
        if (design.blocks.length >= MAX_BLOCKS) { skipped.push("The email already has the most blocks allowed."); break; }
        const nb = newBlock(o.blockType);
        let note = "";
        if (nb.type === "heading" || nb.type === "text") { if (o.text.trim()) nb.text = o.text; if (o.align === "center" || o.align === "right") nb.align = o.align; }
        if (nb.type === "button") {
          if (o.label.trim()) nb.label = o.label.trim().slice(0, 60);
          const u = safeUrl(o.link);
          if (u && allowed.links.has(u)) nb.link = u; else note = " (it needs a link)";
          if (o.align === "left" || o.align === "right") nb.align = o.align;
        }
        if (nb.type === "image") {
          const u = safeUrl(o.url);
          if (!u || !allowed.images.has(u)) { skipped.push("Skipped adding an image: it isn't in your Photo Library."); break; }
          nb.url = u; nb.alt = o.alt.trim().slice(0, 200);
        }
        if (nb.type === "spacer") nb.height = Math.min(80, Math.max(8, Math.round(o.height) || 24));
        const at = o.afterId === "START" ? 0 : o.afterId && find(o.afterId) >= 0 ? find(o.afterId) + 1 : design.blocks.length;
        const next = design.blocks.slice(); next.splice(at, 0, nb);
        design = { ...design, blocks: next };
        applied.push(`Added a ${describeBlock(nb)}${note}`); break;
      }
      case "remove_block": {
        if (!b) { skipped.push("Couldn't find the block to remove."); break; }
        design = { ...design, blocks: design.blocks.filter((x) => x.id !== b.id) };
        applied.push(`Removed the ${describeBlock(b)}`); break;
      }
      case "move_block": {
        if (!b) { skipped.push("Couldn't find the block to move."); break; }
        const rest = design.blocks.filter((x) => x.id !== b.id);
        const at = o.afterId === "START" ? 0 : o.afterId && rest.findIndex((x) => x.id === o.afterId) >= 0 ? rest.findIndex((x) => x.id === o.afterId) + 1 : rest.length;
        rest.splice(at, 0, b);
        design = { ...design, blocks: rest };
        applied.push(`Moved the ${describeBlock(b)}`); break;
      }
      case "set_brand": {
        const before = design.brand;
        // Only valid values count; anything else keeps what is there now (normalizeDesign would reset it to the default).
        const hex = (v: string, keep: string) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : keep);
        const merged = normalizeDesign({ blocks: design.blocks, brand: { accent: hex(o.accent, before.accent), background: hex(o.background, before.background), font: o.font === "sans" || o.font === "serif" ? o.font : before.font } });
        design = merged;
        const changed = merged.brand.accent !== before.accent || merged.brand.background !== before.background || merged.brand.font !== before.font;
        if (changed) applied.push("Changed the colors or letters"); else skipped.push("Left the colors alone: those weren't valid colors.");
        break;
      }
      default: skipped.push("Skipped something I didn't understand.");
    }
  }
  return { design, applied, skipped };
}

export const blankOp = (): Op => ({ op: "", blockId: "", afterId: "", blockType: "", text: "", label: "", link: "", url: "", alt: "", align: "", height: 0, accent: "", background: "", font: "" });

// Short stand-in ids so Claude refers to blocks by b1, b2… and not by long random ids.
export function withShortIds(design: Design): { design: Design; toReal: Map<string, string>; toShort: Map<string, string> } {
  const d = normalizeDesign(design);
  const toReal = new Map<string, string>();
  const toShort = new Map<string, string>();
  d.blocks.forEach((b, i) => { toReal.set(`b${i + 1}`, b.id); toShort.set(b.id, `b${i + 1}`); });
  return { design: d, toReal, toShort };
}
export { newId };

import { CATEGORIES, KINDS } from "@/lib/campaign-templates";

// Editable category and type lists for templates. Pure functions (no database) so the admin page and
// the API apply exactly the same rules. The server stores the result as one settings row.

export type ListName = "categories" | "kinds";

export interface TemplateSettings {
  categories: string[];
  kinds: string[];
  // old label -> new label ("" = removed). Lets the built-in starters follow a rename or deletion.
  aliases: { categories: Record<string, string>; kinds: Record<string, string> };
  hiddenStarters: string[];
}

export const MAX_LABELS = 40;

export const defaultSettings = (): TemplateSettings => ({
  categories: [...CATEGORIES],
  kinds: [...KINDS],
  aliases: { categories: {}, kinds: {} },
  hiddenStarters: [],
});

export function cleanLabel(raw: unknown): string {
  return (typeof raw === "string" ? raw : "").normalize("NFKC").replace(/[^A-Za-z0-9 &'/,.-]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// Follows renames/deletions so a built-in starter lands in the right place. Unknown or removed -> "".
export function resolveLabel(label: string, aliases: Record<string, string>, valid: string[]): string {
  let cur = label;
  for (let i = 0; i < 8; i++) {
    const hit = valid.find((v) => same(v, cur));
    if (hit) return hit;
    if (!(cur in aliases)) return "";
    cur = aliases[cur];
    if (!cur) return "";
  }
  return "";
}

// Reads whatever was stored and fills any gaps, so a half-written or older settings row never breaks the page.
export function normalizeSettings(raw: unknown): TemplateSettings {
  const d = defaultSettings();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return d;
  const r = raw as Record<string, any>;
  const list = (v: unknown, fallback: string[]) => {
    if (!Array.isArray(v)) return fallback;
    const out: string[] = [];
    for (const x of v.map(cleanLabel)) if (x && !out.some((o) => same(o, x))) out.push(x);
    return out.slice(0, MAX_LABELS);
  };
  const map = (v: unknown) => {
    const out: Record<string, string> = {};
    if (v && typeof v === "object" && !Array.isArray(v)) for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[cleanLabel(k)] = cleanLabel(val);
    return out;
  };
  return {
    categories: list(r.categories, d.categories),
    kinds: list(r.kinds, d.kinds),
    aliases: { categories: map(r.aliases?.categories), kinds: map(r.aliases?.kinds) },
    hiddenStarters: Array.isArray(r.hiddenStarters) ? r.hiddenStarters.filter((x: unknown): x is string => typeof x === "string").slice(0, 200) : [],
  };
}

export type Op =
  | { action: "add"; list: ListName; name: string }
  | { action: "rename"; list: ListName; from: string; to: string }
  | { action: "delete"; list: ListName; name: string }
  | { action: "hide"; id: string }
  | { action: "restore" };

export interface OpResult {
  settings: TemplateSettings;
  error?: string;
  // What the server must apply to saved templates: relabel (to === "" means clear the label).
  relabel?: { list: ListName; from: string; to: string };
}

export function applyOp(current: TemplateSettings, op: Op): OpResult {
  const s: TemplateSettings = JSON.parse(JSON.stringify(current));

  if (op.action === "hide") {
    if (!s.hiddenStarters.includes(op.id)) s.hiddenStarters.push(op.id);
    return { settings: s };
  }
  if (op.action === "restore") {
    s.hiddenStarters = [];
    return { settings: s };
  }

  const list = s[op.list];
  const aliases = s.aliases[op.list];

  if (op.action === "add") {
    const name = cleanLabel(op.name);
    if (!name) return { settings: current, error: "Type a name first (letters and numbers)." };
    if (list.some((x) => same(x, name))) return { settings: current, error: `"${name}" already exists.` };
    if (list.length >= MAX_LABELS) return { settings: current, error: `The limit is ${MAX_LABELS}.` };
    list.push(name);
    delete aliases[name]; // a name that comes back is a real entry again, not a leftover alias
    return { settings: s };
  }

  if (op.action === "rename") {
    const to = cleanLabel(op.to);
    const idx = list.findIndex((x) => x === op.from);
    if (idx === -1) return { settings: current, error: "That one doesn't exist." };
    if (!to) return { settings: current, error: "Type the new name first." };
    if (list.some((x, i) => i !== idx && same(x, to))) return { settings: current, error: `"${to}" already exists.` };
    list[idx] = to;
    aliases[op.from] = to;
    delete aliases[to];
    return { settings: s, relabel: { list: op.list, from: op.from, to } };
  }

  // delete
  const idx = list.findIndex((x) => x === op.name);
  if (idx === -1) return { settings: current, error: "That one doesn't exist." };
  list.splice(idx, 1);
  aliases[op.name] = "";
  return { settings: s, relabel: { list: op.list, from: op.name, to: "" } };
}

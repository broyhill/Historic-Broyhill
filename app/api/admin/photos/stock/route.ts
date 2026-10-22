import { NextResponse } from "next/server";
import { list, put } from "@vercel/blob";
import { MAX_PHOTO_BYTES, MAX_VIDEO_BYTES, KEEP_FILE, cleanFileName, cleanFolder, photoPath } from "@/lib/photos";
import { PROVIDERS, allowedFileUrl, providerKey, resolveFile, searchStock, type Provider, type StockKind } from "@/lib/stock";

export const maxDuration = 60;

const bad = (error: string, status = 400) => NextResponse.json({ error, ...(status === 503 ? { notConfigured: true } : {}) }, { status });
const isProvider = (v: unknown): v is Provider => PROVIDERS.some((p) => p.key === v);
const isKind = (v: unknown): v is StockKind => v === "photo" || v === "video" || v === "graphic";

// Which stock services have a key set (so the page can say what to add). Auth via /api/admin middleware.
// GET ?provider=&kind=&q=&page=  -> search results (thumbnails and credits only)
export async function GET(request: Request) {
  try {
    const u = new URL(request.url);
    if (u.searchParams.get("providers") === "1") {
      return NextResponse.json({ providers: PROVIDERS.map((p) => ({ key: p.key, label: p.label, env: p.env, kinds: p.kinds, ready: Boolean(providerKey(p.key)) })) });
    }
    const provider = u.searchParams.get("provider");
    const kind = u.searchParams.get("kind");
    const q = (u.searchParams.get("q") || "").trim();
    const page = Math.min(20, Math.max(1, Number(u.searchParams.get("page")) || 1));
    if (!isProvider(provider) || !isKind(kind)) return bad("Pick a source and a type.");
    const def = PROVIDERS.find((p) => p.key === provider)!;
    if (!def.kinds.includes(kind)) return bad(`${def.label} doesn't offer that type.`);
    if (!q) return bad("Type what you're looking for.");
    if (!providerKey(provider)) return bad(`Add ${def.env} in Vercel (free key), then redeploy.`, 503);
    return NextResponse.json({ items: await searchStock(provider, kind, q, page) });
  } catch (error: any) {
    return bad(error?.message || "Could not search.", 502);
  }
}

// POST { provider, kind, id, folder }: copies one item into the photo library (default folder by type:
// Stock Photos, Stock Videos or Stock Graphics).
// The file URL is looked up here from the id, never taken from the browser.
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return bad("Photo storage isn't connected yet.", 503);
  try {
    const b = await request.json().catch(() => ({}));
    if (!isProvider(b.provider) || !isKind(b.kind)) return bad("Pick a source and a type.");
    const def = PROVIDERS.find((p) => p.key === b.provider)!;
    if (!def.kinds.includes(b.kind)) return bad(`${def.label} doesn't offer that type.`);
    if (!providerKey(b.provider)) return bad(`Add ${def.env} in Vercel (free key), then redeploy.`, 503);
    const id = String(b.id || "");
    const folder = cleanFolder(b.folder) || (b.kind === "video" ? "Stock Videos" : b.kind === "graphic" ? "Stock Graphics" : "Stock Photos");

    const file = await resolveFile(b.provider, b.kind, id);
    if (!file || !allowedFileUrl(file.url)) return bad("That item isn't available any more.", 404);

    // Same item already in this folder? Skip rather than duplicate.
    const base = `${b.provider}-${id}`;
    // A bare prefix would also match longer ids that start with this one (pixabay-1234 vs pixabay-12345), so
    // look for the id followed by its filename boundary: "-" (title follows) or "." (extension follows).
    const [dash, dot] = await Promise.all([
      list({ prefix: `${photoPath(folder, base)}-`, limit: 1 }),
      list({ prefix: `${photoPath(folder, base)}.`, limit: 1 }),
    ]);
    const existing = dash.blobs[0] ?? dot.blobs[0];
    if (existing) return NextResponse.json({ success: true, already: true, url: existing.url });

    const res = await fetch(file.url);
    if (!res.ok || !res.body) return bad("Could not download that item. Try another.", 502);
    const cap = b.kind === "video" ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES;
    const size = Number(res.headers.get("content-length") || 0);
    if (size > cap) return bad("That file is larger than the library allows.", 413);

    const slug = file.title.normalize("NFKC").replace(/[^A-Za-z0-9 -]/g, "").trim().replace(/\s+/g, "-").slice(0, 40);
    const name = cleanFileName(`${base}${slug ? `-${slug}` : ""}.${file.ext}`);
    if (!name) return bad("Could not name that file.");

    // Make sure the folder exists (a folder is just a .keep marker or a photo in it).
    await put(photoPath(folder, KEEP_FILE), "", { access: "public", allowOverwrite: true, addRandomSuffix: false, contentType: "text/plain" });
    const blob = await put(photoPath(folder, name), res.body, { access: "public", addRandomSuffix: false, contentType: file.contentType });
    return NextResponse.json({ success: true, url: blob.url, folder, name });
  } catch (error: any) {
    console.error("stock import failed", error);
    return bad(error?.message || "Could not add that to the library.", 502);
  }
}

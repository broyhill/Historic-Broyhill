// Free stock media (photos, videos, graphics) from Pexels and Pixabay. Both licenses allow commercial use
// without credit; both ask that you not imply the people shown endorse you. Keys are free:
//   PEXELS_API_KEY  (pexels.com/api)    PIXABAY_API_KEY  (pixabay.com/api/docs)
// Searching returns thumbnails only. Importing looks the item up again by id on the server and copies the file
// into our own photo library, so the browser never supplies a download URL.

export type Provider = "pexels" | "pixabay";
export type StockKind = "photo" | "video" | "graphic";

export interface StockItem {
  provider: Provider; kind: StockKind; id: string;
  thumb: string; title: string; credit: string; creditUrl: string; pageUrl: string;
}
export interface StockFile { url: string; ext: string; contentType: string; title: string }

export const PROVIDERS: { key: Provider; label: string; env: string; kinds: StockKind[] }[] = [
  { key: "pixabay", label: "Pixabay", env: "PIXABAY_API_KEY", kinds: ["photo", "video", "graphic"] },
  // Pexels paused new API keys (Oct 2026). It only works if a key already exists, so it stays optional.
  { key: "pexels", label: "Pexels (only with an existing key)", env: "PEXELS_API_KEY", kinds: ["photo", "video"] },
];

export const providerKey = (p: Provider) => process.env[PROVIDERS.find((x) => x.key === p)!.env] || "";

// Downloads may only come from these hosts (what the two services serve files from).
const FILE_HOSTS = ["pexels.com", "pixabay.com", "vimeo.com", "vimeocdn.com"];
export function allowedFileUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && FILE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  } catch { return false; }
}

async function getJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 401 || res.status === 403) throw new Error("The stock service rejected the API key. Check it in Vercel.");
  if (res.status === 429) throw new Error("The stock service says too many requests. Wait a minute and try again.");
  if (!res.ok) throw new Error(`The stock service returned an error (${res.status}).`);
  return res.json();
}

const s = (v: unknown) => (typeof v === "string" ? v : "");

export async function searchStock(provider: Provider, kind: StockKind, q: string, page: number): Promise<StockItem[]> {
  const key = providerKey(provider);
  const query = encodeURIComponent(q.slice(0, 100));
  if (provider === "pexels") {
    const h = { Authorization: key };
    if (kind === "video") {
      const d = await getJson(`https://api.pexels.com/videos/search?query=${query}&per_page=24&page=${page}`, h);
      return (d.videos || []).map((v: any) => ({ provider, kind, id: String(v.id), thumb: s(v.image), title: `Video, ${Math.round(v.duration || 0)}s`, credit: s(v.user?.name), creditUrl: s(v.user?.url), pageUrl: s(v.url) }));
    }
    const d = await getJson(`https://api.pexels.com/v1/search?query=${query}&per_page=24&page=${page}`, h);
    return (d.photos || []).map((p: any) => ({ provider, kind, id: String(p.id), thumb: s(p.src?.medium), title: s(p.alt) || "Photo", credit: s(p.photographer), creditUrl: s(p.photographer_url), pageUrl: s(p.url) }));
  }
  // Pixabay
  if (kind === "video") {
    const d = await getJson(`https://pixabay.com/api/videos/?key=${key}&q=${query}&per_page=24&page=${page}&safesearch=true`);
    return (d.hits || []).map((v: any) => ({ provider, kind, id: String(v.id), thumb: `https://i.vimeocdn.com/video/${v.picture_id}_295x166.jpg`, title: s(v.tags) || "Video", credit: s(v.user), creditUrl: `https://pixabay.com/users/${s(v.user)}-${v.user_id}/`, pageUrl: s(v.pageURL) }));
  }
  const type = kind === "graphic" ? "illustration" : "photo";
  const d = await getJson(`https://pixabay.com/api/?key=${key}&q=${query}&image_type=${type}&per_page=24&page=${page}&safesearch=true`);
  return (d.hits || []).map((p: any) => ({ provider, kind, id: String(p.id), thumb: s(p.webformatURL), title: s(p.tags) || "Image", credit: s(p.user), creditUrl: `https://pixabay.com/users/${s(p.user)}-${p.user_id}/`, pageUrl: s(p.pageURL) }));
}

// Finds the file to copy for one item. Photos use a web-size version (about 1300-1900 px wide); videos use
// the best MP4 up to 1080p. Returns null if the item is gone or has no usable file.
export async function resolveFile(provider: Provider, kind: StockKind, id: string): Promise<StockFile | null> {
  if (!/^\d{1,12}$/.test(id)) return null;
  const key = providerKey(provider);
  if (provider === "pexels") {
    const h = { Authorization: key };
    if (kind === "video") {
      const v = await getJson(`https://api.pexels.com/videos/videos/${id}`, h);
      const files = (v.video_files || []).filter((f: any) => f.file_type === "video/mp4" && f.link && (f.height || 0) <= 1080).sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
      return files[0] ? { url: files[0].link, ext: "mp4", contentType: "video/mp4", title: "pexels video" } : null;
    }
    const p = await getJson(`https://api.pexels.com/v1/photos/${id}`, h);
    const url = s(p.src?.large2x) || s(p.src?.large);
    return url ? { url, ext: "jpg", contentType: "image/jpeg", title: s(p.alt) } : null;
  }
  if (kind === "video") {
    const d = await getJson(`https://pixabay.com/api/videos/?key=${key}&id=${id}`);
    const v = d.hits?.[0]?.videos;
    const url = s(v?.large?.url) || s(v?.medium?.url) || s(v?.small?.url);
    return url ? { url, ext: "mp4", contentType: "video/mp4", title: s(d.hits[0].tags) } : null;
  }
  const d = await getJson(`https://pixabay.com/api/?key=${key}&id=${id}`);
  const hit = d.hits?.[0];
  const url = s(hit?.largeImageURL) || s(hit?.webformatURL);
  if (!url) return null;
  const ext = /\.png(\?|$)/i.test(url) ? "png" : "jpg";
  return { url, ext, contentType: ext === "png" ? "image/png" : "image/jpeg", title: s(hit.tags) };
}

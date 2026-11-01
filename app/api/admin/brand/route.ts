import { NextResponse } from "next/server";
import { brandFromHtml, httpUrl, normalizeBrand } from "@/lib/brand";
import { loadBrand, saveBrand } from "@/lib/brand-settings";

export const maxDuration = 30;

// GET: the saved brand kit. POST {action:"pull", website}: read the home page and propose a kit (nothing
// saved). POST {action:"save", brand, confirmed}: save what the person approved. Auth via /api/admin middleware.
export async function GET() {
  try { return NextResponse.json({ success: true, brand: await loadBrand() }); }
  catch (error: any) { console.error("brand load failed", error); return NextResponse.json({ error: "Could not load the brand kit." }, { status: 500 }); }
}

const BLOCKED_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[::1\]|169\.254\.)/i;

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}));
    if (b.action === "pull") {
      let site = typeof b.website === "string" ? b.website.trim() : "";
      if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`;
      const url = httpUrl(site);
      if (!url) return NextResponse.json({ error: "Enter the website address, like broyhill.net." }, { status: 400 });
      const host = new URL(url).hostname;
      if (BLOCKED_HOST.test(host) || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return NextResponse.json({ error: "That doesn't look like a website address. Try something like broyhill.net." }, { status: 400 });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      let res: Response;
      try {
        res = await fetch(url, {
          redirect: "follow", signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 HistoricBroyhillBrandKit/1.0", Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" },
        });
      } finally { clearTimeout(timer); }
      if (!res.ok) return NextResponse.json({ error: `The site answered ${res.status}. Check the address or fill the details in by hand.` }, { status: 502 });
      const html = (await res.text()).slice(0, 2_000_000);
      const brand = brandFromHtml(html, res.url || url);
      const found = [brand.logoUrl && "logo", brand.name && "name", brand.address.line1 && "address", brand.phone && "phone", brand.email && "email", Object.values(brand.socials).some(Boolean) && "social links"].filter(Boolean);
      return NextResponse.json({ success: true, brand, found });
    }
    if (b.action === "save") {
      const brand = normalizeBrand(b.brand);
      if (!brand.name) return NextResponse.json({ error: "Give the business a name." }, { status: 400 });
      brand.confirmedAt = b.confirmed ? new Date().toISOString() : null;
      try { await saveBrand(brand); }
      catch (error) { console.error("brand save failed", error); return NextResponse.json({ error: "Could not save the brand kit (database not reachable). Your edits are still on screen." }, { status: 500 }); }
      return NextResponse.json({ success: true, brand });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error: any) {
    const aborted = error?.name === "AbortError";
    console.error("brand route failed", error);
    return NextResponse.json({ error: aborted ? "The site took too long to answer." : "Could not read that site." }, { status: aborted ? 504 : 500 });
  }
}

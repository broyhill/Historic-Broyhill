import { prisma } from "@/lib/prisma";
import { brandFromHtml, httpUrl, normalizeBrand, type BrandKit } from "@/lib/brand";

// Agency spine: one row in BusinessProfile per client brand. The brand kit travels on
// designTokens; leads, campaigns and pages already key off businessId, so every silo
// falls out of the relation for free. 'broyhill-01' is the house brand.
export const HOUSE_BRAND = "broyhill-01";

export interface BrandRow {
  id: string;
  businessName: string;
  industry: string;
  website: string;
  brand: BrandKit;
  leads: number;
  campaigns: number;
  createdAt: string;
}

export async function listBrands(): Promise<BrandRow[]> {
  const rows = await prisma.businessProfile.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { leads: true, campaigns: true } } },
  });
  return rows.map((r) => {
    const brand = normalizeBrand(r.designTokens);
    return {
      id: r.id,
      businessName: r.businessName,
      industry: r.industry,
      website: brand.website || r.referenceUrls[0] || "",
      brand,
      leads: r._count.leads,
      campaigns: r._count.campaigns,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

const BLOCKED_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[::1\]|169\.254\.)/i;

// Same pull the Brand setup page uses: fetch the home page, lift the kit.
export async function pullBrandFromUrl(website: string): Promise<BrandKit> {
  let site = website.trim();
  if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`;
  const url = httpUrl(site);
  if (!url) throw new Error("Enter the website address, like broyhill.net.");
  const host = new URL(url).hostname;
  if (BLOCKED_HOST.test(host) || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host))
    throw new Error("That doesn't look like a website address. Try something like broyhill.net.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 HistoricBroyhillBrandKit/1.0",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`The site answered ${res.status}. Check the address or fill the details in by hand.`);
  const html = (await res.text()).slice(0, 2_000_000);
  return brandFromHtml(html, res.url || url);
}

export async function createBrand({ name, website }: { name: string; website: string }): Promise<BrandRow> {
  const brand = await pullBrandFromUrl(website);
  if (!brand.name) brand.name = name.trim();
  if (!brand.name) throw new Error("Give the brand a name.");
  brand.confirmedAt = new Date().toISOString();
  const row = await prisma.businessProfile.create({
    data: {
      businessName: brand.name,
      industry: "",
      referenceUrls: brand.website ? [brand.website] : [],
      designTokens: brand as unknown as object,
    },
    include: { _count: { select: { leads: true, campaigns: true } } },
  });
  return {
    id: row.id,
    businessName: row.businessName,
    industry: row.industry,
    website: brand.website,
    brand,
    leads: 0,
    campaigns: 0,
    createdAt: row.createdAt.toISOString(),
  };
}

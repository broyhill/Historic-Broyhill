"use client";
import React, { useCallback, useEffect, useState } from "react";

// Agency spine v1: every client brand is its own silo — kit, leads, pages and sends
// scoped to it. The house brand (broyhill-01) is first-class too.
interface BrandRow {
  id: string;
  businessName: string;
  industry: string;
  website: string;
  leads: number;
  campaigns: number;
  createdAt: string;
  brand: {
    name: string;
    tagline: string;
    logoUrl: string;
    website: string;
    colors: { primary: string; secondary: string; background: string };
    confirmedAt: string | null;
  };
}

export default function BrandsPanel() {
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/brands", { cache: "no-store" });
      if (res.status === 401) { window.location.assign("/admin/login"); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load the brands.");
      setBrands(data.brands || []);
    } catch (e: any) {
      setError(e.message || "Could not load the brands.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!website.trim() || adding) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/admin/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, website }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add that brand.");
      setName("");
      setWebsite("");
      await load();
    } catch (e: any) {
      setError(e.message || "Could not add that brand.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Brands</h2>
          <p className="text-xs text-subtle mt-0.5">
            Every client is its own silo — its brand kit, leads, pages and sends stay scoped to it. Add a brand by dropping its website; the kit lifts itself.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Client name (optional — we'll read it off the site)"
            className="ins-input flex-1 rounded-md px-3 py-2.5 text-sm"
          />
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="clientwebsite.com"
            className="ins-input flex-1 rounded-md px-3 py-2.5 text-sm"
          />
          <button
            type="button"
            onClick={add}
            disabled={adding || !website.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-accent text-white rounded-md text-xs font-semibold hover:bg-accent-deep transition whitespace-nowrap disabled:opacity-60"
          >
            {adding ? "Reading the site…" : "Add brand"}
          </button>
        </div>
        {error && <div className="rounded-md border border-danger bg-danger-tint px-3 py-2.5 text-xs text-danger">{error}</div>}
      </div>

      {loading ? (
        <div className="text-xs text-subtle py-8 text-center">Loading brands…</div>
      ) : brands.length === 0 ? (
        <div className="text-xs text-subtle py-8 text-center">No brands yet — add the first client above.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {brands.map((b) => (
            <div key={b.id} className="rounded-lg border border-line bg-white p-4 space-y-3">
              <div className="flex items-start gap-3">
                {b.brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.brand.logoUrl} alt="" className="h-9 w-9 rounded object-contain border border-line bg-canvas shrink-0" />
                ) : (
                  <div
                    className="h-9 w-9 rounded border border-line shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                    style={{ background: b.brand.colors.primary }}
                  >
                    {b.businessName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{b.businessName}</div>
                  {b.brand.tagline && <div className="text-[11px] text-subtle truncate">{b.brand.tagline}</div>}
                </div>
              </div>
              <div className="flex items-center gap-1.5" title="Brand palette">
                {[b.brand.colors.primary, b.brand.colors.secondary, b.brand.colors.background].map((c, i) => (
                  <span key={i} className="h-4 w-4 rounded-full border border-line" style={{ background: c }} />
                ))}
                <span className="text-[10px] text-subtle ml-1">{b.brand.confirmedAt ? "kit confirmed" : "kit draft"}</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-subtle">
                <span><span className="font-semibold text-ink">{b.leads}</span> leads</span>
                <span><span className="font-semibold text-ink">{b.campaigns}</span> campaigns</span>
                {b.website && (
                  <a href={b.website} target="_blank" rel="noreferrer" className="text-info hover:underline truncate ml-auto">
                    site ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

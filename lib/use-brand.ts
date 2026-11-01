"use client";
import { useEffect, useState } from "react";
import { emptyBrand, normalizeBrand, type BrandKit } from "@/lib/brand";

let cached: BrandKit | null = null;
let inflight: Promise<BrandKit> | null = null;
// The confirmed brand kit, fetched once per page load and shared by every panel that renders examples.
export function useBrand(): BrandKit {
  const [brand, setBrand] = useState<BrandKit>(cached ?? emptyBrand());
  useEffect(() => {
    if (cached) { setBrand(cached); return; }
    inflight ??= fetch("/api/admin/brand").then((r) => (r.ok ? r.json() : null)).then((d) => (cached = normalizeBrand(d?.brand))).catch(() => emptyBrand());
    let live = true; inflight.then((b) => { if (live) setBrand(b); });
    return () => { live = false; };
  }, []);
  return brand;
}
export const resetBrandCache = () => { cached = null; inflight = null; };

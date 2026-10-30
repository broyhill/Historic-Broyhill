"use client";

import React, { useEffect, useState } from "react";
import { BUSINESS_TYPES, INDUSTRIES, SOCIAL_KEYS, brandAddressLine, emptyBrand, type BrandKit } from "@/lib/brand";

const inputCls = "w-full rounded-md border border-line px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-accent min-h-[44px]";
const lbl = "block text-[12px] font-semibold text-muted";
const btnPrimary = "min-h-[44px] px-5 rounded-md bg-accent-deep text-white text-[14px] font-semibold hover:bg-navy disabled:opacity-50";
const btnGhost = "min-h-[44px] px-4 rounded-md border border-line text-muted text-[14px] hover:border-accent/50 hover:text-ink disabled:opacity-50";
const SOCIAL_LABEL: Record<(typeof SOCIAL_KEYS)[number], string> = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", x: "X (Twitter)", youtube: "YouTube", tiktok: "TikTok" };

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (res.status === 401) { window.location.assign("/admin/login"); throw new Error("Signed out"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// Mailchimp-style setup: type the website, we read the brand, the person checks "does this match?",
// fixes anything, confirms, and from then on every example and AI draft uses it.
export default function BrandPanel() {
  const [brand, setBrand] = useState<BrandKit>(emptyBrand());
  const [site, setSite] = useState("");
  const [found, setFound] = useState<string[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    call("/api/admin/brand").then((d) => { setBrand(d.brand); setSite(d.brand.website); }).catch((e) => setError(e.message));
  }, []);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setError(""); setNotice("");
    try { await fn(); } catch (e: any) { setError(e.message || "Something went wrong."); } finally { setBusy(null); }
  };
  const pull = () => run("pull", async () => {
    const d = await call("/api/admin/brand", post({ action: "pull", website: site }));
    setBrand({ ...d.brand, industry: brand.industry || d.brand.industry, businessType: brand.businessType || d.brand.businessType });
    setFound(d.found); setDirty(true);
    setNotice(d.found.length ? `Read the site. Found: ${d.found.join(", ")}. Check it on the right, fix anything, then confirm.` : "Read the site but found little to go on. Fill the details in by hand, then confirm.");
  });
  const save = (confirmed: boolean) => run(confirmed ? "confirm" : "save", async () => {
    const d = await call("/api/admin/brand", post({ action: "save", brand, confirmed }));
    setBrand(d.brand); setDirty(false);
    setNotice(confirmed ? "Brand confirmed. Examples, the Studio and the AI drafts now use it." : "Saved as a draft. Confirm when it looks right.");
  });
  const set = (patch: Partial<BrandKit>) => { setBrand((b) => ({ ...b, ...patch })); setDirty(true); };
  const setAddr = (patch: Partial<BrandKit["address"]>) => set({ address: { ...brand.address, ...patch } });
  const setColor = (k: keyof BrandKit["colors"], v: string) => set({ colors: { ...brand.colors, [k]: v } });
  const setSocial = (k: (typeof SOCIAL_KEYS)[number], v: string) => set({ socials: { ...brand.socials, [k]: v } });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <div className="space-y-5">
        <div>
          <h2 className="text-[24px] text-ink leading-tight">You've got a head start on your setup</h2>
          <p className="text-[14px] text-muted mt-1">Type the website and we'll read the logo, colors, fonts, address and social links. Edit anything; it shapes every email, text, post and video from day one.</p>
        </div>

        <section className="ibox">
          <div className="ibox-title"><h3 className="text-sm font-semibold text-ink">Website</h3>{brand.confirmedAt && <span className="text-[12px] text-success">Confirmed {new Date(brand.confirmedAt).toLocaleDateString()}</span>}</div>
          <div className="ibox-content">
            <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); pull(); }}>
              <input className={inputCls} placeholder="broyhill.net" value={site} onChange={(e) => setSite(e.target.value)} aria-label="Website address" inputMode="url" />
              <button type="submit" className={btnPrimary} disabled={busy !== null || !site.trim()}>{busy === "pull" ? "Reading…" : "Read the site"}</button>
            </form>
            {found && found.length === 0 && <p className="mt-2 text-[12.5px] text-warn">Nothing recognizable on the home page. Fill the fields below in by hand.</p>}
          </div>
        </section>

        <section className="ibox">
          <div className="ibox-title"><h3 className="text-sm font-semibold text-ink">Company info</h3></div>
          <div className="ibox-content grid gap-3 sm:grid-cols-2">
            <label className={`${lbl} sm:col-span-2`}>Business name<input className={`${inputCls} mt-1 font-normal`} value={brand.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} /></label>
            <label className={`${lbl} sm:col-span-2`}>One line about the business<input className={`${inputCls} mt-1 font-normal`} value={brand.tagline} onChange={(e) => set({ tagline: e.target.value })} maxLength={200} /></label>
            <label className={`${lbl} sm:col-span-2`}>Address line 1 <span className="text-danger">*</span><input className={`${inputCls} mt-1 font-normal`} value={brand.address.line1} onChange={(e) => setAddr({ line1: e.target.value })} /></label>
            <label className={`${lbl} sm:col-span-2`}>Address line 2<input className={`${inputCls} mt-1 font-normal`} value={brand.address.line2} onChange={(e) => setAddr({ line2: e.target.value })} placeholder="Suite, unit…" /></label>
            <label className={lbl}>City <span className="text-danger">*</span><input className={`${inputCls} mt-1 font-normal`} value={brand.address.city} onChange={(e) => setAddr({ city: e.target.value })} /></label>
            <label className={lbl}>State <span className="text-danger">*</span><input className={`${inputCls} mt-1 font-normal`} value={brand.address.state} onChange={(e) => setAddr({ state: e.target.value })} maxLength={40} /></label>
            <label className={lbl}>Zip code <span className="text-danger">*</span><input className={`${inputCls} mt-1 font-normal`} value={brand.address.zip} onChange={(e) => setAddr({ zip: e.target.value })} maxLength={20} /></label>
            <label className={lbl}>Phone<input className={`${inputCls} mt-1 font-normal`} value={brand.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" /></label>
            <label className={`${lbl} sm:col-span-2`}>Email<input className={`${inputCls} mt-1 font-normal`} value={brand.email} onChange={(e) => set({ email: e.target.value })} inputMode="email" /></label>
            <p className="sm:col-span-2 text-[12px] text-subtle">To follow anti-spam law, the address appears in the footer of every email we send.</p>
            <label className={lbl}>Industry
              <select className={`${inputCls} mt-1 font-normal`} value={brand.industry} onChange={(e) => set({ industry: e.target.value })}><option value="">Choose…</option>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</select></label>
            <label className={lbl}>Business type
              <select className={`${inputCls} mt-1 font-normal`} value={brand.businessType} onChange={(e) => set({ businessType: e.target.value })}><option value="">Choose…</option>{BUSINESS_TYPES.map((i) => <option key={i}>{i}</option>)}</select></label>
          </div>
        </section>

        <section className="ibox">
          <div className="ibox-title"><h3 className="text-sm font-semibold text-ink">Social media</h3><span className="text-[12px] text-subtle">Posts and examples link here</span></div>
          <div className="ibox-content grid gap-3 sm:grid-cols-2">
            {SOCIAL_KEYS.map((k) => (
              <label key={k} className={lbl}>{SOCIAL_LABEL[k]}<input className={`${inputCls} mt-1 font-normal`} value={brand.socials[k]} onChange={(e) => setSocial(k, e.target.value)} placeholder={`https://${k === "x" ? "x" : k}.com/…`} inputMode="url" /></label>
            ))}
          </div>
        </section>

        <section className="ibox">
          <div className="ibox-title"><h3 className="text-sm font-semibold text-ink">Look</h3></div>
          <div className="ibox-content grid gap-3 sm:grid-cols-3">
            {(["primary", "secondary", "background"] as const).map((k) => (
              <label key={k} className={lbl}>{k === "primary" ? "Main color" : k === "secondary" ? "Accent color" : "Page color"}
                <span className="mt-1 flex items-center gap-2"><input type="color" className="h-11 w-14 rounded-md border border-line" value={brand.colors[k]} onChange={(e) => setColor(k, e.target.value)} aria-label={`${k} color`} /><input className={`${inputCls} font-normal font-mono`} value={brand.colors[k]} onChange={(e) => setColor(k, e.target.value)} maxLength={7} /></span></label>
            ))}
            <label className={lbl}>Heading font<input className={`${inputCls} mt-1 font-normal`} value={brand.fonts.heading} onChange={(e) => set({ fonts: { ...brand.fonts, heading: e.target.value } })} /></label>
            <label className={lbl}>Body font<input className={`${inputCls} mt-1 font-normal`} value={brand.fonts.body} onChange={(e) => set({ fonts: { ...brand.fonts, body: e.target.value } })} /></label>
            <label className={lbl}>Logo (web address)<input className={`${inputCls} mt-1 font-normal`} value={brand.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} inputMode="url" /></label>
          </div>
        </section>

        {error && <p className="text-[13px] text-danger" role="alert">{error}</p>}
        {notice && !error && <p className="text-[13px] text-success">{notice}</p>}
        <div className="flex flex-wrap gap-2">
          <button className={btnPrimary} disabled={busy !== null || !brand.name.trim()} onClick={() => save(true)}>{busy === "confirm" ? "Saving…" : "Looks good — use this brand"}</button>
          <button className={btnGhost} disabled={busy !== null || !dirty} onClick={() => save(false)}>{busy === "save" ? "Saving…" : "Save for later"}</button>
        </div>
      </div>

      {/* Does this match your brand? */}
      <aside className="lg:sticky lg:top-4 self-start">
        <div className="rounded-2xl bg-info-tint p-6">
          <div className="mx-auto max-w-[380px] rounded-2xl bg-white shadow-sm overflow-hidden" style={{ fontFamily: `'${brand.fonts.body}', system-ui, sans-serif` }}>
            <div className="p-6 text-center" style={{ background: brand.colors.background }}>
              {brand.logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={brand.logoUrl} alt={`${brand.name || "Business"} logo`} className="mx-auto max-h-16 max-w-[220px] object-contain" />
                : <div className="mx-auto h-16 w-40 rounded bg-line/70" aria-hidden />}
              <div className="mt-3 text-[18px] text-ink" style={{ fontFamily: `'${brand.fonts.heading}', Georgia, serif` }}>{brand.name || "Your business"}</div>
              {brand.tagline && <div className="mt-1 text-[12.5px] text-muted line-clamp-2">{brand.tagline}</div>}
            </div>
            <div className="p-5 space-y-3">
              <div className="h-36 rounded-lg bg-line/60" aria-hidden />
              <div className="flex gap-2"><div className="h-3 flex-1 rounded bg-line/60" /><div className="h-3 flex-1 rounded bg-line/60" /></div>
              <div className="h-10 rounded-md text-center text-[13px] font-semibold text-white flex items-center justify-center" style={{ background: brand.colors.secondary }}>Book a visit</div>
              <div className="border-t border-line pt-3 flex justify-center gap-3">
                {SOCIAL_KEYS.filter((k) => brand.socials[k]).slice(0, 4).map((k) => <span key={k} className="h-8 w-8 rounded-full text-[10px] font-bold text-white flex items-center justify-center" style={{ background: brand.colors.primary }} title={SOCIAL_LABEL[k]}>{SOCIAL_LABEL[k][0]}</span>)}
                {SOCIAL_KEYS.every((k) => !brand.socials[k]) && [0, 1, 2].map((i) => <span key={i} className="h-8 w-8 rounded-full bg-line/60" aria-hidden />)}
              </div>
              <div className="text-center text-[12px] text-muted leading-relaxed" style={{ fontFamily: `'${brand.fonts.heading}', Georgia, serif` }}>
                {brandAddressLine(brand) || "Address appears here"}<br />{brand.phone}{brand.phone && brand.website ? " · " : ""}{brand.website.replace(/^https?:\/\//, "")}
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-[14px] text-ink">Does this match your brand?</p>
          <div className="mt-2 flex justify-center gap-2">
            <button className={btnPrimary} disabled={busy !== null || !brand.name.trim()} onClick={() => save(true)} aria-label="Yes, this matches">Yes</button>
            <button className={btnGhost} onClick={() => { setNotice("Fix the fields on the left, then press Yes."); }} aria-label="No, let me fix it">Not quite</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

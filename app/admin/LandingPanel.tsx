"use client";

import { useEffect, useState } from "react";

type Audience = { key: string; count: number };
type Template = { slug: string; title: string; source: string; categories: string[]; audience: string };
type Draft = { id: string; status: string; createdAt: string; metrics: any };

export default function LandingPanel() {
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [audience, setAudience] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; html: string } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/admin/landing").then((r) => r.json()).then((d) => setAudiences(d.audiences ?? [])).catch(() => {});
    fetch("/api/admin/landing?drafts=1").then((r) => r.json()).then((d) => setDrafts(d.drafts ?? [])).catch(() => {});
  }, []);

  const pickAudience = async (key: string) => {
    setAudience(key); setTemplates([]); setErr("");
    const d = await fetch(`/api/admin/landing?audience=${encodeURIComponent(key)}`).then((r) => r.json()).catch(() => null);
    setTemplates(d?.templates ?? []);
  };

  const compose = async (slug: string) => {
    setBusy(slug); setErr("");
    const res = await fetch("/api/admin/landing", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, notes }),
    });
    const d = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok || !d?.success) { setErr(d?.error || "Compose failed. Try again."); return; }
    setPreview({ id: d.id, html: d.html });
    setDrafts((ds) => [{ id: d.id, status: "PENDING_REVIEW", createdAt: new Date().toISOString(), metrics: {} }, ...ds]);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-lg text-navy">Audiences</h2>
          <p className="text-[12px] text-muted">Pick who the page is for — the catalog holds 1,342 venue-tagged templates.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {audiences.map((a) => (
            <button key={a.key} onClick={() => pickAudience(a.key)}
              className={`px-3 py-1.5 rounded-full text-[12px] border ${audience === a.key ? "bg-navy text-cream border-navy" : "bg-white text-ink border-line hover:border-navy"}`}>
              {a.key} <span className="opacity-60">({a.count})</span>
            </button>
          ))}
        </div>
        <div>
          <label className="text-[12px] font-semibold text-ink">Extra direction (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="e.g. push December weddings, mention the Magnolia Room"
            className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]" />
        </div>
        {drafts.length > 0 && (
          <div>
            <h3 className="text-[12px] font-semibold text-ink mb-1">Composed drafts</h3>
            <ul className="text-[12px] text-muted space-y-1">
              {drafts.slice(0, 8).map((d) => (
                <li key={d.id}>{d.status} · {new Date(d.createdAt).toLocaleDateString()}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        {err && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{err}</div>}
        {preview ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-lg text-navy">Draft preview — saved to Review Queue</h2>
              <button onClick={() => setPreview(null)} className="text-[12px] text-muted underline">Back to catalog</button>
            </div>
            <iframe title="Composed landing page" srcDoc={preview.html}
              className="w-full h-[70vh] rounded-lg border border-line bg-white" sandbox="allow-scripts" />
          </div>
        ) : audience ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => (
              <div key={t.slug} className="rounded-lg border border-line bg-white p-3 flex flex-col">
                <div className="text-[13px] font-semibold text-ink leading-snug">{t.title}</div>
                <div className="text-[11px] text-muted mt-1">{t.categories.slice(0, 3).join(" · ")}</div>
                <div className="mt-auto pt-3 flex gap-2">
                  <a href={t.source} target="_blank" rel="noreferrer" className="text-[12px] text-muted underline">Source</a>
                  <button onClick={() => compose(t.slug)} disabled={busy === t.slug}
                    className="ml-auto rounded-md bg-gold px-3 py-1.5 text-[12px] font-semibold text-navy-deep disabled:opacity-50">
                    {busy === t.slug ? "Composing…" : "Compose"}
                  </button>
                </div>
              </div>
            ))}
            {!templates.length && <p className="text-[13px] text-muted">Loading templates…</p>}
          </div>
        ) : (
          <p className="text-[13px] text-muted">Pick an audience on the left to see its templates.</p>
        )}
      </div>
    </div>
  );
}

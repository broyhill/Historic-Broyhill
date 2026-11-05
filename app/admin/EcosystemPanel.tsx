"use client";

import React, { useCallback, useEffect, useState } from "react";

export type EcoDef = {
  key: string;
  title: string;
  what: string;
  feeds: string;
  live: boolean;
  control?: boolean; // on/off switch actually gates an engine (default: live && true)
  variant?: Variant; // which layout body this panel renders
};

type Variant = "table" | "feed" | "timeline" | "grid" | "benchmarks" | "funnel" | "cycle" | "plan" | "sent" | "catalog";

// The Wizard-of-Oz brain, one ecosystem per organ — plus the channel
// ecosystems (email, texting) it sends through. `live` means the engine
// exists today; standing-architecture organs show their build spec honestly.
export const ECOSYSTEMS: EcoDef[] = [
  { key: "competitors", title: "Competitive analysis", variant: "table", what: "Reads Meta's public Ad Library for each competitor in the library — every live ad, how long it's run (duration is the signal it's paying for itself), format and offer.", feeds: "Marketing Library → Competitors · Meta token (Connections)", live: true },
  { key: "reviews", title: "Review monitoring", variant: "feed", what: "Sweeps Google Places for new reviews; each lands in Needs-you with a drafted reply. (Facebook/WeddingWire/The Knot connectors: planned.)", feeds: "GOOGLE_PLACES_API_KEY + GOOGLE_PLACE_ID", live: true },
  { key: "news", title: "Local life events", variant: "timeline", what: "Scans the 30-mile local papers for engagement and wedding announcements — warm leads before they search venues.", feeds: "Marketing Library → watch-sources (5 feeds live)", live: true },
  { key: "monitoring", title: "Ad monitoring", variant: "grid", what: "Standing feed of saved competitors' active creative and offers with one-click patterns to clone into your own ads.", feeds: "Marketing Library → Ad snapshots", live: false },
  { key: "market", title: "Market analysis", variant: "benchmarks", what: "Venue-market benchmarks so the weekly card scores you against your niche — occupancy, inquiry rates, seasonal demand.", feeds: "Marketing Library → Market benchmarks", live: false },
  { key: "tripwire", title: "Tripwire measurement", variant: "funnel", what: "The ternary chain — ad → landing → email → text → inquiry → tour → booking — measured as one attributed wire so the weekly card says which wire tripped.", feeds: "/api/capture touch records", live: false },
  { key: "ad-loop", title: "Ad loop", variant: "cycle", what: "Plan → create → launch → test → reallocate, daily, on the connected Meta account.", feeds: "Connections → Meta", live: false },
  { key: "annual-plan", title: "Annual plan", variant: "plan", what: "The one-year marketing calendar keyed to real venue seasons, plus the Friday weekly-justification card — every action vs plan.", feeds: "Marketing Library → all folders", live: false },
  { key: "email", title: "Email", variant: "sent", what: "Outbound rail for journeys and broadcasts — SendGrid first, Resend fallback, honest staged drafts when neither is configured.", feeds: "SENDGRID_API_KEY (set) · EMAIL_FROM (needed)", live: true },
  { key: "texting", title: "Texting", variant: "sent", what: "Outbound rail for journey texts — Twilio REST, staged for a human when the lead has no phone on file.", feeds: "TWILIO_ACCOUNT_SID / TOKEN / FROM (set)", live: true },
  { key: "templates", title: "Email templates", variant: "catalog", control: false, what: "The template catalog the composer draws from — journeys assemble from live rows, seeded bodies only fill empty templates.", feeds: "DbTemplate rows + Email studio", live: true },
];

type Finding = { id: string; status: string; suggestedDraft: string; createdAt: string };
type LibRow = { id: string; folder: string; title: string; data: any };
type EcoState = { enabled: boolean; lastRun: any; counts: Record<string, number>; findings: Finding[]; library?: LibRow[]; connections?: { id: string; vendor: string; status: string; meta: any }[] };

const STATUS_BADGE: Record<string, string> = {
  PENDING_REVIEW: "bg-amber-50 text-amber-700",
  APPROVED: "bg-sky-50 text-sky-700",
  PUBLISHED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-700",
};

export default function EcosystemPanel({ eco }: { eco: EcoDef }) {
  const [state, setState] = useState<EcoState | null>(null);
  const [tab, setTab] = useState<"findings" | "log">("findings");

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/ecosystem?key=${eco.key}`);
    if (r.ok) setState(await r.json());
  }, [eco.key]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  async function toggle() {
    if (!state) return;
    await fetch("/api/admin/ecosystem", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: eco.key, enabled: !state.enabled }),
    });
    load().catch(() => {});
  }

  const lastRun = state?.lastRun as any;
  const counts = state?.counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const pending = counts.PENDING_REVIEW ?? 0;
  const published = counts.PUBLISHED ?? 0;

  return (
    <div className="max-w-4xl space-y-4">
      {/* header band */}
      <div className="ibox p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="hb-display text-[22px] text-ink">{eco.title}</h3>
            <p className="text-[14px] text-muted mt-1 leading-relaxed">{eco.what}</p>
            <p className="text-[12px] text-muted mt-2">Reads from: {eco.feeds}</p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${eco.live ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {eco.live ? "Engine live" : "Standing architecture"}
          </span>
        </div>
        {eco.live && state && (
          <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
            {eco.control === false ? (
              <span className="rounded-full px-4 py-1.5 text-[12px] font-semibold bg-gray-100 text-muted">Always on — opens the Templates tool</span>
            ) : null}
            {eco.control !== false && (
              <button
                type="button"
                onClick={toggle}
                className={`rounded-full px-4 py-1.5 text-[12px] font-semibold ${state.enabled ? "bg-accent text-white" : "border border-line text-muted"}`}
              >
                {state.enabled ? "On" : "Off"}
              </button>
            )}
            {lastRun ? (
              <p className="text-[13px] text-muted">
                Last run {new Date(lastRun.at).toLocaleString()}: pulled {lastRun.pulled}
                {lastRun.note ? ` — ${lastRun.note}` : ""}
              </p>
            ) : (
              <p className="text-[13px] text-muted">Ready — runs on the daily sweep (14:00 UTC).</p>
            )}

          </div>
        )}
      </div>

      {/* stat cards */}
      {eco.live && (
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Findings filed", total],
            ["Awaiting you", pending],
            ["Published / used", published],
          ].map(([label, n]) => (
            <div key={String(label)} className="ibox p-4 text-center">
              <p className="text-[26px] font-bold text-ink leading-none">{n as number}</p>
              <p className="text-[11px] uppercase tracking-wide text-muted mt-1.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* per-ecosystem body — one real widget per organ, not one shared template */}
      <VariantBody eco={eco} state={state} />

      {/* tabs */}
      {eco.live && state && (
        <div className="ibox p-5">
          <div className="flex gap-1 border-b border-line">
            {(["findings", "log"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-[13px] font-semibold border-b-2 -mb-px ${tab === t ? "border-accent text-ink" : "border-transparent text-muted"}`}
              >
                {t === "findings" ? `Findings feed (${total > 25 ? "latest 25 of " : ""}${total})` : "Run log"}
              </button>
            ))}
          </div>

          {tab === "findings" && (
            <ul className="divide-y divide-line">
              {state.findings.length === 0 && (
                <li className="py-6 text-center text-[13px] text-muted">Nothing yet — findings file here and in Needs-you when pulled.</li>
              )}
              {state.findings.map((f) => {
                const subject = f.suggestedDraft.match(/^Subject: (.*)$/m)?.[1] ?? "Finding";
                const body = f.suggestedDraft.split("\n\n").slice(1).join(" ");
                return (
                  <li key={f.id} className="py-3 flex items-start gap-3">
                    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_BADGE[f.status] ?? "bg-gray-50 text-gray-600"}`}>
                      {f.status.replace("_", " ")}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink">{subject}</p>
                      <p className="text-[12px] text-muted mt-0.5 line-clamp-2">{body}</p>
                      <p className="text-[11px] text-muted mt-1">{new Date(f.createdAt).toLocaleString()}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {tab === "log" && (
            <div className="py-4">
              {lastRun ? (
                <table className="w-full text-[13px]">
                  <tbody>
                    <tr><td className="py-1.5 text-muted w-36">Ran</td><td>{new Date(lastRun.at).toLocaleString()}</td></tr>
                    <tr><td className="py-1.5 text-muted">Items pulled</td><td>{lastRun.pulled}</td></tr>
                    <tr><td className="py-1.5 text-muted">Note</td><td>{lastRun.note ?? "—"}</td></tr>
                    <tr><td className="py-1.5 text-muted">Cadence</td><td>Daily, 14:00 UTC (Vercel cron, CRON_SECRET-gated)</td></tr>
                  </tbody>
                </table>
              ) : (
                <p className="py-4 text-center text-[13px] text-muted">No runs logged yet.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* standing architecture: full spec, not a stub */}
      {!eco.live && (
        <div className="ibox p-5">
          <h4 className="text-[14px] font-bold text-ink">Build spec</h4>
          <ul className="mt-3 space-y-2 text-[13px] text-muted leading-relaxed">
            <li><b className="text-ink">Reads from:</b> {eco.feeds}</li>
            <li><b className="text-ink">Writes to:</b> the Needs-you queue as PENDING_REVIEW rows — you approve before anything publishes.</li>
            <li><b className="text-ink">Truth rule:</b> every claim grounds in the Marketing Library; anything unverifiable comes back flagged, not invented.</li>
            <li><b className="text-ink">Unblocks on:</b> the credentials or library rows listed under "Reads from".</li>
          </ul>
        </div>
      )}
    </div>
  );
}


// ---- per-ecosystem bodies -------------------------------------------------

function Field({ k, v }: { k: string; v: any }) {
  if (v === undefined || v === null || v === "") return null;
  return <span className="text-muted">{k}: <span className="text-ink">{String(v)}</span></span>;
}

function VariantBody({ eco, state }: { eco: EcoDef; state: EcoState | null }) {
  const v = eco.variant;
  const lib = state?.library ?? [];
  const conns = state?.connections ?? [];
  const byFolder = (f: string) => lib.filter((r) => r.folder === f);

  if (v === "table") {
    const comps = byFolder("competitors");
    const snaps = byFolder("ad-snapshots");
    return (
      <div className="ibox p-5">
        <h4 className="text-[14px] font-bold text-ink">Watched competitors ({comps.length})</h4>
        {comps.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">No competitors saved yet — add them in Marketing Library → Competitors and this table fills.</p>
        ) : (
          <table className="mt-3 w-full text-[13px]">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="pb-2">Venue / brand</th><th className="pb-2">Meta page</th><th className="pb-2">Site</th><th className="pb-2">Ads on file</th>
            </tr></thead>
            <tbody className="divide-y divide-line">
              {comps.map((c) => (
                <tr key={c.id}>
                  <td className="py-2 font-semibold text-ink">{c.data?.name ?? c.title}</td>
                  <td className="py-2 text-muted">{c.data?.metaPage ?? "—"}</td>
                  <td className="py-2 text-muted">{c.data?.site ?? "—"}</td>
                  <td className="py-2 text-muted">{snaps.filter((x) => x.data?.competitor === c.data?.name || x.data?.competitor === c.title).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  if (v === "timeline") {
    return (
      <div className="ibox p-5">
        <h4 className="text-[14px] font-bold text-ink">Announcement timeline</h4>
        <p className="mt-1 text-[12px] text-muted">Engagement / wedding / business announcements as the scan finds them — newest first.</p>
        <ul className="mt-3 space-y-0">
          {(state?.findings ?? []).length === 0 && <li className="py-4 text-[13px] text-muted">Nothing announced in the scanned editions yet.</li>}
          {(state?.findings ?? []).map((f) => (
            <li key={f.id} className="relative pl-5 pb-3 border-l-2 border-line last:pb-0">
              <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-accent" />
              <p className="text-[13px] font-semibold text-ink">{f.suggestedDraft.match(/^Subject: (.*)$/m)?.[1] ?? "Announcement"}</p>
              <p className="text-[11px] text-muted">{new Date(f.createdAt).toLocaleDateString()}</p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (v === "grid") {
    return (
      <div className="ibox p-5">
        <h4 className="text-[14px] font-bold text-ink">Connected accounts ({conns.length})</h4>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {conns.length === 0 && <p className="col-span-2 py-3 text-[13px] text-muted">No accounts connected — connect Meta/TikTok on the Connections page and competitor creative starts flowing here.</p>}
          {conns.map((c) => (
            <div key={c.id} className="rounded-xl border border-line p-3">
              <p className="text-[13px] font-semibold text-ink capitalize">{c.vendor}{(c.meta as any)?.adAccountId ? ` · ${(c.meta as any).adAccountId}` : ""}</p>
              <p className="text-[11px] text-muted mt-0.5">{c.status}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (v === "benchmarks") {
    const bench = byFolder("benchmarks");
    const segs = byFolder("microsegments");
    return (
      <div className="ibox p-5">
        <h4 className="text-[14px] font-bold text-ink">Benchmarks ({bench.length})</h4>
        {bench.length === 0 ? <p className="mt-2 text-[13px] text-muted">No benchmarks saved — add rows in Marketing Library → Market benchmarks.</p> : (
          <div className="mt-3 space-y-2">
            {bench.map((b) => (
              <div key={b.id} className="flex items-baseline justify-between text-[13px]">
                <span className="text-ink font-semibold">{b.data?.metric ?? b.title}</span>
                <span className="text-muted">{b.data?.value}{b.data?.source ? ` · ${b.data.source}` : ""}</span>
              </div>
            ))}
          </div>
        )}
        <h4 className="mt-5 text-[14px] font-bold text-ink">Microsegments ({segs.length})</h4>
        <div className="mt-2 flex flex-wrap gap-2">
          {segs.length === 0 && <p className="text-[13px] text-muted">None yet — Marketing Library → Prospect microsegments.</p>}
          {segs.map((g) => (
            <span key={g.id} title={g.data?.who ?? ""} className="rounded-full border border-line px-3 py-1 text-[12px] text-ink">{g.data?.name ?? g.title}</span>
          ))}
        </div>
      </div>
    );
  }

  if (v === "funnel") {
    const steps = ["Ad", "Landing", "Email", "Text", "Inquiry", "Tour", "Booking"];
    return (
      <div className="ibox p-5">
        <h4 className="text-[14px] font-bold text-ink">The wire</h4>
        <div className="mt-3 flex items-center gap-1 overflow-x-auto">
          {steps.map((st, i) => (
            <React.Fragment key={st}>
              <div className="shrink-0 rounded-lg border border-line px-3 py-2 text-[12px] font-semibold text-ink">{st}</div>
              {i < steps.length - 1 && <span className="shrink-0 text-muted">→</span>}
            </React.Fragment>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-muted">Inbound touches are already tagged via /api/capture; per-step trip counts land here once channel instrumentation ships (build spec below).</p>
      </div>
    );
  }

  if (v === "cycle") {
    const steps = ["Plan", "Create", "Launch", "Test", "Reallocate"];
    return (
      <div className="ibox p-5">
        <h4 className="text-[14px] font-bold text-ink">Daily loop</h4>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto">
          {steps.map((st, i) => (
            <React.Fragment key={st}>
              <div className={`shrink-0 rounded-full px-4 py-1.5 text-[12px] font-semibold ${i === 0 ? "bg-accent text-white" : "border border-line text-ink"}`}>{st}</div>
              {i < steps.length - 1 && <span className="shrink-0 text-muted">→</span>}
            </React.Fragment>
          ))}
          <span className="shrink-0 text-muted">↻</span>
        </div>
        <p className="mt-3 text-[12px] text-muted">Unblocks when a Meta ad account connects on the Connections page.</p>
      </div>
    );
  }

  if (v === "plan") {
    const quarters = [
      ["Q1 · Jan–Mar", "Corporate meetings, bridal shows, early-bird holiday bookings"],
      ["Q2 · Apr–Jun", "Wedding peak, proms/graduations, nonprofit galas"],
      ["Q3 · Jul–Sep", "Corporate retreats, civic conferences, fall wedding inquiries"],
      ["Q4 · Oct–Dec", "Holiday parties, year-end corporate, next-year wedding season"],
    ];
    return (
      <div className="ibox p-5">
        <h4 className="text-[14px] font-bold text-ink">Season skeleton</h4>
        <p className="mt-1 text-[12px] text-muted">Placeholder shape keyed to venue seasons — the real plan is generated from the Marketing Library and your event calendar.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {quarters.map(([q, d]) => (
            <div key={q} className="rounded-xl border border-line p-3">
              <p className="text-[12px] font-bold uppercase tracking-wide text-accent">{q}</p>
              <p className="mt-1 text-[12px] text-muted">{d}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (v === "catalog") {
    return (
      <div className="ibox p-5">
        <h4 className="text-[14px] font-bold text-ink">Template catalog</h4>
        <p className="mt-2 text-[13px] text-muted">Journeys assemble from live DbTemplate rows; the full catalog is edited in the Templates tool under Studios.</p>
      </div>
    );
  }

  // "feed" (reviews) and "sent" (email/texting) render through the tabs below.
  return null;
}

"use client";

import React from "react";

export interface Metrics {
  totalLeads: number;
  pendingReview: number;
  publishedBroadcasts: number;
  vipLeads: number;
  reviewRate: string;
  expressPending?: number;
  tentativeEvents?: number;
  activeJourneys?: number;
  series?: { leads: number[]; drafts: number[] };
  feed?: { kind: string; who: string; text: string; when: string }[];
}

export type Section = "dashboard" | "leads" | "queue" | "history" | "campaigns" | "events" | "availability" | "express" | "journeys" | "examples" | "templates" | "brand" | "studio" | "social" | "video" | "photos" | "stock" | "landing" | "brands" | "ask" | "settings" | "textstudio" | "lpstudio" | "adstudio" | "mailer" | "podcast" | "call" | "proposal" | "connections" | "library" | "eco-competitors" | "eco-reviews" | "eco-news" | "eco-monitoring" | "eco-market" | "eco-tripwire" | "eco-ad-loop" | "eco-annual-plan" | "eco-email" | "eco-texting" | "eco-templates";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Clock() {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="text-[13px] text-muted mt-1 tabular-nums">
      {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      {" · "}
      {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
    </p>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="py-4 px-5">
      <span className="hb-display text-[30px] block leading-none tabular-nums text-ink">{value}</span>
      <span className="text-[13px] text-muted block mt-1.5">{label}</span>
      {hint && <span className="text-[11px] text-faint block mt-0.5">{hint}</span>}
    </div>
  );
}

function NeedRow({ index, count, label, detail, onClick }: { index: number; count: number; label: string; detail: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-canvas transition group">
      <span className={`h-7 w-7 rounded-md flex items-center justify-center text-[12px] font-bold tabular-nums shrink-0 ${index < 3 ? "bg-accent text-white" : "bg-canvas text-muted border border-line"}`}>{index + 1}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold text-ink">{label}</span>
        <span className="block text-[12px] text-muted truncate">{detail}</span>
      </span>
      <span className="text-[13px] font-semibold tabular-nums text-muted shrink-0">{count}</span>
      <span className="text-[13px] font-semibold text-accent group-hover:translate-x-0.5 transition-transform shrink-0">→</span>
    </button>
  );
}

// Inspinia-style area chart over the real 16-day series.
function AreaChart({ series }: { series: number[][] }) {
  const W = 560, H = 150, P = 8;
  const max = Math.max(4, ...series.flat());
  const x = (i: number) => P + (i / 15) * (W - 2 * P);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const path = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const fill = (vals: number[]) => `${path(vals)} L${x(15).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Activity over the last 16 days">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={P} x2={W - P} y1={H - P - f * (H - 2 * P)} y2={H - P - f * (H - 2 * P)} stroke="var(--color-line, #e5e3dd)" strokeWidth="1" />
      ))}
      {series.map((vals, i) => (
        <g key={i}>
          <path d={fill(vals)} fill={i === 0 ? "rgba(26,148,133,0.18)" : "rgba(37,99,235,0.15)"} />
          <path d={path(vals)} fill="none" stroke={i === 0 ? "#1a9485" : "#2563eb"} strokeWidth="1.6" />
        </g>
      ))}
    </svg>
  );
}

function Donut({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 90 90" className="h-24 w-24" role="img" aria-label={`${label}: ${sub}`}>
        <circle cx="45" cy="45" r={r} fill="none" stroke="#e8e6e0" strokeWidth="9" />
        <circle cx="45" cy="45" r={r} fill="none" stroke="#1a9485" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 45 45)" />
        <circle cx="45" cy="45" r={r - 9} fill="none" stroke="#c9c5bb" strokeWidth="4" strokeDasharray="3 6" />
        <text x="45" y="49" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--color-ink, #1c1a17)">{sub}</text>
      </svg>
      <span className="text-[13px] font-semibold text-ink">{label}</span>
    </div>
  );
}

const KIND_ICON: Record<string, string> = {
  lead: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  draft: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  request: "M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm1-18h-2v6l5.2 3.1 1-1.7-4.2-2.4z",
  event: "M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V10h14z",
};

function timeAgo(when: string) {
  const s = (Date.now() - +new Date(when)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function DailyFeed({ feed }: { feed: NonNullable<Metrics["feed"]> }) {
  const [shown, setShown] = React.useState(7);
  const items = feed.slice(0, shown);
  return (
    <section className="ibox">
      <div className="ibox-title">
        <h4 className="text-[15px] font-semibold text-ink">Your daily feed</h4>
        <span className="text-[11px] font-bold text-white bg-amber-500 px-2 py-0.5 rounded">{feed.length} updates</span>
      </div>
      <div className="divide-y divide-line">
        {items.length === 0 && <p className="px-5 py-6 text-[13px] text-muted">No activity yet — leads, drafts, requests and bookings post here.</p>}
        {items.map((f, i) => (
          <div key={i} className="flex items-start gap-3 px-5 py-3.5">
            <span className="h-9 w-9 rounded-full bg-canvas border border-line grid place-items-center text-muted shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d={KIND_ICON[f.kind] ?? KIND_ICON.lead} /></svg>
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] text-ink"><span className="font-semibold">{f.who}</span> {f.text}</p>
              <p className="text-[12px] text-faint mt-0.5">{new Date(f.when).toLocaleString("en-US", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
            </div>
            <span className="text-[12px] text-muted whitespace-nowrap mt-0.5">{timeAgo(f.when)}</span>
          </div>
        ))}
      </div>
      {shown < feed.length && (
        <button onClick={() => setShown((s) => s + 7)} className="w-full py-3 bg-accent text-white text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-accent-deep transition">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
          Show More
        </button>
      )}
    </section>
  );
}

const TILES: { key: Section; label: string; detail: string; dot: string }[] = [
  { key: "leads", label: "Leads", detail: "Inquiries and profiles", dot: "bg-info" },
  { key: "events", label: "Events", detail: "Bookings, proposals, BEOs", dot: "bg-accent" },
  { key: "express", label: "Date requests", detail: "Express-book queue", dot: "bg-warn" },
  { key: "availability", label: "Availability", detail: "Room calendar", dot: "bg-success" },
  { key: "journeys", label: "Journeys", detail: "Automated follow-ups", dot: "bg-navy" },
  { key: "campaigns", label: "Email campaigns", detail: "Audience sends", dot: "bg-danger" },
  { key: "landing", label: "Landing pages", detail: "AI-composed pages", dot: "bg-info" },
  { key: "templates", label: "Templates", detail: "Saved copy library", dot: "bg-accent-deep" },
  { key: "studio", label: "Email studio", detail: "Design + compose", dot: "bg-success" },
  { key: "social", label: "Social posts", detail: "Channel drafts", dot: "bg-warn" },
  { key: "video", label: "Video", detail: "Storyboarded clips", dot: "bg-navy" },
  { key: "photos", label: "Photo library", detail: "Library + AI generate", dot: "bg-accent" },
];

export default function Dashboard({ metrics, onNavigate, onAsk }: { metrics: Metrics | null; onNavigate: (s: Section) => void; onAsk: (question: string) => void }) {
  const m = metrics;
  const [question, setQuestion] = React.useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim()) onAsk(question.trim());
  };

  const needs = [
    { count: m?.pendingReview ?? 0, label: "Drafts awaiting your authorization", detail: "AI-composed outreach, held until you approve", go: "queue" as Section },
    { count: m?.expressPending ?? 0, label: "Date requests waiting", detail: "Express-book requests to approve or decline", go: "express" as Section },
    { count: m?.tentativeEvents ?? 0, label: "Tentative events", detail: "Held dates not yet booked", go: "events" as Section },
  ].filter((n) => n.count > 0);

  const autoStats = [
    { label: "Active journeys", value: m?.activeJourneys },
    { label: "Published broadcasts", value: m?.publishedBroadcasts },
    { label: "Clearance rate", value: m?.reviewRate },
  ];

  const ratePct = parseInt(m?.reviewRate ?? "0", 10) || 0;
  const vipPct = (m?.totalLeads ?? 0) > 0 ? Math.round(((m?.vipLeads ?? 0) / (m?.totalLeads ?? 1)) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Three-card Inspinia row: welcome/needs-you · activity chart · progress donuts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Card 1 — welcome + numbered needs-you list */}
        <section className="ibox">
          <div className="ibox-content">
            <h3 className="hb-display text-[24px] text-ink leading-none">{greeting()} Ed</h3>
            <p className="text-[13px] text-muted mt-1.5">
              You have {needs.length === 0 ? "nothing waiting" : `${needs.reduce((s, n) => s + n.count, 0)} item${needs.reduce((s, n) => s + n.count, 0) === 1 ? "" : "s"} needing your attention`}.
            </p>
          </div>
          <div className="divide-y divide-line">
            {needs.length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-muted">All clear — new inquiries, drafts and requests land here.</p>
            ) : (
              needs.map((n, i) => <NeedRow key={n.go} index={i} count={n.count} label={n.label} detail={n.detail} onClick={() => onNavigate(n.go)} />)
            )}
          </div>
          <div className="px-5 py-3 border-t border-line"><Clock /></div>
        </section>

        {/* Card 2 — activity chart + 3 stats */}
        <section className="ibox">
          <div className="ibox-title"><h4 className="text-[15px] font-semibold text-ink">Activity, last 16 days</h4>
            <div className="flex gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: "#1a9485" }} />Leads</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: "#2563eb" }} />Drafts</span>
            </div>
          </div>
          <div className="ibox-content pt-4">
            <AreaChart series={[m?.series?.leads ?? new Array(16).fill(0), m?.series?.drafts ?? new Array(16).fill(0)]} />
          </div>
          <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
            <Stat label="Total leads" value={m?.totalLeads ?? "—"} />
            <Stat label="Broadcasts out" value={m?.publishedBroadcasts ?? "—"} />
            <Stat label="Active journeys" value={m?.activeJourneys ?? "—"} />
          </div>
        </section>

        {/* Card 3 — progress donuts */}
        <section className="ibox">
          <div className="ibox-title"><h4 className="text-[15px] font-semibold text-ink">Platform progress</h4></div>
          <div className="ibox-content">
            <p className="text-[13px] text-muted">Share of the pipeline that's cleared and the VIP slice of your lead book.</p>
          </div>
          <div className="flex items-center justify-around px-5 pb-5 pt-1">
            <Donut pct={ratePct} label="Clearance rate" sub={m?.reviewRate ?? "—"} />
            <Donut pct={vipPct} label="VIP / high-value" sub={`${vipPct}%`} />
          </div>
          <div className="px-5 py-3 border-t border-line">
            <p className="text-[12px] text-muted">Awaiting authorization: <span className="font-semibold text-ink tabular-nums">{(m?.pendingReview ?? 0) + (m?.expressPending ?? 0)}</span> · Tentative events: <span className="font-semibold text-ink tabular-nums">{m?.tentativeEvents ?? 0}</span></p>
          </div>
        </section>
      </div>

      {/* Daily feed — Facebook-style activity stream, centered */}
      <div className="max-w-xl mx-auto w-full">
        <DailyFeed feed={m?.feed ?? []} />
      </div>

      {/* Automation status */}
      <section className="ibox">
        <div className="ibox-title"><h4 className="text-[15px] font-semibold text-ink">Running on its own</h4></div>
        <div className="ibox-content">
          <div className="grid grid-cols-3 gap-4">
            {autoStats.map((s) => (
              <div key={s.label}>
                <span className="hb-display text-[24px] text-ink tabular-nums">{s.value ?? "—"}</span>
                <span className="block text-[12px] text-muted mt-0.5">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ask */}
      <section className="ibox border-accent/40">
        <div className="ibox-content">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-[15px] font-semibold text-ink">Ask</h4>
            <button onClick={() => onNavigate("ask")} className="text-[12px] text-accent hover:underline">Open full chat →</button>
          </div>
          <p className="mt-1 text-[13px] text-muted">Ask about the leads or have a draft written. Nothing is sent without your approval.</p>
          <form onSubmit={submit} className="mt-3 flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={2000}
              placeholder="e.g. How many leads are missing a name?"
              aria-label="Ask Devin"
              className="flex-1 rounded-md border border-line px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-accent"
            />
            <button type="submit" disabled={!question.trim()} className="h-10 px-4 rounded-md bg-navy text-white text-[14px] font-semibold disabled:opacity-50">Ask</button>
          </form>
        </div>
      </section>

      {/* Console — every subsystem reporting in */}
      <section className="ibox">
        <div className="ibox-title"><h4 className="text-[15px] font-semibold text-ink">Console</h4></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 divide-x divide-y divide-line">
          {TILES.map((t) => (
            <button key={t.key} onClick={() => onNavigate(t.key)} className="flex items-center gap-3 px-5 py-4 text-left hover:bg-canvas transition group">
              <span className={`h-2.5 w-2.5 rounded-full ${t.dot} shrink-0`} aria-hidden="true" />
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold text-ink">{t.label}</span>
                <span className="block text-[12px] text-muted truncate">{t.detail}</span>
              </span>
              <span className="text-faint group-hover:text-accent transition">→</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

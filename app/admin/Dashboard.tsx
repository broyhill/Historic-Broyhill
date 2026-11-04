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
}

export type Section = "dashboard" | "leads" | "queue" | "history" | "campaigns" | "events" | "availability" | "express" | "journeys" | "examples" | "templates" | "brand" | "studio" | "social" | "video" | "photos" | "stock" | "landing" | "brands" | "ask" | "settings";

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

function NeedRow({ count, label, detail, onClick }: { count: number; label: string; detail: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-canvas transition group">
      <span className="h-10 w-10 rounded-full bg-accent text-white flex items-center justify-center text-[15px] font-bold tabular-nums shrink-0">{count}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold text-ink">{label}</span>
        <span className="block text-[12px] text-muted truncate">{detail}</span>
      </span>
      <span className="text-[13px] font-semibold text-accent group-hover:translate-x-0.5 transition-transform shrink-0">Open →</span>
    </button>
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

  return (
    <div className="space-y-6">
      {/* Command header */}
      <div>
        <h3 className="hb-display text-[26px] text-ink leading-none">{greeting()}</h3>
        <Clock />
      </div>

      {/* Needs you */}
      <section className="ibox">
        <div className="ibox-title">
          <h4 className="text-[15px] font-semibold text-ink">Needs you</h4>
          {needs.length === 0 && <span className="text-[12px] text-success font-semibold">All clear</span>}
        </div>
        <div className="divide-y divide-line">
          {needs.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-muted">Nothing is waiting on you. New inquiries, drafts and requests land here.</p>
          ) : (
            needs.map((n) => <NeedRow key={n.go} count={n.count} label={n.label} detail={n.detail} onClick={() => onNavigate(n.go)} />)
          )}
        </div>
      </section>

      {/* Outcomes strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-line bg-white border border-line rounded-lg overflow-hidden">
        <Stat label="Total leads" value={m?.totalLeads ?? "—"} />
        <Stat label="VIP / high value" value={m?.vipLeads ?? "—"} hint="score ≥ 80 or VIP track" />
        <Stat label="Awaiting authorization" value={(m?.pendingReview ?? 0) + (m?.expressPending ?? 0) || "—"} />
        <Stat label="Clearance rate" value={m?.reviewRate ?? "—"} hint="of drafted outreach" />
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

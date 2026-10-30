"use client";

import React from "react";

export interface Metrics {
  totalLeads: number;
  pendingReview: number;
  publishedBroadcasts: number;
  vipLeads: number;
  reviewRate: string;
}

export type Section = "dashboard" | "leads" | "queue" | "history" | "campaigns" | "examples" | "templates" | "studio" | "social" | "video" | "photos" | "stock" | "ask" | "settings";

function Stat({ label, value, tone = "default" }: { label: string; value: React.ReactNode; tone?: "default" | "teal" | "amber" }) {
  const color = tone === "teal" ? "text-success" : tone === "amber" ? "text-warn" : "text-ink";
  return (
    <div className="py-3 pr-6 border-r border-line [&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r last:!border-r-0">
      <span className={`hb-display text-[30px] block leading-none tabular-nums ${color}`}>{value}</span>
      <span className="text-[13px] text-muted block mt-1.5">{label}</span>
    </div>
  );
}

export default function Dashboard({ metrics, onNavigate, onAsk }: { metrics: Metrics | null; onNavigate: (s: Section) => void; onAsk: (question: string) => void }) {
  const m = metrics;
  const [question, setQuestion] = React.useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim()) onAsk(question.trim());
  };
  return (
    <div className="space-y-6">
      <section className="ibox border-accent/40">
        <div className="ibox-content">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-ink">Ask</h3>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 bg-white border border-line rounded-lg px-6 py-2">
        <Stat label="Total Leads" value={m?.totalLeads ?? "—"} />
        <Stat label="VIP / High Net Worth" value={m?.vipLeads ?? "—"} tone="amber" />
        <Stat label="Awaiting Authorization" value={m?.pendingReview ?? "—"} tone="amber" />
        <Stat label="Clearance Rate" value={m?.reviewRate ?? "—"} tone="teal" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Pending outreach — the thing that needs the admin's attention */}
        <button
          onClick={() => onNavigate("queue")}
          className="ibox text-left hover:border-accent/50 transition group"
        >
          <div className="ibox-content">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-ink">Review queue</span>
              <span className="text-faint group-hover:text-accent transition">→</span>
            </div>
            <p className="mt-2 text-sm text-ink">
              {m && m.pendingReview > 0
                ? `${m.pendingReview} draft${m.pendingReview === 1 ? "" : "s"} awaiting your authorization.`
                : "No outreach is waiting for review."}
            </p>
          </div>
        </button>

        <button
          onClick={() => onNavigate("leads")}
          className="ibox text-left hover:border-info/50 transition group"
        >
          <div className="ibox-content">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold text-ink">Leads</span>
              <span className="text-faint group-hover:text-info transition">→</span>
            </div>
            <p className="mt-2 text-sm text-ink">
              {m ? `${m.totalLeads} contact${m.totalLeads === 1 ? "" : "s"} on file. ` : ""}Search, filter, import a list, or export to CSV.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

"use client";

import React from "react";

export interface Metrics {
  totalLeads: number;
  pendingReview: number;
  publishedBroadcasts: number;
  vipLeads: number;
  reviewRate: string;
}

export type Section = "dashboard" | "leads" | "queue" | "history" | "campaigns" | "templates" | "ask" | "settings";

function Stat({ label, value, tone = "default" }: { label: string; value: React.ReactNode; tone?: "default" | "teal" | "amber" }) {
  const color = tone === "teal" ? "text-[#1ab394]" : tone === "amber" ? "text-[#f5a623]" : "text-[#323a46]";
  return (
    <div className="ibox">
      <div className="ibox-content">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9ba6b7] block">{label}</span>
        <span className={`text-[28px] font-bold mt-1 block leading-none ${color}`}>{value}</span>
      </div>
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
      <section className="ibox border-[#1ab394]/40">
        <div className="ibox-content">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[#323a46]">Ask Claude</h3>
            <button onClick={() => onNavigate("ask")} className="text-[12px] text-[#1ab394] hover:underline">Open full chat →</button>
          </div>
          <p className="mt-1 text-[13px] text-[#6c757d]">Ask a question, or tell Claude what to look up or draft. It never sends anything on its own.</p>
          <form onSubmit={submit} className="mt-3 flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={2000}
              placeholder="e.g. How many leads are missing a name?"
              aria-label="Ask Claude"
              className="flex-1 rounded-md border border-[#e7e9eb] px-3 py-2 text-[14px] text-[#323a46] focus:outline-none focus:border-[#1ab394]"
            />
            <button type="submit" disabled={!question.trim()} className="h-10 px-4 rounded-md bg-[#1ab394] text-white text-[13px] font-semibold disabled:opacity-50">Ask</button>
          </form>
        </div>
      </section>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Leads" value={m?.totalLeads ?? "—"} />
        <Stat label="VIP / High Net Worth" value={m?.vipLeads ?? "—"} tone="amber" />
        <Stat label="Awaiting Authorization" value={m?.pendingReview ?? "—"} tone="amber" />
        <Stat label="Clearance Rate" value={m?.reviewRate ?? "—"} tone="teal" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Pending outreach — the thing that needs the admin's attention */}
        <button
          onClick={() => onNavigate("queue")}
          className="ibox text-left hover:border-[#1ab394]/50 transition group"
        >
          <div className="ibox-content">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9ba6b7]">Review Queue</span>
              <span className="text-[#c3c9d1] group-hover:text-[#1ab394] transition">→</span>
            </div>
            <p className="mt-2 text-sm text-[#4c4c5c]">
              {m && m.pendingReview > 0
                ? `${m.pendingReview} draft${m.pendingReview === 1 ? "" : "s"} awaiting your authorization.`
                : "No outreach is waiting for review."}
            </p>
          </div>
        </button>

        <button
          onClick={() => onNavigate("leads")}
          className="ibox text-left hover:border-[#1c84c6]/50 transition group"
        >
          <div className="ibox-content">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9ba6b7]">Lead Directory</span>
              <span className="text-[#c3c9d1] group-hover:text-[#1c84c6] transition">→</span>
            </div>
            <p className="mt-2 text-sm text-[#4c4c5c]">
              {m ? `${m.totalLeads} contact${m.totalLeads === 1 ? "" : "s"} on file. ` : ""}Search, filter, import a list, or export to CSV.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

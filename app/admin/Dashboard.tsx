"use client";

import React from "react";

export interface Metrics {
  totalLeads: number;
  pendingReview: number;
  publishedBroadcasts: number;
  vipLeads: number;
  reviewRate: string;
}

export type Section = "dashboard" | "leads" | "queue" | "history" | "settings";

function Stat({ label, value, tone = "default" }: { label: string; value: React.ReactNode; tone?: "default" | "amber" | "emerald" }) {
  const color = tone === "amber" ? "text-amber-400" : tone === "emerald" ? "text-emerald-400" : "text-neutral-100";
  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
      <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">{label}</span>
      <span className={`text-2xl font-semibold font-mono mt-1 block ${color}`}>{value}</span>
    </div>
  );
}

export default function Dashboard({ metrics, onNavigate }: { metrics: Metrics | null; onNavigate: (s: Section) => void }) {
  const m = metrics;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Leads" value={m?.totalLeads ?? "—"} />
        <Stat label="VIP / High Net Worth" value={m?.vipLeads ?? "—"} tone="amber" />
        <Stat label="Awaiting Authorization" value={m?.pendingReview ?? "—"} tone="amber" />
        <Stat label="Clearance Rate" value={m?.reviewRate ?? "—"} tone="emerald" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Pending outreach — the thing that needs the admin's attention */}
        <button
          onClick={() => onNavigate("queue")}
          className="text-left bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 hover:border-amber-700/60 hover:bg-neutral-900 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">Review Queue</span>
            <span className="text-neutral-600 group-hover:text-amber-400 transition">→</span>
          </div>
          <p className="mt-2 text-sm text-neutral-300">
            {m && m.pendingReview > 0
              ? `${m.pendingReview} draft${m.pendingReview === 1 ? "" : "s"} awaiting your authorization.`
              : "No outreach is waiting for review."}
          </p>
        </button>

        <button
          onClick={() => onNavigate("leads")}
          className="text-left bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 hover:border-sky-700/60 hover:bg-neutral-900 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-neutral-400">Lead Directory</span>
            <span className="text-neutral-600 group-hover:text-sky-400 transition">→</span>
          </div>
          <p className="mt-2 text-sm text-neutral-300">
            {m ? `${m.totalLeads} contact${m.totalLeads === 1 ? "" : "s"} on file.` : "View, search, import, and export contacts."} Search, filter, import a list, or export to CSV.
          </p>
        </button>
      </div>
    </div>
  );
}

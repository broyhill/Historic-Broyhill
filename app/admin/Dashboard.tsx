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

export default function Dashboard({ metrics, onNavigate }: { metrics: Metrics | null; onNavigate: (s: Section) => void }) {
  const m = metrics;
  return (
    <div className="space-y-6">
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

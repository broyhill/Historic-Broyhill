"use client";

import React, { useEffect, useState } from "react";

interface Campaign {
  id: string;
  channel: string;
  suggestedDraft: string;
  status: string;
  createdAt: string;
  publishedAt?: string;
}

interface Metrics {
  totalLeads: number;
  pendingReview: number;
  publishedBroadcasts: number;
  vipLeads: number;
  reviewRate: string;
}

export default function AdminConsole() {
  const [tab, setTab] = useState<"queue" | "history">("queue");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedDraft, setEditedDraft] = useState("");

  const refreshData = async (targetTab: "queue" | "history") => {
    setLoading(true);
    try {
      const status = targetTab === "queue" ? "PENDING_REVIEW" : "PUBLISHED";
      const [campRes, metRes] = await Promise.all([
        fetch(`/api/admin/campaigns?status=${status}`),
        fetch("/api/admin/metrics")
      ]);
      if (campRes.status === 401 || metRes.status === 401) {
        window.location.assign("/admin/login");
        return;
      }
      const campData = await campRes.json();
      const metData = await metRes.json();
      if (campData.campaigns) setCampaigns(campData.campaigns);
      if (metData.metrics) setMetrics(metData.metrics);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshData(tab); }, [tab]);

  const handleAction = async (id: string, action: "APPROVE" | "DISMISS") => {
    try {
      const payload: any = { id, action };
      if (editingId === id) payload.suggestedDraft = editedDraft;
      const res = await fetch("/api/admin/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setEditingId(null);
        refreshData(tab);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const signOut = async () => {
    try {
      await fetch("/api/admin/auth", { method: "DELETE" });
    } finally {
      window.location.assign("/admin/login");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-neutral-800 gap-4">
          <div>
            <h1 className="text-2xl font-serif tracking-wide text-neutral-100">✧ 5% Operations Console</h1>
            <p className="text-xs text-neutral-400 font-mono mt-1">Review staged AI outreach & audit published venue broadcasts</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-1">
              <button
                onClick={() => setTab("queue")}
                className={`px-4 py-1.5 text-xs font-mono rounded-md transition ${tab === "queue" ? "bg-amber-500 text-neutral-950 font-semibold" : "text-neutral-400 hover:text-neutral-200"}`}
              >
                Review Queue ({metrics?.pendingReview ?? 0})
              </button>
              <button
                onClick={() => setTab("history")}
                className={`px-4 py-1.5 text-xs font-mono rounded-md transition ${tab === "history" ? "bg-amber-500 text-neutral-950 font-semibold" : "text-neutral-400 hover:text-neutral-200"}`}
              >
                Broadcast History ({metrics?.publishedBroadcasts ?? 0})
              </button>
            </div>
            <button onClick={() => refreshData(tab)} className="p-2 border border-neutral-800 bg-neutral-900 rounded-lg text-neutral-400 hover:text-neutral-100">↻</button>
            <button onClick={signOut} className="px-3 py-2 border border-neutral-800 bg-neutral-900 rounded-lg text-xs font-mono text-neutral-400 hover:text-neutral-100">Sign Out</button>
          </div>
        </div>

        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">Total Ingested Leads</span>
              <span className="text-2xl font-semibold text-neutral-100 font-mono mt-1 block">{metrics.totalLeads}</span>
            </div>
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">VIP / High Net Worth</span>
              <span className="text-2xl font-semibold text-amber-400 font-mono mt-1 block">{metrics.vipLeads}</span>
            </div>
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">Awaiting Authorization</span>
              <span className="text-2xl font-semibold text-amber-500 font-mono mt-1 block">{metrics.pendingReview}</span>
            </div>
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">Clearance Rate</span>
              <span className="text-2xl font-semibold text-emerald-400 font-mono mt-1 block">{metrics.reviewRate}</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-neutral-500 font-mono text-xs">Loading records...</div>
        ) : campaigns.length === 0 ? (
          <div className="p-16 border border-neutral-900 rounded-2xl bg-neutral-900/30 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">✓</div>
            <h2 className="text-base font-medium text-neutral-200">{tab === "queue" ? "Queue Clear" : "No Broadcast History"}</h2>
            <p className="text-xs text-neutral-500">{tab === "queue" ? "No communications pending review." : "Authorized broadcasts will be recorded here."}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((c) => (
              <div key={c.id} className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 space-y-4 shadow-lg">
                <div className="flex items-center justify-between text-xs font-mono text-neutral-400 border-b border-neutral-800/60 pb-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-neutral-200 font-semibold">{c.channel}</span>
                    <span className="text-neutral-600">·</span>
                    <span className="text-neutral-500">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${c.status === "PUBLISHED" ? "bg-emerald-950/60 border border-emerald-800 text-emerald-400" : "bg-amber-950/60 border border-amber-800 text-amber-400"}`}>
                    {c.status}
                  </span>
                </div>

                {editingId === c.id ? (
                  <textarea
                    rows={8}
                    value={editedDraft}
                    onChange={(e) => setEditedDraft(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-3 text-sm text-neutral-100 font-sans leading-relaxed focus:outline-none focus:border-amber-500"
                  />
                ) : (
                  <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-lg p-4 text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">
                    {c.suggestedDraft}
                  </div>
                )}

                {tab === "queue" && (
                  <div className="flex items-center justify-end space-x-3 pt-2">
                    {editingId === c.id ? (
                      <>
                        <button onClick={() => setEditingId(null)} className="px-4 py-2 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-400">Cancel</button>
                        <button onClick={() => handleAction(c.id, "APPROVE")} className="px-4 py-2 bg-amber-500 text-neutral-950 rounded-lg text-xs font-mono font-medium">Save & Authorize</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingId(c.id); setEditedDraft(c.suggestedDraft); }} className="px-4 py-2 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-300">Edit Draft</button>
                        <button onClick={() => handleAction(c.id, "APPROVE")} className="px-4 py-2 bg-neutral-100 text-neutral-950 rounded-lg text-xs font-mono font-semibold">Authorize Broadcast</button>
                      </>
                    )}
                  </div>
                )}

                {tab === "history" && c.publishedAt && (
                  <div className="text-right text-[11px] font-mono text-neutral-500">
                    Published: {new Date(c.publishedAt).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

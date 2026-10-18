"use client";

import React, { useEffect, useState } from "react";
import { linkedinHref } from "@/lib/linkedin";

interface Lead {
  id: string;
  name: string | null;
  company: string | null;
  email: string;
  linkedinId: string | null;
  leadScore: number;
}

interface Campaign {
  id: string;
  channel: string;
  suggestedDraft: string;
  status: string;
  createdAt: string;
  publishedAt?: string;
  lead?: Lead | null;
}

// The outreach review surface. mode="queue" shows pending drafts with
// approve/dismiss/edit; mode="history" shows the published audit trail.
// onChanged lets the shell refresh its metric counts after an action.
export default function ReviewPanel({ mode, onChanged }: { mode: "queue" | "history"; onChanged?: () => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedDraft, setEditedDraft] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const status = mode === "queue" ? "PENDING_REVIEW" : "PUBLISHED";
      const res = await fetch(`/api/admin/campaigns?status=${status}`);
      if (res.status === 401) { window.location.assign("/admin/login"); return; }
      const data = await res.json();
      if (data.campaigns) setCampaigns(data.campaigns);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [mode]);

  const handleAction = async (id: string, action: "APPROVE" | "DISMISS") => {
    try {
      const payload: any = { id, action };
      if (editingId === id) payload.suggestedDraft = editedDraft;
      const res = await fetch("/api/admin/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setEditingId(null);
        await load();
        onChanged?.();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-neutral-500 font-mono text-xs">Loading records…</div>;
  }

  if (campaigns.length === 0) {
    return (
      <div className="p-16 border border-neutral-900 rounded-2xl bg-neutral-900/30 text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">✓</div>
        <h2 className="text-base font-medium text-neutral-200">{mode === "queue" ? "Queue Clear" : "No Broadcast History"}</h2>
        <p className="text-xs text-neutral-500">{mode === "queue" ? "No communications pending review." : "Authorized broadcasts will be recorded here."}</p>
      </div>
    );
  }

  return (
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

          {c.lead && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono">
              <span className="text-neutral-100 font-semibold">{c.lead.name || c.lead.email}</span>
              {c.lead.company && (<><span className="text-neutral-700">·</span><span className="text-neutral-400">{c.lead.company}</span></>)}
              <span className="text-neutral-700">·</span>
              <span className="text-amber-400">Score {c.lead.leadScore}</span>
              <span className="text-neutral-700">·</span>
              {c.lead.linkedinId ? (
                <a href={linkedinHref(c.lead.linkedinId)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 underline underline-offset-2">
                  LinkedIn ↗
                </a>
              ) : (
                <span className="text-neutral-600">no LinkedIn</span>
              )}
            </div>
          )}

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

          {mode === "queue" && (
            <div className="flex items-center justify-end space-x-3 pt-2">
              {editingId === c.id ? (
                <>
                  <button onClick={() => setEditingId(null)} className="px-4 py-2 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-400">Cancel</button>
                  <button onClick={() => handleAction(c.id, "APPROVE")} className="px-4 py-2 bg-amber-500 text-neutral-950 rounded-lg text-xs font-mono font-medium">Save & Authorize</button>
                </>
              ) : (
                <>
                  <button onClick={() => handleAction(c.id, "DISMISS")} className="px-4 py-2 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-500 hover:text-red-300 hover:border-red-900">Dismiss</button>
                  <button onClick={() => { setEditingId(c.id); setEditedDraft(c.suggestedDraft); }} className="px-4 py-2 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-300">Edit Draft</button>
                  <button onClick={() => handleAction(c.id, "APPROVE")} className="px-4 py-2 bg-neutral-100 text-neutral-950 rounded-lg text-xs font-mono font-semibold">Authorize Broadcast</button>
                </>
              )}
            </div>
          )}

          {mode === "history" && c.publishedAt && (
            <div className="text-right text-[11px] font-mono text-neutral-500">
              Published: {new Date(c.publishedAt).toLocaleString()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

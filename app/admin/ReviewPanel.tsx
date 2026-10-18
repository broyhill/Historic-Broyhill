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
    return <div className="p-12 text-center text-[#9ba6b7] text-sm">Loading records…</div>;
  }

  if (campaigns.length === 0) {
    return (
      <div className="ibox p-16 text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-[#daf8ef] text-[#0acf97] flex items-center justify-center mx-auto">✓</div>
        <h2 className="text-base font-semibold text-[#323a46]">{mode === "queue" ? "Queue Clear" : "No Broadcast History"}</h2>
        <p className="text-sm text-[#9ba6b7]">{mode === "queue" ? "No communications pending review." : "Authorized broadcasts will be recorded here."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map((c) => (
        <div key={c.id} className="ibox">
          <div className="ibox-title">
            <div className="flex items-center gap-3 text-xs text-[#9ba6b7]">
              <span className="text-[#323a46] font-semibold">{c.channel}</span>
              <span className="text-[#c3c9d1]">·</span>
              <span>{new Date(c.createdAt).toLocaleString()}</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${c.status === "PUBLISHED" ? "bg-[#daf8ef] text-[#09b080]" : "bg-[#feeede] text-[#d9822b]"}`}>
              {c.status}
            </span>
          </div>

          <div className="ibox-content space-y-4">
            {c.lead && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="text-[#323a46] font-semibold">{c.lead.name || c.lead.email}</span>
                {c.lead.company && (<><span className="text-[#c3c9d1]">·</span><span className="text-[#6c757d]">{c.lead.company}</span></>)}
                <span className="text-[#c3c9d1]">·</span>
                <span className="text-[#f5a623] font-medium">Score {c.lead.leadScore}</span>
                <span className="text-[#c3c9d1]">·</span>
                {c.lead.linkedinId ? (
                  <a href={linkedinHref(c.lead.linkedinId)} target="_blank" rel="noopener noreferrer" className="text-[#1c84c6] hover:underline">LinkedIn ↗</a>
                ) : (
                  <span className="text-[#c3c9d1]">no LinkedIn</span>
                )}
              </div>
            )}

            {editingId === c.id ? (
              <textarea
                rows={8}
                value={editedDraft}
                onChange={(e) => setEditedDraft(e.target.value)}
                className="ins-input w-full rounded-md p-3 text-sm leading-relaxed"
              />
            ) : (
              <div className="bg-[#f8f9fb] border border-[#e7e9eb] rounded-md p-4 text-sm text-[#4c4c5c] whitespace-pre-wrap leading-relaxed">
                {c.suggestedDraft}
              </div>
            )}

            {mode === "queue" && (
              <div className="flex items-center justify-end gap-3 pt-1">
                {editingId === c.id ? (
                  <>
                    <button onClick={() => setEditingId(null)} className="px-4 py-2 border border-[#e7e9eb] rounded-md text-xs font-medium text-[#6c757d] hover:bg-[#f1f2f7]">Cancel</button>
                    <button onClick={() => handleAction(c.id, "APPROVE")} className="px-4 py-2 bg-[#1ab394] text-white rounded-md text-xs font-semibold hover:bg-[#16987e]">Save &amp; Authorize</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleAction(c.id, "DISMISS")} className="px-4 py-2 border border-[#e7e9eb] rounded-md text-xs font-medium text-[#9ba6b7] hover:text-[#ed5565] hover:border-[#ed5565]/40">Dismiss</button>
                    <button onClick={() => { setEditingId(c.id); setEditedDraft(c.suggestedDraft); }} className="px-4 py-2 border border-[#e7e9eb] rounded-md text-xs font-medium text-[#4c4c5c] hover:bg-[#f1f2f7]">Edit Draft</button>
                    <button onClick={() => handleAction(c.id, "APPROVE")} className="px-4 py-2 bg-[#1ab394] text-white rounded-md text-xs font-semibold hover:bg-[#16987e]">Authorize Broadcast</button>
                  </>
                )}
              </div>
            )}

            {mode === "history" && c.publishedAt && (
              <div className="text-right text-[11px] text-[#9ba6b7]">
                Published: {new Date(c.publishedAt).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

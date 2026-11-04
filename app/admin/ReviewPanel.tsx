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

// The outreach review surface. mode="queue" runs the approve journey —
// pending rows open a detail page where the draft is read, edited and
// authorized, landing on a confirmation. mode="history" shows the
// published audit trail. onChanged lets the shell refresh its metric
// counts after an action.
export default function ReviewPanel({ mode, onChanged }: { mode: "queue" | "history"; onChanged?: () => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editedDraft, setEditedDraft] = useState("");
  const [confirmed, setConfirmed] = useState<Campaign | null>(null);
  const [busy, setBusy] = useState(false);

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

  const act = async (id: string, action: "APPROVE" | "DISMISS", draft?: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...(draft !== undefined ? { suggestedDraft: draft } : {}) }),
      });
      if (res.ok) {
        const done = campaigns.find((c) => c.id === id) ?? null;
        if (action === "APPROVE" && done) setConfirmed(done);
        setSelectedId(null);
        setEditing(false);
        await load();
        onChanged?.();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-subtle text-sm">Loading records…</div>;
  }

  // Confirmation landing page after authorize (queue mode).
  if (confirmed && mode === "queue") {
    return (
      <div className="ibox p-10 text-center space-y-4 max-w-xl mx-auto">
        <div className="w-12 h-12 rounded-full bg-success-tint text-success flex items-center justify-center mx-auto text-xl">✓</div>
        <h2 className="hb-display text-[22px] text-ink">Authorized</h2>
        <p className="text-sm text-muted leading-relaxed">
          The {confirmed.channel} draft for{" "}
          <span className="font-semibold text-ink">{confirmed.lead?.name || confirmed.lead?.email || "the lead"}</span>{" "}
          is authorized and moves to the send queue. Nothing goes out without your final send word.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button onClick={() => setConfirmed(null)} className="px-4 py-2 border border-line rounded-md text-xs font-medium text-muted hover:bg-canvas">Back to queue</button>
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="ibox p-16 text-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-success-tint text-success flex items-center justify-center mx-auto">✓</div>
        <h2 className="text-base font-semibold text-ink">{mode === "queue" ? "Queue Clear" : "No Broadcast History"}</h2>
        <p className="text-sm text-subtle">{mode === "queue" ? "No communications pending review." : "Authorized broadcasts will be recorded here."}</p>
      </div>
    );
  }

  // Detail page for one draft (queue mode).
  const selected = mode === "queue" ? campaigns.find((c) => c.id === selectedId) : null;
  if (selected) {
    return (
      <div className="space-y-4 max-w-3xl">
        <button onClick={() => { setSelectedId(null); setEditing(false); }} className="text-[13px] text-muted hover:text-ink">
          ← Back to queue
        </button>
        <div className="ibox">
          <div className="ibox-title">
            <div className="flex items-center gap-3 text-xs text-subtle">
              <span className="text-ink font-semibold">{selected.channel}</span>
              <span className="text-faint">·</span>
              <span>{new Date(selected.createdAt).toLocaleString()}</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider bg-warn-tint text-warn">{selected.status}</span>
          </div>
          <div className="ibox-content space-y-4">
            {selected.lead && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="text-[11px] uppercase tracking-wider text-subtle font-semibold">To</span>
                <span className="text-ink font-semibold">{selected.lead.name || selected.lead.email}</span>
                {selected.lead.company && (<><span className="text-faint">·</span><span className="text-muted">{selected.lead.company}</span></>)}
                <span className="text-faint">·</span>
                <span className="text-muted">{selected.lead.email}</span>
                <span className="text-faint">·</span>
                <span className="text-warn font-medium">Score {selected.lead.leadScore}</span>
                <span className="text-faint">·</span>
                {selected.lead.linkedinId ? (
                  <a href={linkedinHref(selected.lead.linkedinId)} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">LinkedIn ↗</a>
                ) : (
                  <span className="text-faint">no LinkedIn</span>
                )}
              </div>
            )}

            {editing ? (
              <textarea
                rows={12}
                value={editedDraft}
                onChange={(e) => setEditedDraft(e.target.value)}
                className="ins-input w-full rounded-md p-4 text-sm leading-relaxed"
              />
            ) : (
              <div className="bg-canvas border border-line rounded-md p-5 text-sm text-ink whitespace-pre-wrap leading-relaxed">
                {selected.suggestedDraft}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              {editing ? (
                <>
                  <button disabled={busy} onClick={() => { setEditing(false); setEditedDraft(selected.suggestedDraft); }} className="px-4 py-2 border border-line rounded-md text-xs font-medium text-muted hover:bg-canvas">Cancel</button>
                  <button disabled={busy} onClick={() => act(selected.id, "APPROVE", editedDraft)} className="px-4 py-2 bg-accent text-white rounded-md text-xs font-semibold hover:bg-accent-deep disabled:opacity-50">Approve edited &amp; send</button>
                </>
              ) : (
                <>
                  <button disabled={busy} onClick={() => act(selected.id, "DISMISS")} className="px-4 py-2 border border-line rounded-md text-xs font-medium text-subtle hover:text-danger hover:border-danger/40">Dismiss</button>
                  <button disabled={busy} onClick={() => { setEditing(true); setEditedDraft(selected.suggestedDraft); }} className="px-4 py-2 border border-line rounded-md text-xs font-medium text-ink hover:bg-canvas">Edit draft</button>
                  <button disabled={busy} onClick={() => act(selected.id, "APPROVE")} className="px-4 py-2 bg-accent text-white rounded-md text-xs font-semibold hover:bg-accent-deep disabled:opacity-50">Approve &amp; send</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mode === "queue" ? (
        // Pending rows — CTA opens the draft's own page.
        <div className="ibox">
          <div className="divide-y divide-line">
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4">
                <span className="h-10 w-10 rounded-full bg-warn-tint text-warn flex items-center justify-center text-[13px] font-bold shrink-0">
                  {c.channel.slice(0, 1).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-ink truncate">
                    {c.channel} draft for {c.lead?.name || c.lead?.email || "a lead"}
                  </p>
                  <p className="text-[12px] text-muted truncate">
                    {c.lead?.company ? `${c.lead.company} · ` : ""}Score {c.lead?.leadScore ?? "—"} · drafted {new Date(c.createdAt).toLocaleString()}
                  </p>
                </div>
                <button onClick={() => setSelectedId(c.id)} className="px-4 py-2 bg-accent text-white rounded-md text-xs font-semibold hover:bg-accent-deep shrink-0">
                  Review draft →
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        campaigns.map((c) => (
          <div key={c.id} className="ibox">
            <div className="ibox-title">
              <div className="flex items-center gap-3 text-xs text-subtle">
                <span className="text-ink font-semibold">{c.channel}</span>
                <span className="text-faint">·</span>
                <span>{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${c.status === "PUBLISHED" ? "bg-success-tint text-success" : "bg-warn-tint text-warn"}`}>
                {c.status}
              </span>
            </div>
            <div className="ibox-content space-y-4">
              {c.lead && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-ink font-semibold">{c.lead.name || c.lead.email}</span>
                  {c.lead.company && (<><span className="text-faint">·</span><span className="text-muted">{c.lead.company}</span></>)}
                  <span className="text-faint">·</span>
                  <span className="text-warn font-medium">Score {c.lead.leadScore}</span>
                </div>
              )}
              <div className="bg-canvas border border-line rounded-md p-4 text-sm text-ink whitespace-pre-wrap leading-relaxed">
                {c.suggestedDraft}
              </div>
              {c.publishedAt && (
                <div className="text-right text-[11px] text-subtle">
                  Published: {new Date(c.publishedAt).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";

interface Journey {
  id: string;
  name: string;
  trigger: string;
  status: string;
  approvalMode: string;
  steps: { type: string; template?: string; hours?: number }[];
  totalRuns: number;
  running: number;
}

// Journeys control surface. ACTIVE journeys enroll matching leads automatically;
// each step stages a draft in the review queue (REVIEW) or, on a journey a human
// set to AUTO, sends it. Nothing here bypasses approvalMode.
export default function JourneysPanel({ onChanged }: { onChanged?: () => void }) {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [enrollEmail, setEnrollEmail] = useState("");
  const [enrollTrigger, setEnrollTrigger] = useState("MANUAL");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/journeys");
      if (res.status === 401) { window.location.assign("/admin/login"); return; }
      const data = await res.json();
      if (data.journeys) setJourneys(data.journeys);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const act = async (key: string, payload: any) => {
    setBusy(key);
    setNotice("");
    try {
      const res = await fetch("/api/admin/journeys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setNotice(data?.error || "Action failed."); return; }
      if (payload.action === "enroll") setNotice(data.enrolled ? `Enrolled in ${data.enrolled} journey(s).` : "Already running — nothing new enrolled.");
      if (payload.action === "run_now") {
        const c = data.counts;
        setNotice(`Runner: ${c.processed} due — ${c.staged} staged, ${c.sent} sent, ${c.waited} waiting, ${c.skipped} skipped, ${c.done} finished${c.errored ? `, ${c.errored} errors` : ""}.`);
      }
      await load();
      onChanged?.();
    } finally {
      setBusy("");
    }
  };

  const stepLabel = (s: Journey["steps"][number]) =>
    s.type === "wait" ? `wait ${s.hours}h` : `${s.type}: ${s.template}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted max-w-xl">Automatic follow-up tracks. Each step lands in the review queue for a human to authorize — or sends directly only on a journey switched to AUTO.</p>
        <button disabled={busy === "run"} onClick={() => act("run", { action: "run_now" })} className="px-4 py-2 border border-line rounded-md text-xs font-semibold text-ink hover:bg-canvas disabled:opacity-50">
          {busy === "run" ? "Running…" : "Run due steps now"}
        </button>
      </div>
      {notice && <p className="text-[13px] text-warn" role="status">{notice}</p>}

      <div className="ibox"><div className="ibox-content">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle mb-2">Enroll a lead by hand</p>
        <div className="flex flex-wrap gap-2">
          <input type="email" required placeholder="lead@email.com" value={enrollEmail} onChange={(e) => setEnrollEmail(e.target.value)} className="flex-1 min-w-[200px] rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent" />
          <select value={enrollTrigger} onChange={(e) => setEnrollTrigger(e.target.value)} className="h-9 rounded-md border border-line px-2 text-xs text-ink" aria-label="Trigger">
            {["MANUAL", "INQUIRY_RECEIVED", "TOUR_BOOKED", "EVENT_COMPLETED"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button disabled={busy === "enroll" || !enrollEmail.trim()} onClick={() => act("enroll", { action: "enroll", leadEmail: enrollEmail, trigger: enrollTrigger })} className="px-4 py-2 bg-accent text-white rounded-md text-xs font-semibold hover:bg-accent-deep disabled:opacity-50">Enroll</button>
        </div>
      </div></div>

      {loading ? (
        <div className="p-12 text-center text-subtle text-sm">Loading journeys…</div>
      ) : journeys.length === 0 ? (
        <div className="ibox p-16 text-center">
          <h2 className="text-base font-semibold text-ink">No journeys</h2>
          <p className="mt-2 text-sm text-subtle">Starter journeys appear here the first time this page loads.</p>
        </div>
      ) : (
        journeys.map((j) => (
          <div key={j.id} className="ibox">
            <div className="ibox-title">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-ink font-semibold">{j.name}</span>
                <span className="text-faint">·</span>
                <span className="text-xs text-muted">{j.trigger}</span>
                <span className="text-faint">·</span>
                <span className="text-xs text-muted">{j.running} running / {j.totalRuns} total</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${j.status === "ACTIVE" ? "bg-success-tint text-success" : "bg-canvas text-muted"}`}>{j.status}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${j.approvalMode === "AUTO" ? "bg-danger-tint text-danger" : "bg-warn-tint text-warn"}`}>{j.approvalMode}</span>
              </div>
            </div>
            <div className="ibox-content space-y-3">
              <p className="text-xs text-muted">{j.steps.map(stepLabel).join("  →  ")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={busy === j.id + "s"}
                  onClick={() => act(j.id + "s", { id: j.id, action: "set_status", status: j.status === "ACTIVE" ? "PAUSED" : "ACTIVE" })}
                  className="px-3 py-2 border border-line rounded-md text-xs font-medium text-ink hover:bg-canvas disabled:opacity-50"
                >
                  {j.status === "ACTIVE" ? "Pause" : "Activate"}
                </button>
                <select
                  aria-label="Approval mode"
                  value={j.approvalMode}
                  disabled={busy === j.id + "m"}
                  onChange={(e) => act(j.id + "m", { id: j.id, action: "set_mode", approvalMode: e.target.value })}
                  className="h-9 rounded-md border border-line px-2 text-xs text-ink"
                >
                  <option value="REVIEW">REVIEW — stage drafts</option>
                  <option value="AUTO">AUTO — send directly</option>
                </select>
                {j.approvalMode === "AUTO" && <span className="text-[11px] text-danger">Sends without review on the next run.</span>}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

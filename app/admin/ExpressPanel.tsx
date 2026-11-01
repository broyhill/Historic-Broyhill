"use client";

import React, { useEffect, useState } from "react";

type SpaceLite = { id: string; name: string };

interface ExpressRequest {
  id: string;
  spaceId: string;
  date: string;
  guests: number | null;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
}

// Self-serve date requests from /book. Approve creates a tentative event and holds
// the date on the calendar; decline closes the request. The guest's first-reply
// draft is already waiting in the review queue from capture.
export default function ExpressPanel({ spaces, onChanged }: { spaces: SpaceLite[]; onChanged?: () => void }) {
  const [requests, setRequests] = useState<ExpressRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [showHandled, setShowHandled] = useState(false);

  const name = (id: string) => spaces.find((s) => s.id === id)?.name ?? id;

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/express-requests?status=${showHandled ? "ALL" : "PENDING"}`);
      if (res.status === 401) { window.location.assign("/admin/login"); return; }
      const data = await res.json();
      if (data.requests) setRequests(data.requests);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [showHandled]);

  const act = async (id: string, action: "APPROVE" | "DECLINE") => {
    setBusy(id);
    setNotice("");
    try {
      const res = await fetch("/api/admin/express-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) { setNotice(data?.error || "Action failed."); return; }
      await load();
      onChanged?.();
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Date requests from the public site. Approving creates a tentative event and holds the date.</p>
        <label className="flex items-center gap-2 text-xs text-muted min-h-[44px]">
          <input type="checkbox" checked={showHandled} onChange={(e) => setShowHandled(e.target.checked)} />
          Show handled
        </label>
      </div>
      {notice && <p className="text-[13px] text-warn" role="status">{notice}</p>}

      {loading ? (
        <div className="p-12 text-center text-subtle text-sm">Loading requests…</div>
      ) : requests.length === 0 ? (
        <div className="ibox p-16 text-center">
          <div className="w-10 h-10 rounded-full bg-success-tint text-success flex items-center justify-center mx-auto mb-3">✓</div>
          <h2 className="text-base font-semibold text-ink">Queue clear</h2>
          <p className="mt-2 text-sm text-subtle">No date requests waiting.</p>
        </div>
      ) : (
        requests.map((r) => (
          <div key={r.id} className="ibox">
            <div className="ibox-title">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-ink font-semibold">{r.name}</span>
                <span className="text-faint">·</span>
                <span className="text-xs text-muted">{name(r.spaceId)} · {r.date}{r.guests ? ` · ${r.guests} guests` : ""}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${r.status === "PENDING" ? "bg-warn-tint text-warn" : r.status === "APPROVED" ? "bg-success-tint text-success" : "bg-canvas text-muted"}`}>{r.status}</span>
            </div>
            <div className="ibox-content space-y-3">
              <p className="text-xs text-muted">
                <a href={`mailto:${r.email}`} className="text-info hover:underline">{r.email}</a>
                {r.phone ? ` · ${r.phone}` : ""} · requested {new Date(r.createdAt).toLocaleString()}
              </p>
              {r.notes && <p className="text-[13px] text-ink whitespace-pre-wrap rounded-md border border-line bg-canvas p-3">{r.notes}</p>}
              {r.status === "PENDING" && (
                <div className="flex items-center justify-end gap-3">
                  <button disabled={busy === r.id} onClick={() => act(r.id, "DECLINE")} className="px-4 py-2 border border-line rounded-md text-xs font-medium text-subtle hover:text-danger hover:border-danger/40 disabled:opacity-50">Decline</button>
                  <button disabled={busy === r.id} onClick={() => act(r.id, "APPROVE")} className="px-4 py-2 bg-accent text-white rounded-md text-xs font-semibold hover:bg-accent-deep disabled:opacity-50">Approve &amp; hold date</button>
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

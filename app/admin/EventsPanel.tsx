"use client";

import React, { useEffect, useState } from "react";

const STATUSES = ["INQUIRY", "TENTATIVE", "BOOKED", "COMPLETED", "CANCELLED"];
const STATUS_TONE: Record<string, string> = {
  INQUIRY: "bg-info-tint text-info",
  TENTATIVE: "bg-warn-tint text-warn",
  BOOKED: "bg-success-tint text-success",
  COMPLETED: "bg-canvas text-muted",
  CANCELLED: "bg-danger-tint text-danger",
};

type SpaceLite = { id: string; name: string };

interface VenueEvent {
  id: string;
  name: string;
  eventType: string | null;
  spaces: string[];
  dateStart: string | null;
  dateEnd: string | null;
  guests: number | null;
  status: string;
  notes: string | null;
  proposalDraft: string | null;
  beoDraft: string | null;
  shareToken: string;
  createdAt: string;
  lead?: { name: string | null; email: string; company: string | null } | null;
}

// The venue event spine: staff create an event (optionally tied to a lead by email),
// move it along the booking path, and generate the AI proposal / run-of-day that the
// public /proposal link shows the client.
export default function EventsPanel({ spaces }: { spaces: SpaceLite[] }) {
  const [events, setEvents] = useState<VenueEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", eventType: "", leadEmail: "", spaces: [] as string[], dateStart: "", guests: "", notes: "" });
  const [notice, setNotice] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/events");
      if (res.status === 401) { window.location.assign("/admin/login"); return; }
      const data = await res.json();
      if (data.events) setEvents(data.events);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const act = async (eventId: string, payload: any) => {
    setBusy(eventId + payload.action);
    setNotice("");
    try {
      const res = await fetch("/api/admin/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: eventId, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) { setNotice(data?.error || "Action failed."); return; }
      if (payload.action?.startsWith("generate") && data.source === "template") {
        setNotice("No AI key configured — saved a standard draft instead of an AI one.");
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("new");
    setNotice("");
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          eventType: form.eventType || undefined,
          leadEmail: form.leadEmail || undefined,
          spaces: form.spaces,
          dateStart: form.dateStart || undefined,
          guests: form.guests ? Number(form.guests) : undefined,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setNotice(data?.error || "Could not create the event."); return; }
      setForm({ name: "", eventType: "", leadEmail: "", spaces: [], dateStart: "", guests: "", notes: "" });
      setShowNew(false);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const input = "w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:outline-none focus:border-accent";
  const btn = "px-3 py-2 border border-line rounded-md text-xs font-medium text-ink hover:bg-canvas disabled:opacity-50";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Every gathering from first inquiry to completed — proposals and run-of-day live on the event.</p>
        <button onClick={() => setShowNew((v) => !v)} className="px-4 py-2 bg-accent text-white rounded-md text-xs font-semibold hover:bg-accent-deep">
          {showNew ? "Close" : "New event"}
        </button>
      </div>

      {notice && <p className="text-[13px] text-warn" role="status">{notice}</p>}

      {showNew && (
        <form onSubmit={create} className="ibox"><div className="ibox-content grid gap-3 sm:grid-cols-2">
          <input required placeholder="Event name (e.g. Rotary holiday lunch)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
          <input placeholder="Event type (optional)" value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })} className={input} />
          <input placeholder="Lead email (optional — links the event to a lead)" type="email" value={form.leadEmail} onChange={(e) => setForm({ ...form, leadEmail: e.target.value })} className={input} />
          <input type="date" aria-label="Event date" value={form.dateStart} onChange={(e) => setForm({ ...form, dateStart: e.target.value })} className={input} />
          <input type="number" min={1} placeholder="Guests (optional)" value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} className={input} />
          <div className="sm:col-span-2 flex flex-wrap gap-x-5 gap-y-2">
            {spaces.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm text-ink min-h-[44px]">
                <input type="checkbox" checked={form.spaces.includes(s.id)} onChange={(e) => setForm({ ...form, spaces: e.target.checked ? [...form.spaces, s.id] : form.spaces.filter((x) => x !== s.id) })} />
                {s.name}
              </label>
            ))}
          </div>
          <textarea placeholder="Notes (optional)" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${input} sm:col-span-2`} />
          <div className="sm:col-span-2 flex justify-end">
            <button type="submit" disabled={busy === "new"} className="px-4 py-2 bg-accent text-white rounded-md text-xs font-semibold hover:bg-accent-deep disabled:opacity-50">Create event</button>
          </div>
        </div></form>
      )}

      {loading ? (
        <div className="p-12 text-center text-subtle text-sm">Loading events…</div>
      ) : events.length === 0 ? (
        <div className="ibox p-16 text-center">
          <h2 className="text-base font-semibold text-ink">No events yet</h2>
          <p className="mt-2 text-sm text-subtle">Create one above, or approve a request in the Requests queue.</p>
        </div>
      ) : (
        events.map((ev) => (
          <div key={ev.id} className="ibox">
            <div className="ibox-title">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-ink font-semibold">{ev.name}</span>
                {ev.dateStart && <><span className="text-faint">·</span><span className="text-xs text-muted">{ev.dateStart}</span></>}
                {ev.guests != null && <><span className="text-faint">·</span><span className="text-xs text-muted">{ev.guests} guests</span></>}
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${STATUS_TONE[ev.status] ?? "bg-canvas text-muted"}`}>{ev.status}</span>
            </div>
            <div className="ibox-content space-y-3">
              <p className="text-xs text-muted">
                {ev.spaces.map((id) => spaces.find((s) => s.id === id)?.name ?? id).join(" · ") || "No space picked"}
                {ev.eventType ? ` · ${ev.eventType}` : ""}
                {ev.lead ? ` · ${ev.lead.name ?? ev.lead.email}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Status"
                  value={ev.status}
                  onChange={(e) => act(ev.id, { action: "update", status: e.target.value })}
                  className="h-9 rounded-md border border-line px-2 text-xs text-ink"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button disabled={busy === ev.id + "generate_proposal"} onClick={() => act(ev.id, { action: "generate_proposal" })} className={btn}>
                  {busy === ev.id + "generate_proposal" ? "Drafting…" : ev.proposalDraft ? "Rewrite proposal" : "Draft proposal"}
                </button>
                <button disabled={busy === ev.id + "generate_beo"} onClick={() => act(ev.id, { action: "generate_beo" })} className={btn}>
                  {busy === ev.id + "generate_beo" ? "Drafting…" : ev.beoDraft ? "Rewrite run-of-day" : "Draft run-of-day"}
                </button>
                <a href={`/proposal/${ev.shareToken}`} target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-xs font-medium text-info hover:underline">Client link ↗</a>
                <button onClick={() => setExpanded(expanded === ev.id ? null : ev.id)} className={btn}>{expanded === ev.id ? "Hide" : "View"}</button>
              </div>
              {expanded === ev.id && (
                <div className="space-y-3">
                  {ev.notes && <p className="text-xs text-muted">Notes: {ev.notes}</p>}
                  {ev.proposalDraft && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Proposal</p>
                      <div className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-canvas p-3 text-[13px] leading-relaxed text-ink">{ev.proposalDraft}</div>
                    </div>
                  )}
                  {ev.beoDraft && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Run of day</p>
                      <div className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-canvas p-3 text-[13px] leading-relaxed text-ink">{ev.beoDraft}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

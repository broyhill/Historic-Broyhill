"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

type SpaceLite = { id: string; name: string };
type Status = "open" | "held" | "booked";

interface Block { id: string; spaceId: string; date: string; status: Status; note: string | null }

const NEXT: Record<Status, Status | null> = { open: "held", held: "booked", booked: null }; // null = back to open (row removed)
const TONE: Record<Status, string> = {
  open: "bg-canvas text-faint hover:border-accent/60",
  held: "bg-warn-tint text-warn border-warn/50",
  booked: "bg-danger-tint text-danger border-danger/50",
};

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function daysIn(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

// Editable availability: click a room's day cell to cycle open → held → booked → open.
// Saved rows overlay the JSON defaults the public calendar starts from.
export default function AvailabilityPanel({ spaces }: { spaces: SpaceLite[] }) {
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const byKey = useMemo(() => {
    const m = new Map<string, Status>();
    for (const b of blocks) m.set(`${b.spaceId}:${b.date}`, b.status);
    return m;
  }, [blocks]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/availability?month=${month}`);
      if (res.status === 401) { window.location.assign("/admin/login"); return; }
      const data = await res.json();
      if (data.blocks) setBlocks(data.blocks);
    } finally {
      setLoading(false);
    }
  }, [month]);
  useEffect(() => { load(); }, [load]);

  const cycle = async (spaceId: string, date: string) => {
    const current = byKey.get(`${spaceId}:${date}`) ?? "open";
    const next = NEXT[current];
    setBusy(`${spaceId}:${date}`);
    setNotice("");
    try {
      const res = await fetch("/api/admin/availability", {
        method: next ? "PATCH" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next ? { spaceId, date, status: next } : { spaceId, date }),
      });
      if (!res.ok) {
        const data = await res.json();
        setNotice(data?.error || "Could not save that date.");
        return;
      }
      await load();
    } finally {
      setBusy("");
    }
  };

  const shift = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    setMonth(monthKey(new Date(y, m - 1 + delta, 1)));
  };

  const nav = "px-3 py-2 border border-line rounded-md text-xs font-medium text-ink hover:bg-canvas";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted max-w-xl">Click a day to cycle open → held → booked → open. Days without a mark stay open. Changes appear on the public calendar immediately.</p>
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className={nav}>← Prev</button>
          <span className="text-sm font-semibold text-ink min-w-[9rem] text-center">{monthLabel(month)}</span>
          <button onClick={() => shift(1)} className={nav}>Next →</button>
        </div>
      </div>
      {notice && <p className="text-[13px] text-warn" role="status">{notice}</p>}
      <div className="ibox overflow-x-auto">
        <div className="ibox-content min-w-[640px]">
          {loading ? (
            <p className="py-8 text-center text-subtle text-sm">Loading…</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white text-left text-[11px] font-semibold uppercase tracking-wider text-subtle pb-2 pr-3">Room</th>
                  {Array.from({ length: daysIn(month) }, (_, i) => (
                    <th key={i} className="pb-2 text-[10px] font-medium text-faint w-7">{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {spaces.map((s) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="sticky left-0 bg-white py-1.5 pr-3 text-[12px] font-medium text-ink whitespace-nowrap">{s.name}</td>
                    {Array.from({ length: daysIn(month) }, (_, i) => {
                      const date = `${month}-${String(i + 1).padStart(2, "0")}`;
                      const status = byKey.get(`${s.id}:${date}`) ?? "open";
                      const k = `${s.id}:${date}`;
                      return (
                        <td key={date} className="py-1.5 px-px">
                          <button
                            onClick={() => cycle(s.id, date)}
                            disabled={busy === k}
                            aria-label={`${s.name} ${date}: ${status}`}
                            title={`${date} — ${status}`}
                            className={`h-7 w-7 rounded border border-transparent text-[10px] font-semibold ${TONE[status]} disabled:opacity-50`}
                          >
                            {status === "open" ? "" : status === "held" ? "H" : "B"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-[11px] text-faint">H = held · B = booked · blank = open (default)</p>
        </div>
      </div>
    </div>
  );
}

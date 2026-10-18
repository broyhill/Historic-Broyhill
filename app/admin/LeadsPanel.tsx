"use client";

import React, { useEffect, useMemo, useState } from "react";
import { linkedinHref } from "@/lib/linkedin";

interface Lead {
  id: string;
  name: string | null;
  company: string | null;
  email: string;
  phone: string | null;
  linkedinId: string | null;
  leadScore: number;
  leadStatus: string;
  primaryTrack: string;
  leadSource: string;
  estimatedValue: number | null;
  createdAt: string;
}

type SortKey = "name" | "company" | "leadScore" | "primaryTrack" | "createdAt";

const money = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function LeadsPanel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tracks, setTracks] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [track, setTrack] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Debounce the search box so we don't hit the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQ.trim()) p.set("q", debouncedQ.trim());
    if (track !== "ALL") p.set("track", track);
    if (status !== "ALL") p.set("status", status);
    return p.toString();
  }, [debouncedQ, track, status]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/leads?${query}`)
      .then((res) => {
        if (res.status === 401) { window.location.assign("/admin/login"); return null; }
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        if (data.leads) setLeads(data.leads);
        if (data.tracks) setTracks(data.tracks);
        if (data.statuses) setStatuses(data.statuses);
      })
      .catch((e) => console.error(e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [query]);

  const sorted = useMemo(() => {
    const rows = [...leads];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "leadScore") cmp = a.leadScore - b.leadScore;
      else if (sortKey === "createdAt") cmp = a.createdAt.localeCompare(b.createdAt);
      else cmp = String(a[sortKey] ?? "").localeCompare(String(b[sortKey] ?? ""), undefined, { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [leads, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "leadScore" || key === "createdAt" ? "desc" : "asc"); }
  };

  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  const th = "px-3 py-2 text-left text-[10px] font-mono uppercase tracking-wider text-neutral-400 whitespace-nowrap";
  const thSort = `${th} cursor-pointer select-none hover:text-neutral-200`;
  const td = "px-3 py-2.5 text-xs text-neutral-300 align-middle";

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-sm">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, company, email, or phone…"
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-amber-500"
          />
        </div>
        <select value={track} onChange={(e) => setTrack(e.target.value)} className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs font-mono text-neutral-300 focus:outline-none focus:border-amber-500">
          <option value="ALL">All interests</option>
          {tracks.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs font-mono text-neutral-300 focus:outline-none focus:border-amber-500">
          <option value="ALL">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <a
          href={`/api/admin/leads/export?${query}`}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 text-neutral-950 rounded-lg text-xs font-mono font-semibold hover:bg-amber-400 transition whitespace-nowrap"
        >
          ↓ Export CSV
        </a>
      </div>

      <div className="text-[11px] font-mono text-neutral-500">
        {loading ? "Loading leads…" : `${sorted.length} lead${sorted.length === 1 ? "" : "s"}${query ? " (filtered)" : ""}`}
      </div>

      {loading ? (
        <div className="p-12 text-center text-neutral-500 font-mono text-xs">Loading records…</div>
      ) : sorted.length === 0 ? (
        <div className="p-16 border border-neutral-900 rounded-2xl bg-neutral-900/30 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">∅</div>
          <h2 className="text-base font-medium text-neutral-200">No leads match</h2>
          <p className="text-xs text-neutral-500">Try clearing the search or filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-900/60">
          <table className="w-full border-collapse">
            <thead className="bg-neutral-900/80 border-b border-neutral-800">
              <tr>
                <th className={thSort} onClick={() => toggleSort("name")}>Name{arrow("name")}</th>
                <th className={thSort} onClick={() => toggleSort("company")}>Company{arrow("company")}</th>
                <th className={th}>Contact</th>
                <th className={thSort} onClick={() => toggleSort("primaryTrack")}>Interest{arrow("primaryTrack")}</th>
                <th className={`${thSort} text-right`} onClick={() => toggleSort("leadScore")}>Score{arrow("leadScore")}</th>
                <th className={th}>Status</th>
                <th className={`${thSort} text-right`} onClick={() => toggleSort("createdAt")}>Captured{arrow("createdAt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {sorted.map((l) => (
                <tr key={l.id} className="hover:bg-neutral-800/30">
                  <td className={`${td} text-neutral-100 font-medium`}>{l.name || "—"}</td>
                  <td className={td}>{l.company || "—"}</td>
                  <td className={td}>
                    <div className="flex flex-col gap-0.5">
                      <a href={`mailto:${l.email}`} className="text-neutral-300 hover:text-amber-400">{l.email}</a>
                      {l.phone && <a href={`tel:${l.phone}`} className="text-neutral-500 hover:text-amber-400">{l.phone}</a>}
                      {l.linkedinId && (
                        <a href={linkedinHref(l.linkedinId)} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300">LinkedIn ↗</a>
                      )}
                    </div>
                  </td>
                  <td className={`${td} text-neutral-400`}>{l.primaryTrack}</td>
                  <td className={`${td} text-right font-mono ${l.leadScore >= 80 ? "text-amber-400 font-semibold" : "text-neutral-300"}`}>{l.leadScore}</td>
                  <td className={td}>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-neutral-800 border border-neutral-700 text-neutral-300">{l.leadStatus}</span>
                  </td>
                  <td className={`${td} text-right font-mono text-neutral-500 whitespace-nowrap`}>{new Date(l.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

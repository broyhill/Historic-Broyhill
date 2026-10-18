"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { linkedinHref } from "@/lib/linkedin";
import { parseCsv, mapRowsToLeads, type MappedLead } from "@/lib/csv";

interface Lead {
  id: string;
  name: string | null;
  company: string | null;
  email: string;
  phone: string | null;
  linkedinId: string | null;
  companyLinkedin: string | null;
  city: string | null;
  state: string | null;
  leadScore: number;
  leadStatus: string;
  primaryTrack: string;
  leadSource: string;
  estimatedValue: number | null;
  createdAt: string;
}

type SortKey = "name" | "company" | "leadScore" | "primaryTrack" | "createdAt";

export default function LeadsPanel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tracks, setTracks] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [track, setTrack] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [gap, setGap] = useState("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Reload the directory after a commit without touching the search/filter state
  const [reloadKey, setReloadKey] = useState(0);

  // CSV import flow: pick file -> parse -> preview counts -> confirm -> commit
  const fileRef = useRef<HTMLInputElement>(null);
  interface ImportPreview {
    fileName: string;
    leads: MappedLead[];
    columns: Record<string, string | null>;
    counts: { total: number; toCreate: number; toUpdate: number; skipped: number };
  }
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importDone, setImportDone] = useState<string | null>(null);

  // AI enrichment: loop the endpoint (each call makes progress) until done
  const [enrichPhase, setEnrichPhase] = useState<"idle" | "confirm" | "running" | "done">("idle");
  const [enrichRemaining, setEnrichRemaining] = useState<number | null>(null);
  const [enrichUpdated, setEnrichUpdated] = useState(0);
  const [enrichNote, setEnrichNote] = useState<string | null>(null);

  // Web-search person finder (batch + review)
  interface FoundPerson { email: string; company: string | null; name: string | null; title: string | null; linkedin: string | null; confidence: string; source: string | null; applied: boolean; }
  const [findBusy, setFindBusy] = useState(false);
  const [findResults, setFindResults] = useState<FoundPerson[] | null>(null);
  const [findSummary, setFindSummary] = useState<string | null>(null);
  const [findError, setFindError] = useState<string | null>(null);

  const runFindPeople = async () => {
    setFindBusy(true);
    setFindError(null);
    try {
      const res = await fetch("/api/admin/find-person", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 10 }),
      });
      if (res.status === 401) { window.location.assign("/admin/login"); return; }
      const data = await res.json();
      if (!res.ok) { setFindError(data.error || "Search failed."); return; }
      setFindResults(data.results || []);
      setFindSummary(`Searched ${data.searched} · ${data.applied} filled in · ${data.remaining} nameless corporate leads left`);
      if (data.apiError) setFindError(`OpenAI note: ${data.apiError}`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setFindError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setFindBusy(false);
    }
  };

  const runEnrichment = async () => {
    setEnrichPhase("running");
    setEnrichUpdated(0);
    setEnrichNote(null);
    let updated = 0;
    let aiAvailable = true;
    try {
      // Safety cap so a bug can never loop forever
      for (let i = 0; i < 200; i++) {
        const res = await fetch("/api/admin/enrich", { method: "POST" });
        if (res.status === 401) { window.location.assign("/admin/login"); return; }
        const data = await res.json();
        if (!res.ok) { setEnrichNote(data.error || "Enrichment failed."); setEnrichPhase("idle"); return; }
        updated += data.leadsUpdated || 0;
        aiAvailable = data.aiAvailable !== false;
        setEnrichUpdated(updated);
        setEnrichRemaining(data.remaining ?? 0);
        if (data.done || (data.remaining ?? 0) === 0) break;
      }
      setEnrichPhase("done");
      setEnrichNote(aiAvailable
        ? `Enriched ${updated} corporate contacts with company name, city/state, and company LinkedIn.`
        : `Filled company names for ${updated} contacts. Add an OPENAI_API_KEY in Vercel for full enrichment (LinkedIn + city/state).`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setEnrichNote(err instanceof Error ? err.message : "Enrichment failed.");
      setEnrichPhase("idle");
    }
  };

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
    if (gap !== "ALL") p.set("gap", gap);
    return p.toString();
  }, [debouncedQ, track, status, gap]);

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
  }, [query, reloadKey]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setImportError(null);
    setImportDone(null);
    try {
      const text = await file.text();
      const { leads, skipped, columns } = mapRowsToLeads(parseCsv(text));
      if (!columns.email) { setImportError("No email column found in that file. A column named Email is required."); return; }
      if (leads.length === 0) { setImportError(`No rows with a valid email were found (${skipped} skipped).`); return; }
      const res = await fetch("/api/admin/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: leads, commit: false }),
      });
      if (res.status === 401) { window.location.assign("/admin/login"); return; }
      const data = await res.json();
      if (!res.ok) { setImportError(data.error || "Could not read that file."); return; }
      // Rows with no valid email are dropped during parsing, so fold that count
      // into the server's skipped total for an honest preview.
      const counts = { ...data.counts, skipped: data.counts.skipped + skipped };
      setPreview({ fileName: file.name, leads, columns, counts });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not read that file.");
    }
  };

  const commitImport = async () => {
    if (!preview) return;
    setImportBusy(true);
    setImportError(null);
    try {
      const res = await fetch("/api/admin/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.leads, commit: true }),
      });
      if (res.status === 401) { window.location.assign("/admin/login"); return; }
      const data = await res.json();
      if (!res.ok) { setImportError(data.error || "Import failed."); return; }
      const c = data.counts;
      const skipped = preview.counts.skipped; // includes rows dropped during parsing
      setImportDone(`Imported ${preview.fileName}: ${c.toCreate} added, ${c.toUpdate} updated${skipped ? `, ${skipped} skipped` : ""}.`);
      setPreview(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImportBusy(false);
    }
  };

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

  const th = "px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#9ba6b7] whitespace-nowrap";
  const thSort = `${th} cursor-pointer select-none hover:text-[#323a46]`;
  const td = "px-3 py-2.5 text-xs text-[#4c4c5c] align-middle";

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ba6b7] text-sm">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, company, email, or phone…"
            className="ins-input w-full rounded-md pl-9 pr-3 py-2.5 text-sm"
          />
        </div>
        <select value={track} onChange={(e) => setTrack(e.target.value)} className="ins-input rounded-md px-3 py-2.5 text-xs">
          <option value="ALL">All interests</option>
          {tracks.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="ins-input rounded-md px-3 py-2.5 text-xs">
          <option value="ALL">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={gap} onChange={(e) => setGap(e.target.value)} className="ins-input rounded-md px-3 py-2.5 text-xs" title="Find incomplete leads">
          <option value="ALL">All leads</option>
          <option value="no-name">Missing name</option>
          <option value="no-company">Missing company</option>
          <option value="has-company-linkedin">Has company LinkedIn</option>
        </select>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onPickFile} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-[#e7e9eb] bg-white text-[#4c4c5c] rounded-md text-xs font-semibold hover:bg-[#f1f2f7] transition whitespace-nowrap"
        >
          ↑ Import CSV
        </button>
        <a
          href={`/api/admin/leads/export?${query}`}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1ab394] text-white rounded-md text-xs font-semibold hover:bg-[#16987e] transition whitespace-nowrap"
        >
          ↓ Export CSV
        </a>
        <button
          onClick={() => setEnrichPhase("confirm")}
          disabled={enrichPhase === "running"}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-[#1c84c6] bg-[#eef6fc] text-[#1870a8] rounded-md text-xs font-semibold hover:bg-[#ddedf6] transition whitespace-nowrap disabled:opacity-60"
        >
          ✦ Enrich from email
        </button>
        <button
          onClick={runFindPeople}
          disabled={findBusy}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-[#7754f6] bg-[#f4f0ff] text-[#5b3fc4] rounded-md text-xs font-semibold hover:bg-[#ebe4ff] transition whitespace-nowrap disabled:opacity-60"
        >
          {findBusy ? "Searching…" : "🔎 Find people (web · 10)"}
        </button>
      </div>

      {findError && (
        <div role="alert" className="rounded-md border border-[#f5c2c7] bg-[#fdeeee] px-3 py-2.5 text-xs text-[#c0392b]">{findError}</div>
      )}

      {findResults && (
        <div className="ibox">
          <div className="ibox-title">
            <h3 className="text-sm font-semibold text-[#323a46]">Web search results</h3>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[#9ba6b7]">{findSummary}</span>
              <button onClick={() => setFindResults(null)} className="text-[#9ba6b7] hover:text-[#323a46]">✕</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-[#f8f9fb] border-b border-[#e7e9eb]">
                <tr>
                  <th className={th}>Email</th>
                  <th className={th}>Found</th>
                  <th className={th}>Title</th>
                  <th className={th}>LinkedIn</th>
                  <th className={th}>Confidence</th>
                  <th className={th}>Saved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef1f4]">
                {findResults.map((r, i) => (
                  <tr key={i} className="hover:bg-[#f7f8fa]">
                    <td className={`${td} text-[#6c757d]`}>{r.email}</td>
                    <td className={`${td} text-[#323a46] font-medium`}>
                      {r.name || <span className="text-[#c3c9d1]">—</span>}
                      {r.source && <a href={r.source} target="_blank" rel="noopener noreferrer" className="ml-2 text-[#1c84c6] hover:underline">src ↗</a>}
                    </td>
                    <td className={`${td} text-[#6c757d]`}>{r.title || "—"}</td>
                    <td className={td}>{r.linkedin ? <a href={r.linkedin} target="_blank" rel="noopener noreferrer" className="text-[#1c84c6] hover:underline">profile ↗</a> : "—"}</td>
                    <td className={td}>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${r.confidence === "high" ? "bg-[#daf8ef] text-[#09916b]" : r.confidence === "medium" ? "bg-[#feeede] text-[#d9822b]" : "bg-[#eef2f7] text-[#9ba6b7]"}`}>{r.confidence}</span>
                    </td>
                    <td className={td}>{r.applied ? <span className="text-[#09916b]">✓</span> : <span className="text-[#c3c9d1]">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ibox-content flex items-center justify-between">
            <p className="text-[11px] text-[#9ba6b7]">Only high/medium confidence matches are saved. Review the sources, then run the next batch.</p>
            <button onClick={runFindPeople} disabled={findBusy} className="px-4 py-2 bg-[#7754f6] text-white rounded-md text-xs font-semibold hover:bg-[#5b3fc4] disabled:opacity-60">{findBusy ? "Searching…" : "Find 10 more"}</button>
          </div>
        </div>
      )}

      {enrichPhase === "confirm" && (
        <div className="rounded-md border border-[#a4cee8] bg-[#f3f9fd] p-4 space-y-3">
          <p className="text-sm text-[#2b4a5e]">
            Fill in <strong>company name, city/state, and company LinkedIn</strong> for your contacts with
            a work email, using AI to identify the company from each email domain. Personal emails
            (gmail, yahoo…) are skipped. Nothing is emailed, and existing data isn&apos;t overwritten.
          </p>
          <div className="flex items-center gap-3">
            <button onClick={runEnrichment} className="px-4 py-2 bg-[#1c84c6] text-white rounded-md text-xs font-semibold hover:bg-[#1870a8]">Run enrichment</button>
            <button onClick={() => setEnrichPhase("idle")} className="px-4 py-2 border border-[#e7e9eb] rounded-md text-xs font-medium text-[#6c757d] hover:bg-[#f1f2f7]">Cancel</button>
          </div>
        </div>
      )}

      {enrichPhase === "running" && (
        <div className="rounded-md border border-[#a4cee8] bg-[#f3f9fd] px-3 py-2.5 text-xs text-[#1870a8] font-medium flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-[#1c84c6] border-t-transparent animate-spin" />
          Enriching… {enrichUpdated} contacts updated{enrichRemaining != null ? ` · ${enrichRemaining} leads left to scan` : ""}
        </div>
      )}

      {enrichPhase === "done" && enrichNote && (
        <div className="rounded-md border border-[#9decd5] bg-[#daf8ef] px-3 py-2.5 text-xs text-[#09916b] flex items-center justify-between gap-3">
          <span>✦ {enrichNote}</span>
          <button onClick={() => setEnrichPhase("idle")} className="text-[#09916b]/70 hover:text-[#09916b]">✕</button>
        </div>
      )}
      {enrichPhase === "idle" && enrichNote && (
        <div role="alert" className="rounded-md border border-[#f5c2c7] bg-[#fdeeee] px-3 py-2.5 text-xs text-[#c0392b]">{enrichNote}</div>
      )}

      {importError && (
        <div role="alert" className="rounded-md border border-[#f5c2c7] bg-[#fdeeee] px-3 py-2.5 text-xs text-[#c0392b]">{importError}</div>
      )}
      {importDone && (
        <div className="rounded-md border border-[#9decd5] bg-[#daf8ef] px-3 py-2.5 text-xs text-[#09916b]">{importDone}</div>
      )}

      <div className="text-[11px] text-[#9ba6b7]">
        {loading ? "Loading leads…" : `${sorted.length} lead${sorted.length === 1 ? "" : "s"}${query ? " (filtered)" : ""}`}
      </div>

      {loading ? (
        <div className="p-12 text-center text-[#9ba6b7] text-xs">Loading records…</div>
      ) : sorted.length === 0 ? (
        <div className="ibox p-16 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-[#eef2f7] text-[#9ba6b7] flex items-center justify-center mx-auto">∅</div>
          <h2 className="text-base font-semibold text-[#323a46]">No leads match</h2>
          <p className="text-xs text-[#9ba6b7]">Try clearing the search or filters.</p>
        </div>
      ) : (
        <div className="ibox overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-[#f8f9fb] border-b border-[#e7e9eb]">
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
            <tbody className="divide-y divide-[#eef1f4]">
              {sorted.map((l) => (
                <tr key={l.id} className="hover:bg-[#f7f8fa]">
                  <td className={`${td} text-[#323a46] font-semibold`}>{l.name || "—"}</td>
                  <td className={td}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[#4c4c5c]">{l.company || "—"}</span>
                      {(l.city || l.state) && <span className="text-[#9ba6b7]">{[l.city, l.state].filter(Boolean).join(", ")}</span>}
                      {l.companyLinkedin && (
                        <a href={l.companyLinkedin} target="_blank" rel="noopener noreferrer" className="text-[#1c84c6] hover:underline">Company ↗</a>
                      )}
                    </div>
                  </td>
                  <td className={td}>
                    <div className="flex flex-col gap-0.5">
                      <a href={`mailto:${l.email}`} className="text-[#4c4c5c] hover:text-[#1ab394]">{l.email}</a>
                      {l.phone && <a href={`tel:${l.phone}`} className="text-[#9ba6b7] hover:text-[#1ab394]">{l.phone}</a>}
                      {l.linkedinId && (
                        <a href={linkedinHref(l.linkedinId)} target="_blank" rel="noopener noreferrer" className="text-[#1c84c6] hover:underline">LinkedIn ↗</a>
                      )}
                    </div>
                  </td>
                  <td className={`${td} text-[#6c757d]`}>{l.primaryTrack}</td>
                  <td className={`${td} text-right ${l.leadScore >= 80 ? "text-[#1ab394] font-bold" : "text-[#4c4c5c]"}`}>{l.leadScore}</td>
                  <td className={td}>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium tracking-wider bg-[#eef2f7] text-[#6c757d]">{l.leadStatus}</span>
                  </td>
                  <td className={`${td} text-right text-[#9ba6b7] whitespace-nowrap`}>{new Date(l.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Confirm import">
          <div className="w-full max-w-lg bg-white border border-[#e7e9eb] rounded-lg shadow-2xl p-6 space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-[#323a46]">Import leads</h3>
              <p className="text-xs text-[#9ba6b7] mt-1 truncate">{preview.fileName}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border border-[#9decd5] bg-[#daf8ef] p-3 text-center">
                <div className="text-2xl font-bold text-[#09916b]">{preview.counts.toCreate}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6c757d] mt-0.5">New</div>
              </div>
              <div className="rounded-md border border-[#a4cee8] bg-[#ddedf6] p-3 text-center">
                <div className="text-2xl font-bold text-[#1870a8]">{preview.counts.toUpdate}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6c757d] mt-0.5">Update</div>
              </div>
              <div className="rounded-md border border-[#e7e9eb] bg-[#f1f2f7] p-3 text-center">
                <div className="text-2xl font-bold text-[#9ba6b7]">{preview.counts.skipped}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6c757d] mt-0.5">Skipped</div>
              </div>
            </div>

            <div className="rounded-md border border-[#e7e9eb] bg-[#f8f9fb] p-3 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#9ba6b7] mb-1">Detected columns</div>
              {(["email", "name", "company", "phone", "linkedin"] as const).map((f) => (
                <div key={f} className="flex items-center justify-between text-xs">
                  <span className="text-[#6c757d] capitalize">{f}</span>
                  <span className={preview.columns[f] ? "text-[#323a46] font-medium" : "text-[#c3c9d1]"}>
                    {preview.columns[f] || "— not found"}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-[#9ba6b7] leading-relaxed">
              Matches on email: existing contacts are updated, the rest are added as <span className="text-[#6c757d] font-medium">Client</span> records.
              Rows without a valid email are skipped. Nothing is emailed.
            </p>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button onClick={() => setPreview(null)} disabled={importBusy} className="px-4 py-2 border border-[#e7e9eb] rounded-md text-xs font-medium text-[#6c757d] hover:bg-[#f1f2f7] disabled:opacity-60">Cancel</button>
              <button onClick={commitImport} disabled={importBusy || (preview.counts.toCreate + preview.counts.toUpdate === 0)} className="px-4 py-2 bg-[#1ab394] text-white rounded-md text-xs font-semibold hover:bg-[#16987e] disabled:opacity-60">
                {importBusy ? "Importing…" : `Import ${preview.counts.toCreate + preview.counts.toUpdate} leads`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

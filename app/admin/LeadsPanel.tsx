"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { linkedinHref } from "@/lib/linkedin";
import { parseCsv, mapRowsToLeads, type MappedLead } from "@/lib/csv";

interface Lead {
  id: string;
  name: string | null;
  salutation: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
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

type SortKey = "firstName" | "lastName" | "name" | "company" | "leadScore" | "primaryTrack" | "createdAt";

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

  // Split display names into salutation/first/middle/last
  const [splitBusy, setSplitBusy] = useState(false);
  const [splitNote, setSplitNote] = useState<string | null>(null);

  const runSplitNames = async () => {
    setSplitBusy(true);
    setSplitNote(null);
    let updated = 0;
    try {
      for (let i = 0; i < 40; i++) {
        const res = await fetch("/api/admin/split-names", { method: "POST" });
        if (res.status === 401) { window.location.assign("/admin/login"); return; }
        const data = await res.json();
        if (!res.ok) { setSplitNote(data.error || "Could not split names."); return; }
        updated += data.updated || 0;
        if (data.done || (data.remaining ?? 0) === 0) break;
      }
      setSplitNote(`Split ${updated} names into first / middle / last. They're in the CSV export.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setSplitNote(err instanceof Error ? err.message : "Could not split names.");
    } finally {
      setSplitBusy(false);
    }
  };

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

  // Loop the batch endpoint until there are no nameless corporate leads left,
  // accumulating the matches it fills in so they can be reviewed.
  const runFindAll = async () => {
    setFindBusy(true);
    setFindError(null);
    let searched = 0;
    let applied = 0;
    const filled: FoundPerson[] = [];
    try {
      for (let i = 0; i < 80; i++) {
        const res = await fetch("/api/admin/find-person", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 10 }),
        });
        if (res.status === 401) { window.location.assign("/admin/login"); return; }
        const data = await res.json();
        if (!res.ok) { setFindError(data.error || "Search failed."); break; }
        searched += data.searched || 0;
        applied += data.applied || 0;
        for (const r of (data.results || [])) if (r.applied) filled.push(r);
        setFindResults([...filled]);
        setFindSummary(`Searched ${searched} · ${applied} found · ${data.remaining} left…`);
        // A persistent API error with nothing applied means a broken config —
        // stop rather than burn through the whole list.
        if (data.apiError && (data.applied || 0) === 0) { setFindError(`OpenAI note: ${data.apiError}`); break; }
        if ((data.remaining ?? 0) === 0) { setFindSummary(`Done — searched ${searched}, found ${applied} people.`); break; }
        await new Promise((r) => setTimeout(r, 400));
      }
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

  const th = "px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle whitespace-nowrap";
  const thSort = `${th} cursor-pointer select-none hover:text-ink`;
  const td = "px-3 py-2.5 text-xs text-ink align-middle";

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-3">
        <div className="relative lg:flex-1 lg:min-w-[220px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle text-sm">⌕</span>
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
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-line bg-white text-ink rounded-md text-xs font-semibold hover:bg-canvas transition whitespace-nowrap"
        >
          ↑ Import CSV
        </button>
        <a
          href={`/api/admin/leads/export?${query}`}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white rounded-md text-xs font-semibold hover:bg-accent-deep transition whitespace-nowrap"
        >
          ↓ Export CSV
        </a>
        <button
          onClick={() => setEnrichPhase("confirm")}
          disabled={enrichPhase === "running"}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-info bg-info-tint text-info rounded-md text-xs font-semibold hover:bg-info-tint transition whitespace-nowrap disabled:opacity-60"
        >
          ✦ Enrich from email
        </button>
        <button
          onClick={runFindPeople}
          disabled={findBusy}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-navy bg-canvas text-navy rounded-md text-xs font-semibold hover:bg-line transition whitespace-nowrap disabled:opacity-60"
        >
          {findBusy ? "Searching…" : "🔎 Find people (web · 10)"}
        </button>
        <button
          onClick={runSplitNames}
          disabled={splitBusy}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-line bg-white text-ink rounded-md text-xs font-semibold hover:bg-canvas transition whitespace-nowrap disabled:opacity-60"
        >
          {splitBusy ? "Splitting…" : "Split names"}
        </button>
      </div>

      {splitNote && (
        <div className="rounded-md border border-line bg-canvas px-3 py-2.5 text-xs text-ink flex items-center justify-between gap-3">
          <span>{splitNote}</span>
          <button onClick={() => setSplitNote(null)} className="text-subtle hover:text-ink">✕</button>
        </div>
      )}

      {findError && (
        <div role="alert" className="rounded-md border border-danger-tint bg-danger-tint px-3 py-2.5 text-xs text-danger">{findError}</div>
      )}

      {findResults && (
        <div className="ibox">
          <div className="ibox-title">
            <h3 className="text-sm font-semibold text-ink">Web search results</h3>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-subtle">{findSummary}</span>
              <button onClick={() => setFindResults(null)} className="text-subtle hover:text-ink">✕</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-canvas border-b border-line">
                <tr>
                  <th className={th}>Email</th>
                  <th className={th}>Found</th>
                  <th className={th}>Title</th>
                  <th className={th}>LinkedIn</th>
                  <th className={th}>Confidence</th>
                  <th className={th}>Saved</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {findResults.map((r, i) => (
                  <tr key={i} className="hover:bg-canvas">
                    <td className={`${td} text-muted`}>{r.email}</td>
                    <td className={`${td} text-ink font-medium`}>
                      {r.name || <span className="text-faint">—</span>}
                      {r.source && <a href={r.source} target="_blank" rel="noopener noreferrer" className="ml-2 text-info hover:underline">src ↗</a>}
                    </td>
                    <td className={`${td} text-muted`}>{r.title || "—"}</td>
                    <td className={td}>{r.linkedin ? <a href={r.linkedin} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">profile ↗</a> : "—"}</td>
                    <td className={td}>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${r.confidence === "high" ? "bg-success-tint text-success" : r.confidence === "medium" ? "bg-warn-tint text-warn" : "bg-line text-subtle"}`}>{r.confidence}</span>
                    </td>
                    <td className={td}>{r.applied ? <span className="text-success">✓</span> : <span className="text-faint">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ibox-content flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-[11px] text-subtle">Only high/medium confidence matches are saved. Review the sources, then keep going.</p>
            <div className="flex items-center gap-2">
              <button onClick={runFindPeople} disabled={findBusy} className="px-4 py-2 border border-navy text-navy rounded-md text-xs font-semibold hover:bg-canvas disabled:opacity-60">{findBusy ? "Searching…" : "Find 10 more"}</button>
              <button onClick={runFindAll} disabled={findBusy} className="px-4 py-2 bg-navy text-white rounded-md text-xs font-semibold hover:bg-navy disabled:opacity-60">{findBusy ? "Searching…" : "Find all remaining"}</button>
            </div>
          </div>
        </div>
      )}

      {enrichPhase === "confirm" && (
        <div className="rounded-md border border-info-tint bg-info-tint p-4 space-y-3">
          <p className="text-sm text-ink">
            Fill in <strong>company name, city/state, and company LinkedIn</strong> for your contacts with
            a work email, using AI to identify the company from each email domain. Personal emails
            (gmail, yahoo…) are skipped. Nothing is emailed, and existing data isn&apos;t overwritten.
          </p>
          <div className="flex items-center gap-3">
            <button onClick={runEnrichment} className="px-4 py-2 bg-info text-white rounded-md text-xs font-semibold hover:bg-info">Run enrichment</button>
            <button onClick={() => setEnrichPhase("idle")} className="px-4 py-2 border border-line rounded-md text-xs font-medium text-muted hover:bg-canvas">Cancel</button>
          </div>
        </div>
      )}

      {enrichPhase === "running" && (
        <div className="rounded-md border border-info-tint bg-info-tint px-3 py-2.5 text-xs text-info font-medium flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-info border-t-transparent animate-spin" />
          Enriching… {enrichUpdated} contacts updated{enrichRemaining != null ? ` · ${enrichRemaining} leads left to scan` : ""}
        </div>
      )}

      {enrichPhase === "done" && enrichNote && (
        <div className="rounded-md border border-success-tint bg-success-tint px-3 py-2.5 text-xs text-success flex items-center justify-between gap-3">
          <span>✦ {enrichNote}</span>
          <button onClick={() => setEnrichPhase("idle")} className="text-success/70 hover:text-success">✕</button>
        </div>
      )}
      {enrichPhase === "idle" && enrichNote && (
        <div role="alert" className="rounded-md border border-danger-tint bg-danger-tint px-3 py-2.5 text-xs text-danger">{enrichNote}</div>
      )}

      {importError && (
        <div role="alert" className="rounded-md border border-danger-tint bg-danger-tint px-3 py-2.5 text-xs text-danger">{importError}</div>
      )}
      {importDone && (
        <div className="rounded-md border border-success-tint bg-success-tint px-3 py-2.5 text-xs text-success">{importDone}</div>
      )}

      <div className="text-[11px] text-subtle">
        {loading ? "Loading leads…" : `${sorted.length} lead${sorted.length === 1 ? "" : "s"}${query ? " (filtered)" : ""}`}
      </div>

      {loading ? (
        <div className="p-12 text-center text-subtle text-xs">Loading records…</div>
      ) : sorted.length === 0 ? (
        <div className="ibox p-16 text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-line text-subtle flex items-center justify-center mx-auto">∅</div>
          <h2 className="text-base font-semibold text-ink">No leads match</h2>
          <p className="text-xs text-subtle">Try clearing the search or filters.</p>
        </div>
      ) : (
        <div className="ibox overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-canvas border-b border-line">
              <tr>
                <th className={thSort} onClick={() => toggleSort("firstName")}>First Name{arrow("firstName")}</th>
                <th className={thSort} onClick={() => toggleSort("lastName")}>Last Name{arrow("lastName")}</th>
                <th className={thSort} onClick={() => toggleSort("company")}>Company{arrow("company")}</th>
                <th className={th}>Contact</th>
                <th className={thSort} onClick={() => toggleSort("primaryTrack")}>Interest{arrow("primaryTrack")}</th>
                <th className={`${thSort} text-right`} onClick={() => toggleSort("leadScore")}>Score{arrow("leadScore")}</th>
                <th className={th}>Status</th>
                <th className={`${thSort} text-right`} onClick={() => toggleSort("createdAt")}>Captured{arrow("createdAt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sorted.map((l) => (
                <tr key={l.id} className="hover:bg-canvas">
                  <td className={`${td} text-ink font-semibold`} title={l.name || undefined}>
                    {[l.salutation, l.firstName].filter(Boolean).join(" ") || (l.name ? l.name.split(" ")[0] : "—")}
                  </td>
                  <td className={`${td} text-ink`}>{l.lastName || "—"}</td>
                  <td className={td}>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-ink">{l.company || "—"}</span>
                      {(l.city || l.state) && <span className="text-subtle">{[l.city, l.state].filter(Boolean).join(", ")}</span>}
                      {l.companyLinkedin && (
                        <a href={l.companyLinkedin} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">Company ↗</a>
                      )}
                    </div>
                  </td>
                  <td className={td}>
                    <div className="flex flex-col gap-0.5">
                      <a href={`mailto:${l.email}`} className="text-ink hover:text-accent">{l.email}</a>
                      {l.phone && <a href={`tel:${l.phone}`} className="text-subtle hover:text-accent">{l.phone}</a>}
                      {l.linkedinId && (
                        <a href={linkedinHref(l.linkedinId)} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">LinkedIn ↗</a>
                      )}
                    </div>
                  </td>
                  <td className={`${td} text-muted`}>{l.primaryTrack}</td>
                  <td className={`${td} text-right ${l.leadScore >= 80 ? "text-accent font-bold" : "text-ink"}`}>{l.leadScore}</td>
                  <td className={td}>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium tracking-wider bg-line text-muted">{l.leadStatus}</span>
                  </td>
                  <td className={`${td} text-right text-subtle whitespace-nowrap`}>{new Date(l.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Confirm import">
          <div className="w-full max-w-lg bg-white border border-line rounded-lg shadow-2xl p-6 space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-ink">Import leads</h3>
              <p className="text-xs text-subtle mt-1 truncate">{preview.fileName}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border border-success-tint bg-success-tint p-3 text-center">
                <div className="text-2xl font-bold text-success">{preview.counts.toCreate}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mt-0.5">New</div>
              </div>
              <div className="rounded-md border border-info-tint bg-info-tint p-3 text-center">
                <div className="text-2xl font-bold text-info">{preview.counts.toUpdate}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mt-0.5">Update</div>
              </div>
              <div className="rounded-md border border-line bg-canvas p-3 text-center">
                <div className="text-2xl font-bold text-subtle">{preview.counts.skipped}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted mt-0.5">Skipped</div>
              </div>
            </div>

            <div className="rounded-md border border-line bg-canvas p-3 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-subtle mb-1">Detected columns</div>
              {(["email", "name", "company", "phone", "linkedin"] as const).map((f) => (
                <div key={f} className="flex items-center justify-between text-xs">
                  <span className="text-muted capitalize">{f}</span>
                  <span className={preview.columns[f] ? "text-ink font-medium" : "text-faint"}>
                    {preview.columns[f] || "— not found"}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-subtle leading-relaxed">
              Matches on email: existing contacts are updated, the rest are added as <span className="text-muted font-medium">Client</span> records.
              Rows without a valid email are skipped. Nothing is emailed.
            </p>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button onClick={() => setPreview(null)} disabled={importBusy} className="px-4 py-2 border border-line rounded-md text-xs font-medium text-muted hover:bg-canvas disabled:opacity-60">Cancel</button>
              <button onClick={commitImport} disabled={importBusy || (preview.counts.toCreate + preview.counts.toUpdate === 0)} className="px-4 py-2 bg-accent text-white rounded-md text-xs font-semibold hover:bg-accent-deep disabled:opacity-60">
                {importBusy ? "Importing…" : `Import ${preview.counts.toCreate + preview.counts.toUpdate} leads`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

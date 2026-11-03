"use client";

import { useState } from "react";

/* Free tool: landing-page audit. Same shell as the launch door — drop a URL,
   get the observable pass/fail checks + score, then a CTA into the full launch. */

type Audit = { score: number; checks: { name: string; pass: boolean; detail: string }[] };

const GOLD = "#c2a15a";

export default function AuditFlow() {
  const [site, setSite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [audit, setAudit] = useState<Audit | null>(null);
  const [auditedSite, setAuditedSite] = useState("");

  const run = async () => {
    if (!site.trim()) { setError("Drop the page address in first."); return; }
    setBusy(true); setError(""); setAudit(null);
    try {
      const res = await fetch("/api/launch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: site.trim(), audit: true }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "Could not read that page.");
      setAudit(d.audit); setAuditedSite(site.trim());
    } catch (e: any) { setError(e.message || "Could not read that page."); }
    finally { setBusy(false); }
  };

  const grade = audit && (audit.score >= 80 ? "Strong" : audit.score >= 50 ? "Workable" : "Leaking");
  const goldBtn = "inline-flex items-center gap-2 rounded-full bg-[#c2a15a] px-6 py-3 text-sm font-semibold tracking-wide text-navy-deep transition hover:bg-[#d4b678] active:scale-[0.97]";

  return (
    <main className="min-h-screen bg-navy-deep text-white hb-body" style={{ background: "radial-gradient(120% 90% at 50% -10%, #1d3a55 0%, #10202e 55%, #0a1622 100%)" }}>
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <a href="/" className="hb-display text-lg tracking-wide text-white">Historic&nbsp;Broyhill</a>
        <a href="/tools" className="text-xs tracking-widest text-white/60 transition hover:text-white">ALL&nbsp;TOOLS</a>
      </header>

      <section className="mx-auto max-w-3xl px-6 pb-24 pt-16 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>Free tool</p>
        <h1 className="hb-display mt-4 text-4xl leading-tight sm:text-5xl" style={{ textWrap: "balance" }}>
          Score any landing page in seconds.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-white/70">
          Ten checks a stranger runs on your page before deciding to stay — free, no account needed.
        </p>

        <div className="mx-auto mt-10 flex max-w-xl items-center gap-2 rounded-full border border-white/15 bg-white/5 p-2 pl-5 backdrop-blur">
          <input
            value={site} onChange={(e) => setSite(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="yourbusiness.com" aria-label="Page to audit"
            className="w-full bg-transparent text-white placeholder-white/40 outline-none"
          />
          <button onClick={run} disabled={busy} className={`${goldBtn} disabled:opacity-60`}>{busy ? "Scoring…" : "Score it →"}</button>
        </div>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

        {audit && (
          <div className="mt-12 rounded-2xl border border-white/10 bg-white/5 p-6 text-left backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>{auditedSite}</p>
                <p className="hb-display mt-2 text-3xl">{grade}</p>
              </div>
              <div className="text-right">
                <p className="hb-display text-5xl" style={{ color: GOLD }}>{audit.score}</p>
                <p className="text-xs text-white/50">/ 100</p>
              </div>
            </div>
            <ul className="mt-6 space-y-3">
              {audit.checks.map((c) => (
                <li key={c.name} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-4">
                  <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${c.pass ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                    {c.pass ? "✓" : "✗"}
                  </span>
                  <div>
                    <p className="font-semibold text-white">{c.name}</p>
                    <p className="mt-0.5 text-sm text-white/60">{c.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl border border-[#c2a15a]/30 bg-black/40 p-5 text-center">
              <p className="hb-display text-xl">Now watch it get fixed.</p>
              <p className="mt-1 text-sm text-white/60">The launch preview reads your brand and drafts the page + campaign plan that passes every one of these.</p>
              <a href="/launch" className={`${goldBtn} mt-4`}>Launch the full preview →</a>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

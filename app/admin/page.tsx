"use client";

import React, { useCallback, useEffect, useState } from "react";
import LeadsPanel from "./LeadsPanel";
import ReviewPanel from "./ReviewPanel";
import Dashboard, { type Metrics, type Section } from "./Dashboard";

// --- Nav icons (inline so there's no icon dependency) ---
const icons: Record<Section, React.ReactNode> = {
  dashboard: <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />,
  leads: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  queue: <path d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />,
  history: <path d="M3 11l19-9-9 19-2-8-8-2z" />,
  settings: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />,
};

function NavIcon({ section }: { section: Section }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0">
      {icons[section]}
    </svg>
  );
}

const NAV: { key: Section; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "leads", label: "Leads" },
  { key: "queue", label: "Review Queue" },
  { key: "history", label: "Broadcasts" },
  { key: "settings", label: "Settings" },
];

const TITLES: Record<Section, string> = {
  dashboard: "Dashboard",
  leads: "Lead Directory",
  queue: "Review Queue",
  history: "Broadcast History",
  settings: "Settings",
};

export default function AdminConsole() {
  const [section, setSection] = useState<Section>("dashboard");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [navOpen, setNavOpen] = useState(false); // mobile drawer

  const refreshMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/metrics");
      if (res.status === 401) { window.location.assign("/admin/login"); return; }
      const data = await res.json();
      if (data.metrics) setMetrics(data.metrics);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { refreshMetrics(); }, [refreshMetrics, section]);

  const go = (s: Section) => { setSection(s); setNavOpen(false); };

  const signOut = async () => {
    try { await fetch("/api/admin/auth", { method: "DELETE" }); }
    finally { window.location.assign("/admin/login"); }
  };

  const navButton = (key: Section, label: string) => {
    const active = section === key;
    const badge = key === "queue" ? metrics?.pendingReview : key === "leads" ? metrics?.totalLeads : undefined;
    return (
      <button
        key={key}
        onClick={() => go(key)}
        aria-current={active ? "page" : undefined}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${active ? "bg-amber-500/10 text-amber-300 border border-amber-500/30" : "text-neutral-400 border border-transparent hover:text-neutral-100 hover:bg-neutral-800/60"}`}
      >
        <NavIcon section={key} />
        <span className="flex-1 text-left">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${key === "queue" ? "bg-amber-500 text-neutral-950" : "bg-neutral-800 text-neutral-300"}`}>{badge}</span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Mobile backdrop */}
      {navOpen && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-neutral-900/95 border-r border-neutral-800 flex flex-col transform transition-transform lg:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-5 py-5 border-b border-neutral-800">
          <h1 className="font-serif text-lg text-neutral-100 leading-tight">✧ Historic Broyhill</h1>
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-400/80 mt-0.5">Operations Console</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((n) => navButton(n.key, n.label))}
        </nav>
        <div className="p-3 border-t border-neutral-800">
          <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-neutral-400 hover:text-red-300 hover:bg-neutral-800/60 transition">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 md:px-8 py-4 bg-neutral-950/80 backdrop-blur border-b border-neutral-800">
          <button onClick={() => setNavOpen(true)} className="lg:hidden p-2 -ml-2 text-neutral-400 hover:text-neutral-100" aria-label="Open navigation">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-serif text-neutral-100">{TITLES[section]}</h2>
          </div>
          <button onClick={refreshMetrics} className="p-2 border border-neutral-800 bg-neutral-900 rounded-lg text-neutral-400 hover:text-neutral-100" aria-label="Refresh">↻</button>
        </header>

        <main className="p-4 md:p-8 max-w-6xl">
          {section === "dashboard" && <Dashboard metrics={metrics} onNavigate={go} />}
          {section === "leads" && <LeadsPanel />}
          {section === "queue" && <ReviewPanel mode="queue" onChanged={refreshMetrics} />}
          {section === "history" && <ReviewPanel mode="history" />}
          {section === "settings" && <SettingsPanel />}
        </main>
      </div>
    </div>
  );
}

// Read-only account & venue reference. Owner-published contact details
// (broyhill.net); no fabricated or editable settings.
function SettingsPanel() {
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2.5 border-b border-neutral-800/60 last:border-0">
      <span className="text-xs font-mono uppercase tracking-wider text-neutral-500">{label}</span>
      <span className="text-sm text-neutral-200">{value}</span>
    </div>
  );
  return (
    <div className="space-y-6 max-w-2xl">
      <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-neutral-200 mb-2">Session</h3>
        <p className="text-xs text-neutral-500 leading-relaxed">
          You are signed in with the staff passcode. Access expires automatically after 12 hours, or use
          Sign Out in the sidebar to end this session now.
        </p>
      </section>

      <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-neutral-200 mb-3">Venue contact</h3>
        {row("Address", "3540 Clemmons Road, Suite 111, Clemmons, NC 27012")}
        {row("Phone", <a href="tel:+13367931191" className="text-amber-400 hover:text-amber-300">336-793-1191</a>)}
        {row("Email", <a href="mailto:Info@Broyhill.net" className="text-amber-400 hover:text-amber-300">Info@Broyhill.net</a>)}
        {row("Bookings", <a href="https://broyhill.skedda.com" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">broyhill.skedda.com ↗</a>)}
        {row("Website", <a href="https://www.broyhill.net" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">www.broyhill.net ↗</a>)}
      </section>
    </div>
  );
}

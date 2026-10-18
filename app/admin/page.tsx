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
        className={`ins-navitem ${active ? "is-active" : ""} w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] font-medium`}
      >
        <NavIcon section={key} />
        <span className="flex-1 text-left">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${key === "queue" ? "bg-[#1ab394] text-white" : "bg-white/10 text-[#aab8c5]"}`}>{badge}</span>
        )}
      </button>
    );
  };

  return (
    <div className="ins-app min-h-screen">
      {/* Mobile backdrop */}
      {navOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      {/* Sidebar */}
      <aside className={`ins-sidebar fixed inset-y-0 left-0 z-40 w-64 flex flex-col transform transition-transform lg:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-5 py-4 border-b border-white/10">
          <h1 className="font-semibold text-[15px] text-white leading-tight">✦ Historic Broyhill</h1>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#1ab394] mt-0.5">Operations Console</p>
        </div>

        {/* User block */}
        <div className="px-5 py-4 flex items-center gap-3 border-b border-white/10">
          <div className="h-9 w-9 rounded-full bg-[#1ab394]/20 text-[#1ab394] grid place-items-center text-sm font-semibold">HB</div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white truncate">Staff Member</div>
            <div className="text-[11px] text-[#8ca3bd]">Signed in</div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="ins-navlabel px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em]">Navigation</p>
          {NAV.map((n) => navButton(n.key, n.label))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button onClick={signOut} className="ins-navitem w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-[13px] hover:!text-red-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 md:px-8 h-[65px] bg-white border-b border-[#e7e9eb]">
          <button onClick={() => setNavOpen(true)} className="lg:hidden p-2 -ml-2 text-[#6c757d] hover:text-[#323a46]" aria-label="Open navigation">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>
          <div className="flex-1">
            <h2 className="text-[17px] font-semibold text-[#323a46]">{TITLES[section]}</h2>
          </div>
          <button onClick={refreshMetrics} className="h-9 w-9 grid place-items-center border border-[#e7e9eb] bg-white rounded-md text-[#6c757d] hover:text-[#1ab394] hover:border-[#1ab394]/40" aria-label="Refresh">↻</button>
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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2.5 border-b border-[#e7e9eb] last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9ba6b7]">{label}</span>
      <span className="text-sm text-[#323a46]">{value}</span>
    </div>
  );
  return (
    <div className="space-y-6 max-w-2xl">
      <section className="ibox">
        <div className="ibox-title"><h3 className="text-sm font-semibold text-[#323a46]">Session</h3></div>
        <div className="ibox-content">
          <p className="text-[13px] text-[#6c757d] leading-relaxed">
            You are signed in with the staff passcode. Access expires automatically after 12 hours, or use
            Sign Out in the sidebar to end this session now.
          </p>
        </div>
      </section>

      <section className="ibox">
        <div className="ibox-title"><h3 className="text-sm font-semibold text-[#323a46]">Venue contact</h3></div>
        <div className="ibox-content pt-1">
          {row("Address", "3540 Clemmons Road, Suite 111, Clemmons, NC 27012")}
          {row("Phone", <a href="tel:+13367931191" className="text-[#1ab394] hover:underline">336-793-1191</a>)}
          {row("Email", <a href="mailto:Info@Broyhill.net" className="text-[#1ab394] hover:underline">Info@Broyhill.net</a>)}
          {row("Bookings", <a href="https://broyhill.skedda.com" target="_blank" rel="noopener noreferrer" className="text-[#1ab394] hover:underline">broyhill.skedda.com ↗</a>)}
          {row("Website", <a href="https://www.broyhill.net" target="_blank" rel="noopener noreferrer" className="text-[#1ab394] hover:underline">www.broyhill.net ↗</a>)}
        </div>
      </section>
    </div>
  );
}

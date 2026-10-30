"use client";

import React, { useCallback, useEffect, useState } from "react";
import LeadsPanel from "./LeadsPanel";
import ReviewPanel from "./ReviewPanel";
import AskPanel from "./AskPanel";
import CampaignsPanel from "./CampaignsPanel";
import TemplatesPanel from "./TemplatesPanel";
import PhotosPanel from "./PhotosPanel";
import StockSearch from "./StockSearch";
import StudioPanel from "./StudioPanel";
import ExamplesPanel from "./ExamplesPanel";
import BrandPanel from "./BrandPanel";
import type { Example } from "@/lib/examples";
import type { SocialPrefill } from "./SocialPanel";
import type { TextPrefill } from "./TemplatesPanel";
import type { VideoPrefill } from "./VideoPanel";
import SocialPanel from "./SocialPanel";
import VideoPanel from "./VideoPanel";
import Dashboard, { type Metrics, type Section } from "./Dashboard";

// --- Nav icons (inline so there's no icon dependency) ---
const icons: Record<Section, React.ReactNode> = {
  dashboard: <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />,
  leads: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  queue: <path d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />,
  history: <path d="M3 11l19-9-9 19-2-8-8-2z" />,
  campaigns: <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6" />,
  examples: <path d="M3 5a2 2 0 0 1 2-2h4v8H3zM13 3h6a2 2 0 0 1 2 2v3h-8zM13 12h8v7a2 2 0 0 1-2 2h-6zM3 15h6v6H5a2 2 0 0 1-2-2z" />,
  templates: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" />,
  studio: <path d="M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.6 7.6" />,
  social: <path d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />,
  video: <path d="M23 7l-7 5 7 5V7zM3 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />,
  photos: <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
  stock: <path d="M12 2l3 6.5 7 .9-5.1 4.8 1.3 7L12 17.8 5.8 21.2l1.3-7L2 9.4l7-.9z" />,
  ask: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  brand: <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.3 7.2 16.9l.9-5.4L4.2 7.7l5.4-.8z" />,
  settings: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />,
};

function NavIcon({ section }: { section: Section }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px] shrink-0">
      {icons[section]}
    </svg>
  );
}

const NAV_GROUPS: { heading: string | null; items: { key: Section; label: string }[] }[] = [
  { heading: null, items: [{ key: "dashboard", label: "Today" }] },
  { heading: "People", items: [{ key: "leads", label: "Leads" }] },
  { heading: "Outreach", items: [
    { key: "campaigns", label: "Email campaigns" },
    { key: "queue", label: "Review queue" },
    { key: "history", label: "Sent" },
  ] },
  { heading: "Content", items: [
    { key: "examples", label: "Examples" },
    { key: "templates", label: "Templates" },
    { key: "studio", label: "Email studio" },
    { key: "social", label: "Social posts" },
    { key: "video", label: "Video" },
    { key: "photos", label: "Photo library" },
    { key: "stock", label: "Free media" },
  ] },
  { heading: "Tools", items: [
    { key: "ask", label: "Ask" },
    { key: "brand", label: "Brand setup" },
    { key: "settings", label: "Venue & account" },
  ] },
];

const TITLES: Record<Section, string> = {
  dashboard: "Today",
  leads: "Leads",
  queue: "Review queue",
  history: "Sent broadcasts",
  campaigns: "Email campaigns",
  examples: "Examples",
  templates: "Templates",
  studio: "Email studio",
  social: "Social posts",
  video: "Video",
  photos: "Photo library",
  stock: "Free media",
  ask: "Ask",
  brand: "Brand setup",
  settings: "Venue & account",
};

export default function AdminConsole() {
  const [section, setSection] = useState<Section>("dashboard");
  const [studioId, setStudioId] = useState<string | null>(null);
  const [studioStarter, setStudioStarter] = useState<string | null>(null);
  const [socialPrefill, setSocialPrefill] = useState<SocialPrefill | null>(null);
  const [textPrefill, setTextPrefill] = useState<TextPrefill | null>(null);
  const [videoPrefill, setVideoPrefill] = useState<VideoPrefill | null>(null);
  // An example opens in its tool with everything filled in; the person edits and saves their own copy.
  const useExample = (ex: Example) => {
    switch (ex.channel) {
      case "email": setStudioId(null); setStudioStarter(ex.starterId); setSection("studio"); break;
      case "social": setSocialPrefill({ key: ex.id, platform: ex.social.platform, title: ex.title, caption: ex.social.caption, hashtags: ex.social.hashtags, mediaUrl: ex.social.photo, imageAlt: ex.social.imageAlt }); setSection("social"); break;
      case "sms": case "mms": setTextPrefill({ key: ex.id, channel: ex.channel, draft: { name: ex.title, subject: "", previewText: "", body: ex.text.body, mediaUrl: ex.text.mediaUrl ?? "", category: ex.category, kind: ex.kind } }); setSection("templates"); break;
      case "photo": setSocialPrefill({ key: ex.id, platform: "facebook", title: ex.photo.alt, caption: "", hashtags: [], mediaUrl: ex.photo.url, imageAlt: ex.photo.alt }); setSection("social"); break;
      case "video": setVideoPrefill({ key: ex.id, name: ex.title, storyboard: ex.video.storyboard }); setSection("video"); break;
    }
  };
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [navOpen, setNavOpen] = useState(false); // mobile drawer
  const [askSeed, setAskSeed] = useState<string | undefined>(); // question typed on the Dashboard

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

  const go = (s: Section) => { setSection(s); setNavOpen(false); setAskSeed(undefined); };

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
        className={`ins-navitem ${active ? "is-active" : ""} w-full flex items-center gap-3 px-3 min-h-[44px] rounded-md text-[14px]`}
      >
        <span className="ins-navdot h-1.5 w-1.5 rounded-full bg-transparent shrink-0" aria-hidden="true" />
        <NavIcon section={key} />
        <span className="flex-1 text-left">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className={`text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded ${key === "queue" ? "bg-accent-bright text-navy-deep" : "bg-white/10 text-white/80"}`}>{badge}</span>
        )}
      </button>
    );
  };

  return (
    <div className="ins-app min-h-screen">
      {/* Mobile backdrop */}
      {navOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      {/* Sidebar */}
      <aside className={`ins-sidebar fixed inset-y-0 left-0 z-40 w-64 flex flex-col transform transition-transform motion-reduce:transition-none lg:translate-x-0 ${navOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          <h1 className="text-[22px] text-white leading-none">Historic Broyhill</h1>
          <p className="text-[13px] text-accent-bright mt-1.5">Back office</p>
        </div>

        <nav className="flex-1 px-3 py-3 overflow-y-auto" aria-label="Console sections">
          {NAV_GROUPS.map((g, i) => (
            <div key={g.heading ?? i} className={i === 0 ? "" : "mt-5"}>
              {g.heading && <p className="ins-navlabel px-3 pb-1 text-[12px]">{g.heading}</p>}
              <div className="space-y-0.5">{g.items.map((n) => navButton(n.key, n.label))}</div>
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button onClick={signOut} className="ins-navitem w-full flex items-center gap-3 px-3 min-h-[44px] rounded-md text-[14px]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 md:px-8 h-16 bg-canvas/95 backdrop-blur-sm border-b border-line">
          <button onClick={() => setNavOpen(true)} className="lg:hidden h-11 w-11 -ml-2 grid place-items-center text-muted hover:text-ink" aria-label="Open navigation">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-5 w-5"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>
          <div className="flex-1">
            <h2 className="text-[22px] text-ink leading-none">{TITLES[section]}</h2>
          </div>
          <button onClick={refreshMetrics} className="h-11 px-3 inline-flex items-center gap-2 border border-line bg-white rounded-md text-[13px] text-muted hover:text-ink hover:border-faint" aria-label="Refresh counts">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
            Refresh
          </button>
        </header>

        <main className="p-4 md:p-8 max-w-6xl">
          {section === "dashboard" && <Dashboard metrics={metrics} onNavigate={go} onAsk={(q) => { go("ask"); setAskSeed(q); }} />}
          {section === "leads" && <LeadsPanel />}
          {section === "queue" && <ReviewPanel mode="queue" onChanged={refreshMetrics} />}
          {section === "history" && <ReviewPanel mode="history" />}
          {section === "campaigns" && <CampaignsPanel />}
          {section === "examples" && <ExamplesPanel onUse={useExample} />}
          {section === "templates" && <TemplatesPanel prefill={textPrefill} onOpenStudio={(id) => { setStudioStarter(null); setStudioId(id); setSection("studio"); }} onOpenStarter={(id) => { setStudioId(null); setStudioStarter(id); setSection("studio"); }} />}
          {section === "studio" && <StudioPanel openId={studioId} openStarter={studioStarter} />}
          {section === "social" && <SocialPanel prefill={socialPrefill} />}
          {section === "video" && <VideoPanel prefill={videoPrefill} />}
          {section === "photos" && <PhotosPanel />}
          {section === "stock" && <StockSearch onOpenLibrary={() => go("photos")} />}
          {section === "ask" && <AskPanel onChanged={refreshMetrics} seed={askSeed} />}
          {section === "brand" && <BrandPanel />}
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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2.5 border-b border-line last:border-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
  return (
    <div className="space-y-6 max-w-2xl">
      <section className="ibox">
        <div className="ibox-title"><h3 className="text-sm font-semibold text-ink">Session</h3></div>
        <div className="ibox-content">
          <p className="text-[13px] text-muted leading-relaxed">
            You are signed in with the staff passcode. Access expires automatically after 12 hours, or use
            Sign Out in the sidebar to end this session now.
          </p>
        </div>
      </section>

      <section className="ibox">
        <div className="ibox-title"><h3 className="text-sm font-semibold text-ink">Venue contact</h3></div>
        <div className="ibox-content pt-1">
          {row("Address", "3540 Clemmons Road, Suite 111, Clemmons, NC 27012")}
          {row("Phone", <a href="tel:+13367931191" className="text-accent hover:underline">336-793-1191</a>)}
          {row("Email", <a href="mailto:Info@Broyhill.net" className="text-accent hover:underline">Info@Broyhill.net</a>)}
          {row("Bookings", <a href="https://broyhill.skedda.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">broyhill.skedda.com ↗</a>)}
          {row("Website", <a href="https://www.broyhill.net" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">www.broyhill.net ↗</a>)}
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

/* The front door — the "drop your URL → watch the machine work on YOUR brand →
   get the plan" journey, on Historic Broyhill tokens (near-black navy + gold).
   Stages: enter → working → reveal → captured. */

type PlanStep = { step: string; detail: string; channel: string };
type Plan = { competitors: { name: string; why: string }[]; positioning: string; plan: PlanStep[] };
type Brand = {
  website: string; name: string; tagline: string; logoUrl: string; iconUrl: string;
  colors: { primary: string; secondary: string; background: string };
  address: { city: string; state: string };
  phone: string; email: string;
  socials: Record<string, string>;
};

const TICKS = ["Reading your site", "Lifting your brand", "Scanning competitors", "Drafting your campaign plan"];

const GOLD = "#c2a15a";

export default function LaunchFlow() {
  const [stage, setStage] = useState<"enter" | "working" | "reveal" | "captured">("enter");
  const [site, setSite] = useState("");
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [data, setData] = useState<{ brand: Brand; found: string[]; plan: Plan; channels: string[] } | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const start = async () => {
    if (!site.trim()) { setError("Drop your website address in first."); return; }
    setError(""); setStage("working"); setTick(0);
    // Steps reveal one by one while the real call runs — matches the Larven beat:
    // the machine visibly works on YOUR brand.
    TICKS.forEach((_, i) => timers.current.push(setTimeout(() => setTick(i), 600 + i * 1400)));
    try {
      const res = await fetch("/api/launch", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: site.trim() }),
      });
      const d = await res.json();
      if (!res.ok || !d.success) throw new Error(d.error || "Could not read that site.");
      // Let the last tick land before the reveal.
      setData(d);
      timers.current.push(setTimeout(() => setStage("reveal"), 1200));
    } catch (e: any) {
      timers.current.push(setTimeout(() => { setError(e.message || "Could not read that site."); setStage("enter"); }, 800));
    }
  };

  const claim = async () => {
    if (!email.trim()) { setError("Your email first — that's where the plan goes."); return; }
    setSending(true); setError("");
    try {
      const res = await fetch("/api/capture", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(), name: name.trim() || data?.brand?.name || "Valued Contact",
          company: data?.brand?.name || "", notes: `Launch preview for ${data?.brand?.website || site}`,
          tags: ["launch", "self-serve"],
        }),
      });
      if (!res.ok) throw new Error("Could not save that just now — try again.");
      setStage("captured");
    } catch (e: any) { setError(e.message); }
    finally { setSending(false); }
  };

  const shell = "min-h-screen bg-navy-deep text-white hb-body";
  const goldBtn = "inline-flex items-center gap-2 rounded-full bg-[#c2a15a] px-6 py-3 text-sm font-semibold tracking-wide text-navy-deep transition hover:bg-[#d4b678] active:scale-[0.97]";

  if (stage === "enter" || stage === "working") {
    return (
      <main className={`${shell} flex flex-col`} style={{ background: "radial-gradient(120% 90% at 50% -10%, #1d3a55 0%, #10202e 55%, #0a1622 100%)" }}>
        <header className="flex items-center justify-between px-6 py-5 sm:px-10">
          <a href="/" className="hb-display text-lg tracking-wide text-white">Historic&nbsp;Broyhill</a>
          <a href="/admin/login" className="text-xs tracking-widest text-white/60 transition hover:text-white">SIGN&nbsp;IN</a>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
          <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>Your brand, launched</p>
          <h1 className="hb-display max-w-3xl text-4xl leading-tight sm:text-6xl" style={{ textWrap: "balance" }}>
            Stop waiting on an agency to build your campaign.
          </h1>
          <p className="mt-6 max-w-xl text-base text-white/70 sm:text-lg">
            Drop your website. We read your brand, find your competitors, and draft your campaign plan — in about a minute.
          </p>

          {stage === "enter" && (
            <div className="mt-10 w-full max-w-xl">
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 p-2 pl-5 backdrop-blur">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-white/50"><path d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                <input
                  value={site} onChange={(e) => setSite(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && start()}
                  placeholder="yourbusiness.com" aria-label="Your website address"
                  className="w-full bg-transparent text-white placeholder-white/40 outline-none"
                />
                <button onClick={start} className={goldBtn}>Launch&nbsp;→</button>
              </div>
              {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
              <p className="mt-4 text-xs text-white/40">Free preview · no card · cancel anytime</p>
            </div>
          )}

          {stage === "working" && (
            <div className="mt-12 w-full max-w-xl rounded-2xl border border-white/10 bg-black/40 p-6 text-left backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/80">Reading <span className="font-semibold text-white">{site}</span></p>
                <span className="rounded-full border border-[#c2a15a]/40 bg-[#c2a15a]/10 px-3 py-1 text-[10px] font-bold tracking-widest" style={{ color: GOLD }}>RUNNING</span>
              </div>
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${((tick + 1) / TICKS.length) * 100}%`, background: GOLD }} />
              </div>
              <ul className="mt-5 space-y-3">
                {TICKS.map((t, i) => (
                  <li key={t} className={`flex items-center gap-3 text-sm transition-opacity ${i <= tick ? "opacity-100" : "opacity-30"}`}>
                    {i < tick ? <span style={{ color: GOLD }}>✓</span> : i === tick ? <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: GOLD }} /> : <span className="inline-block h-2 w-2 rounded-full bg-white/20" />}
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    );
  }

  if (stage === "captured") {
    return (
      <main className={`${shell} flex items-center justify-center px-6`} style={{ background: "radial-gradient(120% 90% at 50% -10%, #1d3a55 0%, #10202e 55%, #0a1622 100%)" }}>
        <div className="max-w-md text-center">
          <p className="hb-display text-4xl" style={{ color: GOLD }}>You're on the board.</p>
          <p className="mt-4 text-white/70">Your campaign plan is headed to <span className="text-white">{email}</span>. A person from our team will walk it with you — no card, no retainer, no lock-in.</p>
          <a href="/" className={`${goldBtn} mt-8`}>Back to the building</a>
        </div>
      </main>
    );
  }

  const brand = data!.brand;
  const plan = data!.plan;
  const socials = Object.entries(brand.socials).filter(([, v]) => v);

  return (
    <main className={shell} style={{ background: "radial-gradient(120% 90% at 50% -10%, #1d3a55 0%, #10202e 55%, #0a1622 100%)" }}>
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <a href="/" className="hb-display text-lg tracking-wide text-white">Historic&nbsp;Broyhill</a>
        <button onClick={() => { setStage("enter"); setData(null); }} className="text-xs tracking-widest text-white/60 transition hover:text-white">START&nbsp;OVER</button>
      </header>

      <section className="mx-auto grid w-full max-w-5xl gap-6 px-6 pb-24 lg:grid-cols-2">
        {/* Brand card — what the machine lifted off their own site */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>Your brand, lifted</p>
          <div className="mt-5 flex items-center gap-4">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt={`${brand.name} logo`} onError={(e) => { e.currentTarget.style.display = "none"; }} className="h-14 w-14 rounded-xl bg-white object-contain p-1" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl hb-display text-2xl" style={{ background: brand.colors.primary, color: "#fff" }}>{(brand.name || "?").slice(0, 1)}</div>
            )}
            <div>
              <p className="hb-display text-2xl">{brand.name || "Your business"}</p>
              <p className="text-sm text-white/60">{brand.tagline || brand.website}</p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2">
            {([brand.colors.primary, brand.colors.secondary, brand.colors.background] as const).map((c) => (
              <div key={c} className="h-8 w-8 rounded-lg border border-white/20" style={{ background: c }} title={c} />
            ))}
            <p className="ml-2 text-xs text-white/50">Your palette</p>
          </div>
          {(brand.address.city || brand.phone || socials.length > 0) && (
            <div className="mt-5 space-y-1 text-sm text-white/70">
              {brand.address.city && <p>{[brand.address.city, brand.address.state].filter(Boolean).join(", ")}</p>}
              {brand.phone && <p>{brand.phone}</p>}
              {socials.length > 0 && <p className="text-white/50">{socials.length} social link{socials.length > 1 ? "s" : ""} found</p>}
            </div>
          )}
        </div>

        {/* Competitors + positioning */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>The field around you</p>
          {plan.competitors.length > 0 ? (
            <ul className="mt-5 space-y-4">
              {plan.competitors.map((c) => (
                <li key={c.name} className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="font-semibold text-white">{c.name}</p>
                  <p className="mt-1 text-sm text-white/60">{c.why}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-white/60">Competitor scan runs deeper once we connect your market — your plan below is already drafted.</p>
          )}
          {plan.positioning && <p className="mt-5 hb-display text-lg italic text-white/80">“{plan.positioning}”</p>}
        </div>

        {/* The plan — full width */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur lg:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>Your campaign plan</p>
          <ol className="mt-5 space-y-4">
            {plan.plan.map((s, i) => (
              <li key={i} className="flex gap-4 rounded-xl border border-white/10 bg-black/30 p-4">
                <span className="hb-display text-2xl" style={{ color: GOLD }}>{String(i + 1).padStart(2, "0")}</span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">{s.step}</p>
                    <span className="rounded-full border border-[#c2a15a]/40 bg-[#c2a15a]/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide" style={{ color: GOLD }}>{s.channel}</span>
                  </div>
                  <p className="mt-1 text-sm text-white/60">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>Sixteen channels, one orchestrator</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data!.channels.map((c) => (
              <span key={c} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">{c}</span>
            ))}
          </div>

          {/* Claim CTA */}
          <div className="mt-8 rounded-xl border border-[#c2a15a]/30 bg-black/40 p-5">
            <p className="hb-display text-xl">Claim this plan.</p>
            <p className="mt-1 text-sm text-white/60">Leave your email — the plan goes out, and a person walks it with you.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name"
                className="w-full rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm text-white placeholder-white/40 outline-none focus:border-[#c2a15a]" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" type="email" aria-label="Your email"
                className="w-full rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm text-white placeholder-white/40 outline-none focus:border-[#c2a15a]" />
              <button onClick={claim} disabled={sending} className={`${goldBtn} justify-center whitespace-nowrap disabled:opacity-60`}>
                {sending ? "Sending…" : "Send me the plan →"}
              </button>
            </div>
            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          </div>
        </div>
      </section>
    </main>
  );
}

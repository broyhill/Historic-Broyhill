import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free marketing tools — Historic Broyhill",
  description: "Free tools that show what the machine reads: launch preview, landing-page audit, and more — no account needed.",
};

const GOLD = "#c2a15a";

const TOOLS = [
  {
    href: "/launch",
    name: "Launch preview",
    desc: "Drop your website — we read your brand, find your competitors, and draft your campaign plan in about a minute.",
    live: true,
  },
  {
    href: "/tools/landing-page-audit",
    name: "Landing page audit",
    desc: "Score any landing page in seconds — ten checks that decide whether a page converts or just exists.",
    live: true,
  },
  {
    href: "/launch",
    name: "Competitor scan",
    desc: "The machine names the field around you — who else is fishing your pond, and how your plan beats them.",
    live: true,
    note: "Runs inside the launch preview.",
  },
];

export default function ToolsPage() {
  return (
    <main className="min-h-screen bg-navy-deep text-white hb-body" style={{ background: "radial-gradient(120% 90% at 50% -10%, #1d3a55 0%, #10202e 55%, #0a1622 100%)" }}>
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <a href="/" className="hb-display text-lg tracking-wide text-white">Historic&nbsp;Broyhill</a>
        <a href="/launch" className="text-xs tracking-widest text-white/60 transition hover:text-white">LAUNCH&nbsp;→</a>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-24 pt-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em]" style={{ color: GOLD }}>Free tools</p>
        <h1 className="hb-display mt-4 max-w-2xl text-4xl leading-tight sm:text-5xl" style={{ textWrap: "balance" }}>
          Never start from a blank page.
        </h1>
        <p className="mt-4 max-w-xl text-white/70">
          Free to use, no account needed. Each tool shows you what the machine already knows how to read — then turns the answer into a campaign.
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <a key={t.name} href={t.href} className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:border-[#c2a15a]/50 hover:bg-white/10">
              <div className="flex items-center justify-between">
                <p className="hb-display text-2xl">{t.name}</p>
                <span className="rounded-full border border-[#c2a15a]/40 bg-[#c2a15a]/10 px-2.5 py-0.5 text-[10px] font-bold tracking-widest" style={{ color: GOLD }}>FREE</span>
              </div>
              <p className="mt-3 text-sm text-white/60">{t.desc}</p>
              {t.note && <p className="mt-2 text-xs text-white/40">{t.note}</p>}
              <p className="mt-4 text-sm font-semibold" style={{ color: GOLD }}>Open →</p>
            </a>
          ))}
        </div>

        <div className="mt-16 rounded-2xl border border-white/10 bg-black/30 p-6">
          <p className="hb-display text-xl">What the audit is really scoring</p>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            A landing page has one job: get the next step taken. Everything on these checklists is something a
            stranger decides in the first seconds — is this a real business, what do they sell, what do I do next.
            The tools score the observable signals, never a guess: a title a searcher can read, one clear headline,
            a button that asks for the action, a way to reach a human.
          </p>
          <a href="/launch" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#c2a15a] px-6 py-3 text-sm font-semibold tracking-wide text-navy-deep transition hover:bg-[#d4b678] active:scale-[0.97]">
            Turn the answer into a campaign →
          </a>
        </div>
      </section>
    </main>
  );
}

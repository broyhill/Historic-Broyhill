import InquiryForm from "./components/InquiryForm";

/* Historic Broyhill — public site.
   Warm, heritage-premium theme (distinct from the dark staff console).
   Content is from the owner's own material; unverified facts are marked [CONFIRM]
   and images are TODO-PHOTO placeholders until real photos are supplied. No lodging. */

const SPACES = [
  {
    name: "Magnolia Room",
    capacity: "20–120 seated · up to 140 for a standing reception",
    blurb: "Our signature hall for ceremonies, receptions, rehearsal dinners, and milestone gatherings, with overflow to the lobby lounge and courtyard patio.",
    photo: "The Magnolia Room set for a reception",
  },
  {
    name: "The Boardrooms",
    capacity: "By the day or half-day · [CONFIRM] capacity",
    blurb: "Boardroom tables, upholstered seating, whiteboards, and Wi-Fi — open to tenants and the public for meetings and working sessions.",
    photo: "A Boardroom set for a meeting",
  },
  {
    name: "The Dock",
    capacity: "Outdoor · [CONFIRM] capacity",
    blurb: "A large covered stage with open-air seating — made for smaller outdoor events, live music, and food-truck evenings.",
    photo: "The Dock's covered outdoor stage",
  },
  {
    name: "The Loft",
    capacity: "Up to 20 · est. 2023",
    blurb: "An intimate suite — boardroom or lounge seating, a private bath, and a coffee bar — available lock-and-key for multi-day meetings.",
    photo: "The Loft lounge seating",
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b0894f]">{children}</p>;
}

function Photo({ caption, className = "" }: { caption: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-[#e0d6c2] bg-[#efe7d6] ${className}`}>
      <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 30% 25%, #e7dcc6 0, transparent 60%), radial-gradient(circle at 75% 80%, #e2d6bd 0, transparent 55%)" }} />
      <div className="relative flex h-full min-h-[180px] flex-col items-center justify-center gap-1.5 px-4 text-center">
        <span className="text-[#b0894f]/80 text-lg">◢</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a2906f]">Photo</span>
        <span className="text-xs text-[#8c7d5f]">{caption}</span>
      </div>
    </div>
  );
}

const Confirm = () => (
  <span className="ml-1 rounded bg-[#b0894f]/12 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-[#9a7739]">confirm</span>
);

export default function Home() {
  return (
    <main className="bg-[#faf6ee] text-[#2a3942]">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-[#e7ddc9] bg-[#faf6ee]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <a href="#top" className="font-serif text-lg tracking-wide text-[#13303f]">
            Historic Broyhill
          </a>
          <nav className="hidden items-center gap-7 text-sm text-[#4b5a63] md:flex">
            <a href="#spaces" className="hover:text-[#13303f]">Event Spaces</a>
            <a href="#offices" className="hover:text-[#13303f]">Offices</a>
            <a href="#studio" className="hover:text-[#13303f]">Podcast Studio</a>
            <a href="#visit" className="hover:text-[#13303f]">Visit</a>
          </nav>
          <a href="#visit" className="rounded-lg bg-[#13303f] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#f7f1e4] transition hover:bg-[#1b4256]">
            Request a tour
          </a>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-24">
          <div>
            <Eyebrow>Clemmons, North Carolina · a 1920s landmark</Eyebrow>
            <h1 className="mt-4 font-serif text-4xl leading-[1.08] text-[#13303f] sm:text-5xl md:text-[3.4rem]">
              Where the walls hold generations of memories.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[#4b5a63]">
              A restored 1920s schoolhouse, minutes from downtown Winston-Salem — now home to
              Southern-charm event spaces, Class A executive offices, a virtual office program,
              and a turnkey podcast studio.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#visit" className="rounded-lg bg-[#8f1f1f] px-6 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#f7f1e4] transition hover:bg-[#a52828]">
                Request a tour
              </a>
              <a href="#spaces" className="rounded-lg border border-[#13303f]/25 px-6 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#13303f] transition hover:border-[#13303f]/50">
                Explore the spaces
              </a>
            </div>
          </div>
          <Photo caption="The checkerboard foyer — chandelier & arched entry" className="aspect-[4/5] md:aspect-[4/5]" />
        </div>
      </section>

      {/* Heritage */}
      <section className="border-y border-[#e7ddc9] bg-[#f3ecdd]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr] md:items-center">
            <div>
              <Eyebrow>Our story</Eyebrow>
              <h2 className="mt-4 font-serif text-3xl leading-tight text-[#13303f] md:text-[2.5rem]">
                This building houses memories. It houses dreams.
              </h2>
            </div>
            <div className="space-y-4 text-[16px] leading-relaxed text-[#4b5a63]">
              <p>
                Nearly a century ago <Confirm /> this was a Clemmons schoolhouse. Ed Broyhill
                reimagined it <span className="whitespace-nowrap">around 2006</span> <Confirm /> as a
                home for small businesses and celebrations — keeping the character of the original
                architecture while bringing in modern amenities.
              </p>
              <p>
                Today it blends the tradition of the Clemmons community with executive office suites,
                meeting rooms, event spaces, and a reception venue — the perfect Southern-charm
                backdrop for your next gathering, with onsite event planners to help with the details.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Event spaces */}
      <section id="spaces" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Event spaces</Eyebrow>
          <h2 className="mt-4 font-serif text-3xl text-[#13303f] md:text-[2.5rem]">Gather in a space with a story.</h2>
          <p className="mt-4 text-[16px] leading-relaxed text-[#4b5a63]">
            Four distinct settings for weddings, receptions, reunions, corporate celebrations, and
            meetings — from a grand hall to an open-air stage. Pricing available on request <Confirm />.
          </p>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {SPACES.map((s) => (
            <article key={s.name} className="group overflow-hidden rounded-2xl border border-[#e7ddc9] bg-white/60 transition hover:shadow-[0_18px_40px_-24px_rgba(19,48,63,0.45)]">
              <Photo caption={s.photo} className="aspect-[16/10] rounded-none border-0 border-b border-[#e7ddc9]" />
              <div className="p-6">
                <h3 className="font-serif text-xl text-[#13303f]">{s.name}</h3>
                <p className="mt-1 text-[13px] font-medium uppercase tracking-[0.08em] text-[#b0894f]">{s.capacity}</p>
                <p className="mt-3 text-[15px] leading-relaxed text-[#4b5a63]">{s.blurb}</p>
                <a href="#visit" className="mt-4 inline-block text-sm font-semibold text-[#8f1f1f] hover:underline">Inquire about {s.name} →</a>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Offices & virtual office */}
      <section id="offices" className="border-y border-[#e7ddc9] bg-[#f3ecdd]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <Eyebrow>Work here</Eyebrow>
          <h2 className="mt-4 font-serif text-3xl text-[#13303f] md:text-[2.5rem]">Class A offices with character.</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[#e0d6c2] bg-white/60 p-7">
              <h3 className="font-serif text-xl text-[#13303f]">Executive office suites</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[#4b5a63]">
                Premium, move-in-ready offices in a landmark setting — home to accountants, attorneys,
                financial and insurance firms, and counseling practices. Suite sizes and availability
                on request <Confirm />.
              </p>
              <a href="mailto:Kristin@Broyhill.net" className="mt-4 inline-block text-sm font-semibold text-[#8f1f1f] hover:underline">Ask about availability →</a>
            </div>
            <div className="rounded-2xl border border-[#e0d6c2] bg-white/60 p-7">
              <div className="flex items-baseline justify-between">
                <h3 className="font-serif text-xl text-[#13303f]">Virtual Office Program</h3>
                <span className="font-serif text-xl text-[#b0894f]">$150<span className="text-sm text-[#8c7d5f]">/mo</span></span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wider text-[#8c7d5f]">12-month term</p>
              <ul className="mt-4 space-y-1.5 text-[15px] text-[#4b5a63]">
                <li>· A professional business address</li>
                <li>· Wi-Fi, coffee &amp; tea, and a lobby for your guests</li>
                <li>· Copier/scanner account — 50 color + 100 B&amp;W pages monthly</li>
                <li>· 2 hours in the large conference room</li>
                <li>· Two 6-seat breakout rooms (as available)</li>
                <li>· One key fob (extra fobs $50)</li>
              </ul>
              <a href="#visit" className="mt-4 inline-block text-sm font-semibold text-[#8f1f1f] hover:underline">Get started →</a>
            </div>
          </div>
        </div>
      </section>

      {/* Podcast studio */}
      <section id="studio" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Eyebrow>The HB Podcast Studio</Eyebrow>
            <h2 className="mt-4 font-serif text-3xl text-[#13303f] md:text-[2.5rem]">A turnkey studio, ready when you are.</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[#4b5a63]">
              Top-quality, user-friendly equipment with an engineer on hand — book a session and
              record your podcast, interview, or promotion without the setup. Equipment list and
              rates on request <Confirm />.
            </p>
            <a href="#visit" className="mt-6 inline-block rounded-lg border border-[#13303f]/25 px-6 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#13303f] transition hover:border-[#13303f]/50">
              Book the studio
            </a>
          </div>
          <Photo caption="The podcast studio — mics, boxwood wall" className="aspect-[4/3]" />
        </div>
      </section>

      {/* Visit / inquiry */}
      <section id="visit" className="border-t border-[#e7ddc9] bg-[#13303f] text-[#e9e2d3]">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-[1fr_1fr] md:py-24">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d9b877]">Plan your visit</p>
            <h2 className="mt-4 font-serif text-3xl leading-tight text-white md:text-[2.5rem]">Come see the Historic Broyhill.</h2>
            <p className="mt-4 max-w-md text-[16px] leading-relaxed text-[#bcc6c9]">
              Tell us a little about what you have in mind and we'll arrange a tour. Prefer to book a
              space directly? Use our booking portal.
            </p>
            <div className="mt-8 space-y-3 text-[15px]">
              <p><a href="https://broyhill.skedda.com/booking" className="inline-block rounded-lg bg-[#b0894f] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.1em] text-[#13303f] transition hover:bg-[#c29a58]">Book now →</a></p>
              <p className="pt-2 text-[#bcc6c9]">3540 Clemmons Road, Suite 111<br />Clemmons, NC 27012</p>
              <p className="text-[#bcc6c9]">
                <a href="tel:+13367931191" className="hover:text-white">336-793-1191</a> ·{" "}
                <a href="mailto:Info@Broyhill.net" className="hover:text-white">Info@Broyhill.net</a>
              </p>
              <p className="text-[#bcc6c9]">Office suites: <a href="mailto:Kristin@Broyhill.net" className="hover:text-white">Kristin@Broyhill.net</a></p>
              <p><a href="https://www.instagram.com/historicbroyhill/" className="text-[#d9b877] hover:text-white">@historicbroyhill</a></p>
            </div>
          </div>
          <div className="rounded-2xl bg-[#faf6ee] p-6 text-[#2a3942] sm:p-8">
            <InquiryForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0e2733] text-[#9fb0b6]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 sm:flex-row sm:items-center">
          <div>
            <p className="font-serif text-base tracking-wide text-[#e9e2d3]">Historic Broyhill</p>
            <p className="mt-1 text-xs">A restored 1920s landmark in Clemmons, North Carolina.</p>
          </div>
          <p className="text-xs">
            336-793-1191 · <a href="mailto:Info@Broyhill.net" className="hover:text-[#e9e2d3]">Info@Broyhill.net</a>
          </p>
        </div>
      </footer>
    </main>
  );
}

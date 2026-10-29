import SiteHeader from "../components/SiteHeader";

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${light ? "text-[#d6b574]" : "text-[#a8853f]"}`}>
      {children}
    </p>
  );
}

export default function TeamBuilding() {
  return (
    <main className="hb-body bg-[#f6f1e7] text-[#273440]">
      <SiteHeader />
      
      {/* Hero */}
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <Eyebrow light={true}>Corporate Retreats</Eyebrow>
          <h1 className="hb-display mt-5 text-4xl text-[#f4ecda] sm:text-5xl md:text-[3.3rem]">
            Team Building at Historic Broyhill
          </h1>
          <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-[#bcc6c9]">
            Bring your team together in a setting that inspires collaboration. Our historic venue provides the perfect backdrop for corporate retreats, strategy sessions, and team-building activities.
          </p>
        </div>
      </section>

      {/* Venues for Team Building */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Venues</Eyebrow>
          <h2 className="hb-display mt-4 text-3xl text-[#182c3e] md:text-[2.6rem]">Spaces Designed for Connection</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-[#5a6672]">
            Choose the perfect space for your team building event, from intimate boardroom settings to spacious halls for larger groups.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">The Loft</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Up to 20 people</p>
            <p className="mt-3 text-[15px] leading-relaxed text-[#5a6672]">
              Perfect for small team meetings, boardroom sessions, and training seminars. Private bathroom, coffee bar, and multi-day options available.
            </p>
          </div>
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">The Magnolia Room</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">20–120 seated · up to 140 standing</p>
            <p className="mt-3 text-[15px] leading-relaxed text-[#5a6672]">
              Our signature hall with stage—ideal for presentations, team celebrations, and large group activities. Roaming receptions available.
            </p>
          </div>
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">The Dock</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Outdoor · capacity varies</p>
            <p className="mt-3 text-[15px] leading-relaxed text-[#5a6672]">
              Covered outdoor stage with seating area—perfect for outdoor team activities, live music, and casual gatherings.
            </p>
          </div>
        </div>
      </section>

      {/* What's Included */}
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <div className="max-w-2xl">
            <Eyebrow light={true}>What's Included</Eyebrow>
            <h2 className="hb-display mt-4 text-3xl text-[#f4ecda] md:text-[2.6rem]">Everything You Need</h2>
          </div>
          <ul className="mt-8 grid gap-3 md:grid-cols-2 text-[15px] text-[#bcc6c9]">
            <li className="flex gap-2"><span className="text-[#c2a15a]">·</span>Tables & chairs, with setup and breakdown</li>
            <li className="flex gap-2"><span className="text-[#c2a15a]">·</span>TV with connections for presentations</li>
            <li className="flex gap-2"><span className="text-[#c2a15a]">·</span>Projector available upon request</li>
            <li className="flex gap-2"><span className="text-[#c2a15a]">·</span>Private bathrooms & parking</li>
            <li className="flex gap-2"><span className="text-[#c2a15a]">·</span>Use of designated event areas</li>
            <li className="flex gap-2"><span className="text-[#c2a15a]">·</span>Onsite event planners to assist</li>
          </ul>
        </div>
      </section>

      {/* Partner Activities */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Partner Activities</Eyebrow>
          <h2 className="hb-display mt-4 text-3xl text-[#182c3e] md:text-[2.6rem]">Extend Your Retreat</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-[#5a6672]">
            Our partner Tanglewood Park offers additional team-building activities just minutes away.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Tanglewood Golf</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Two championship courses for golf outings and tournaments</p>
            <a href="https://golf.tanglewoodpark.org" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-[#182c3e] hover:text-[#a8853f]">Learn more →</a>
          </div>
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Tanglewood Stables</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Trail rides, hay rides, and carriage rides for unique team experiences</p>
            <a href="https://tanglewoodstables.com" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-[#182c3e] hover:text-[#a8853f]">Learn more →</a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-xl border border-[#e4dac6] bg-[#efe7d6] p-8 text-center">
          <h2 className="hb-display text-2xl text-[#182c3e]">Plan Your Team Building Event</h2>
          <p className="mt-3 text-[16px] text-[#5a6672]">
            Contact us to discuss your team building goals and create a customized experience at Historic Broyhill.
          </p>
          <a href="#visit" className="mt-6 inline-block rounded-md bg-[#c2a15a] px-8 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:bg-[#d2b268]">Request Planning Assistance</a>
        </div>
      </section>
    </main>
  );
}

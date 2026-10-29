import SiteHeader from "../components/SiteHeader";

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${light ? "text-[#d6b574]" : "text-[#a8853f]"}`}>
      {children}
    </p>
  );
}

export default function Packages() {
  return (
    <main className="hb-body bg-[#f6f1e7] text-[#273440]">
      <SiteHeader />
      
      {/* Hero */}
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <Eyebrow light={true}>Event Packages</Eyebrow>
          <h1 className="hb-display mt-5 text-4xl text-[#f4ecda] sm:text-5xl md:text-[3.3rem]">
            Curated Event Packages
          </h1>
          <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-[#bcc6c9]">
            Simplify your planning with our thoughtfully designed event packages. From intimate gatherings to grand celebrations, we have options for every occasion.
          </p>
        </div>
      </section>

      {/* Venue Packages */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Venue Packages</Eyebrow>
          <h2 className="hb-display mt-4 text-3xl text-[#182c3e] md:text-[2.6rem]">Choose Your Space</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-[#5a6672]">
            Each venue package includes tables, chairs, setup and breakdown, TV for presentations, projector upon request, private bathrooms, and parking.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">The Loft Package</h3>
            <p className="mt-2 text-[14px] text-[#a8853f]">Corporate Meetings</p>
            <p className="mt-3 text-[15px] leading-relaxed text-[#5a6672]">
              Perfect for board meetings, training sessions, and small corporate gatherings. Private space with coffee bar and bathroom.
            </p>
            <ul className="mt-3 space-y-1 text-[13px] text-[#5a6672]">
              <li>· Up to 20 people</li>
              <li>· Boardroom or lounge setting</li>
              <li>· Multi-day options available</li>
            </ul>
            <a href="#visit" className="mt-4 inline-block text-sm font-semibold text-[#182c3e] hover:text-[#a8853f]">Request pricing →</a>
          </div>

          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Magnolia Room Package</h3>
            <p className="mt-2 text-[14px] text-[#a8853f]">Celebrations & Ceremonies</p>
            <p className="mt-3 text-[15px] leading-relaxed text-[#5a6672]">
              Our signature hall with stage—ideal for weddings, receptions, rehearsal dinners, and milestone celebrations.
            </p>
            <ul className="mt-3 space-y-1 text-[13px] text-[#5a6672]">
              <li>· 20–120 seated · up to 140 standing</li>
              <li>· Stage included</li>
              <li>· Lobby and courtyard available</li>
            </ul>
            <a href="#visit" className="mt-4 inline-block text-sm font-semibold text-[#182c3e] hover:text-[#a8853f]">Request pricing →</a>
          </div>

          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">The Dock Package</h3>
            <p className="mt-2 text-[14px] text-[#a8853f]">Outdoor Events</p>
            <p className="mt-3 text-[15px] leading-relaxed text-[#5a6672]">
              Covered outdoor stage with seating area—perfect for live music, community gatherings, and casual events.
            </p>
            <ul className="mt-3 space-y-1 text-[13px] text-[#5a6672]">
              <li>· Outdoor capacity varies with layout</li>
              <li>· Covered stage</li>
              <li>· Room for food trucks</li>
            </ul>
            <a href="#visit" className="mt-4 inline-block text-sm font-semibold text-[#182c3e] hover:text-[#a8853f]">Request pricing →</a>
          </div>
        </div>
      </section>

      {/* Meeting Packages */}
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <div className="max-w-2xl">
            <Eyebrow light={true}>Meeting Packages</Eyebrow>
            <h2 className="hb-display mt-4 text-3xl text-[#f4ecda] md:text-[2.6rem]">The Boardrooms</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-[#bcc6c9]">
              Meeting rooms available by the day or half-day. Perfect for working sessions, presentations, and off-site meetings.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="hb-display text-xl text-[#f4ecda]">Half-Day Package</h3>
              <p className="mt-2 text-[14px] text-[#bcc6c9]">4 hours of meeting space</p>
              <ul className="mt-3 space-y-1.5 text-[15px] text-[#bcc6c9]">
                <li>· Boardroom tables and seating</li>
                <li>· Whiteboards and Wi-Fi</li>
                <li>· TV with presentation connections</li>
                <li>· Private bathroom access</li>
              </ul>
              <a href="#visit" className="mt-4 inline-block text-sm font-semibold text-[#f4ecda] hover:text-[#c2a15a]">Request pricing →</a>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="hb-display text-xl text-[#f4ecda]">Full-Day Package</h3>
              <p className="mt-2 text-[14px] text-[#bcc6c9]">8 hours of meeting space</p>
              <ul className="mt-3 space-y-1.5 text-[15px] text-[#bcc6c9]">
                <li>· Boardroom tables and seating</li>
                <li>· Whiteboards and Wi-Fi</li>
                <li>· TV with presentation connections</li>
                <li>· Private bathroom access</li>
                <li>· Lunch break accommodation</li>
              </ul>
              <a href="#visit" className="mt-4 inline-block text-sm font-semibold text-[#f4ecda] hover:text-[#c2a15a]">Request pricing →</a>
            </div>
          </div>
        </div>
      </section>

      {/* Custom Packages */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="rounded-xl border border-[#e4dac6] bg-[#efe7d6] p-8 text-center">
          <h2 className="hb-display text-2xl text-[#182c3e]">Custom Packages Available</h2>
          <p className="mt-3 text-[16px] text-[#5a6672]">
            Every event is unique. Contact us to create a custom package tailored to your specific needs, budget, and vision.
          </p>
          <a href="#visit" className="mt-6 inline-block rounded-md bg-[#c2a15a] px-8 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:bg-[#d2b268]">Request Custom Package</a>
        </div>
      </section>
    </main>
  );
}

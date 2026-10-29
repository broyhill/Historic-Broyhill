import SiteHeader from "../components/SiteHeader";

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${light ? "text-[#d6b574]" : "text-[#a8853f]"}`}>
      {children}
    </p>
  );
}

export default function Gallery() {
  return (
    <main className="hb-body bg-[#f6f1e7] text-[#273440]">
      <SiteHeader />
      
      {/* Hero */}
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <Eyebrow light={true}>Our Spaces</Eyebrow>
          <h1 className="hb-display mt-5 text-4xl text-[#f4ecda] sm:text-5xl md:text-[3.3rem]">
            Historic Broyhill Gallery
          </h1>
          <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-[#bcc6c9]">
            Explore our venues through photos. From intimate gatherings to grand celebrations, see how Historic Broyhill brings events to life.
          </p>
        </div>
      </section>

      {/* Venues Gallery */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Our Venues</Eyebrow>
          <h2 className="hb-display mt-4 text-3xl text-[#182c3e] md:text-[2.6rem]">Event Spaces</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-[#5a6672]">
            Three distinctive venues for every occasion.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 overflow-hidden">
            <div className="aspect-[4/3] bg-[#ece2cf] flex items-center justify-center">
              <span className="text-[#a8853f] text-sm">The Magnolia Room</span>
            </div>
            <div className="p-4">
              <h3 className="hb-display text-lg text-[#182c3e]">The Magnolia Room</h3>
              <p className="mt-1 text-[13px] text-[#5a6672]">20–120 seated · up to 140 standing</p>
              <p className="mt-2 text-[14px] text-[#5a6672]">Our signature hall with stage—perfect for ceremonies, receptions, and milestone celebrations.</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#e4dac6] bg-white/60 overflow-hidden">
            <div className="aspect-[4/3] bg-[#ece2cf] flex items-center justify-center">
              <span className="text-[#a8853f] text-sm">The Loft</span>
            </div>
            <div className="p-4">
              <h3 className="hb-display text-lg text-[#182c3e]">The Loft</h3>
              <p className="mt-1 text-[13px] text-[#5a6672]">Up to 20 people</p>
              <p className="mt-2 text-[14px] text-[#5a6672]">Private space for corporate meetings, small gatherings, and training seminars.</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#e4dac6] bg-white/60 overflow-hidden">
            <div className="aspect-[4/3] bg-[#ece2cf] flex items-center justify-center">
              <span className="text-[#a8853f] text-sm">The Dock</span>
            </div>
            <div className="p-4">
              <h3 className="hb-display text-lg text-[#182c3e]">The Dock</h3>
              <p className="mt-1 text-[13px] text-[#5a6672]">Outdoor · capacity varies</p>
              <p className="mt-2 text-[14px] text-[#5a6672]">Covered outdoor stage with seating area—ideal for live music and outdoor events.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Events Gallery */}
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <div className="max-w-2xl">
            <Eyebrow light={true}>Event Types</Eyebrow>
            <h2 className="hb-display mt-4 text-3xl text-[#f4ecda] md:text-[2.6rem]">What We Host</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-[#bcc6c9]">
              From corporate events to personal celebrations, our venues accommodate a wide range of occasions.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-4">
            {[
              "Weddings & Receptions",
              "Corporate Meetings",
              "Training Seminars",
              "Birthday Celebrations",
              "Graduation Parties",
              "Anniversary Events",
              "Shower Parties",
              "Community Gatherings",
            ].map((event) => (
              <div key={event} className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
                <span className="text-[15px] text-[#e9e2d3]">{event}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Gallery */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Venue Features</Eyebrow>
          <h2 className="hb-display mt-4 text-3xl text-[#182c3e] md:text-[2.6rem]">What's Included</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-[#5a6672]">
            Every venue rental includes these features to make your event seamless.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Tables & Chairs</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Complete setup and breakdown included with every rental.</p>
          </div>
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Audiovisual Equipment</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">TV with presentation connections. Projector available upon request.</p>
          </div>
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Private Facilities</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Private bathrooms and dedicated parking for your guests.</p>
          </div>
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Event Planning Support</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Onsite event planners available to assist with coordination.</p>
          </div>
        </div>
      </section>

      {/* 3D Tour */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-xl border border-[#e4dac6] bg-[#efe7d6] p-8 text-center">
          <h2 className="hb-display text-2xl text-[#182c3e]">Take a Virtual Tour</h2>
          <p className="mt-3 text-[16px] text-[#5a6672]">
            Can't visit in person? Explore Historic Broyhill with our interactive 3D virtual tour.
          </p>
          <a href="#tour" className="mt-6 inline-block rounded-md bg-[#c2a15a] px-8 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:bg-[#d2b268]">Start Virtual Tour</a>
        </div>
      </section>
    </main>
  );
}

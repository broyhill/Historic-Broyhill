import SiteHeader from "../components/SiteHeader";

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${light ? "text-[#d6b574]" : "text-[#a8853f]"}`}>
      {children}
    </p>
  );
}

export default function Enhancements() {
  return (
    <main className="hb-body bg-[#f6f1e7] text-[#273440]">
      <SiteHeader />
      
      {/* Hero */}
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <Eyebrow light={true}>Event Add-Ons</Eyebrow>
          <h1 className="hb-display mt-5 text-4xl text-[#f4ecda] sm:text-5xl md:text-[3.3rem]">
            Event Enhancements
          </h1>
          <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-[#bcc6c9]">
            Elevate your event with our enhancements and add-ons. From audiovisual equipment to catering recommendations, we help you create a memorable experience.
          </p>
        </div>
      </section>

      {/* Included Enhancements */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Included with Every Venue</Eyebrow>
          <h2 className="hb-display mt-4 text-3xl text-[#182c3e] md:text-[2.6rem]">Standard Inclusions</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-[#5a6672]">
            Every venue rental includes these essential services to make your event planning easier.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Setup & Breakdown</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Tables, chairs, and complete setup and breakdown included with every rental.</p>
          </div>
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Audiovisual Equipment</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">TV with presentation connections included. Projector available upon request.</p>
          </div>
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Private Facilities</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Private bathrooms and dedicated parking for your event guests.</p>
          </div>
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Event Planning Support</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Onsite event planners available to assist with coordination and details.</p>
          </div>
        </div>
      </section>

      {/* Additional Services */}
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <div className="max-w-2xl">
            <Eyebrow light={true}>Additional Services</Eyebrow>
            <h2 className="hb-display mt-4 text-3xl text-[#f4ecda] md:text-[2.6rem]">Available Enhancements</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-[#bcc6c9]">
              Enhance your event with these additional services available upon request.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="hb-display text-xl text-[#f4ecda]">Catering Coordination</h3>
              <p className="mt-2 text-[14px] text-[#bcc6c9]">We can recommend preferred caterers and coordinate meal service for your event.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="hb-display text-xl text-[#f4ecda]">Additional Time</h3>
              <p className="mt-2 text-[14px] text-[#bcc6c9]">Extend your event time for setup, rehearsal, or additional celebration hours.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="hb-display text-xl text-[#f4ecda]">Multiple Spaces</h3>
              <p className="mt-2 text-[14px] text-[#bcc6c9]">Combine venues—The Loft, Magnolia Room, and The Dock—for larger events.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="hb-display text-xl text-[#f4ecda]">Virtual Tour Integration</h3>
              <p className="mt-2 text-[14px] text-[#bcc6c9]">Share our 3D virtual tour with guests before your event for venue preview.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="hb-display text-xl text-[#f4ecda]">Podcast Studio</h3>
              <p className="mt-2 text-[14px] text-[#bcc6c9]">Book our turnkey podcast studio for interviews, recordings, or promotional content.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="hb-display text-xl text-[#f4ecda]">Partner Activities</h3>
              <p className="mt-2 text-[14px] text-[#bcc6c9]">Coordinate activities with our Tanglewood Park partners—golf, stables, aquatic center.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Virtual Office */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="rounded-xl border border-[#e4dac6] bg-[#efe7d6] p-8">
          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <Eyebrow>Business Services</Eyebrow>
              <h2 className="hb-display mt-3 text-2xl text-[#182c3e]">Virtual Office Program</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[#5a6672]">
                For businesses needing a professional presence, our Virtual Office program provides a business address, lobby access, and conference room time.
              </p>
              <ul className="mt-4 space-y-1.5 text-[15px] text-[#5a6672]">
                <li>· Professional business address</li>
                <li>· Wi-Fi, coffee & tea, lobby for guests</li>
                <li>· Copier — 50 color + 100 B&W monthly</li>
                <li>· 2 hrs large conference room</li>
                <li>· Two 6-seat breakout rooms (as available)</li>
              </ul>
              <p className="mt-4 text-xs text-[#8c7d5f]">$150/mo · 12-month term</p>
            </div>
            <div className="text-center">
              <p className="hb-display text-4xl text-[#a8853f]">$150<span className="text-sm text-[#8c7d5f]">/mo</span></p>
              <p className="mt-2 text-xs uppercase tracking-wider text-[#8c7d5f]">12-month term</p>
              <a href="#visit" className="mt-6 inline-block rounded-md bg-[#c2a15a] px-8 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:bg-[#d2b268]">Get Started</a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-xl border border-[#e4dac6] bg-[#efe7d6] p-8 text-center">
          <h2 className="hb-display text-2xl text-[#182c3e]">Customize Your Event</h2>
          <p className="mt-3 text-[16px] text-[#5a6672]">
            Contact us to discuss enhancements and create a personalized package for your event.
          </p>
          <a href="#visit" className="mt-6 inline-block rounded-md bg-[#c2a15a] px-8 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:bg-[#d2b268]">Request Enhancements</a>
        </div>
      </section>
    </main>
  );
}

import SiteHeader from "../components/SiteHeader";

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${light ? "text-[#d6b574]" : "text-[#a8853f]"}`}>
      {children}
    </p>
  );
}

export default function Accommodations() {
  return (
    <main className="hb-body bg-[#f6f1e7] text-[#273440]">
      <SiteHeader />
      
      {/* Hero */}
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <Eyebrow light={true}>For Out-of-Town Guests</Eyebrow>
          <h1 className="hb-display mt-5 text-4xl text-[#f4ecda] sm:text-5xl md:text-[3.3rem]">
            Lodging, Recreation & Entertainment
          </h1>
          <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-[#bcc6c9]">
            Make your conference or event a complete experience. We've curated the best local options for lodging, golf, tennis, swimming, and activities—all just minutes from Historic Broyhill.
          </p>
        </div>
      </section>

      {/* Lodging */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Lodging</Eyebrow>
          <h2 className="hb-display mt-4 text-3xl text-[#182c3e] md:text-[2.6rem]">Stay in Tanglewood Park</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-[#5a6672]">
            Just minutes from Historic Broyhill, experience charming accommodations in the heart of Tanglewood Park with access to gardens, trails, and recreation.
          </p>
        </div>

        <div className="mt-10">
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-8">
            <h3 className="hb-display text-2xl text-[#182c3e]">Excelsior at the Manor House</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-[#5a6672]">
              Nestled in Tanglewood Park, this historic manor offers cozy accommodations with vintage-style decor. The Manor House has rich history dating to 1859, once part of the Reynolds estate. Enjoy access to fishing, pedal boats, tennis, the Aquatic Center, gardens, trail systems, horse stables, and golf.
            </p>
            <ul className="mt-4 space-y-2 text-[15px] text-[#5a6672]">
              <li>· The Manor House</li>
              <li>· Guest House</li>
              <li>· Apartment</li>
              <li>· Cottages</li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="https://excelsioratmanor.com" target="_blank" rel="noopener noreferrer" className="rounded-md bg-[#c2a15a] px-6 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:bg-[#d2b268]">Visit Website</a>
              <a href="tel:3367010470" className="rounded-md border border-[#a8853f] px-6 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:border-[#c2a15a]">Call (336) 701-0470</a>
            </div>
            <p className="mt-4 text-xs text-[#8c7d5f]">4201 Manor House Cir, Clemmons, NC 27012</p>
          </div>
        </div>
      </section>

      {/* Golf */}
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <div className="max-w-2xl">
            <Eyebrow light={true}>Recreation</Eyebrow>
            <h2 className="hb-display mt-4 text-3xl text-[#f4ecda] md:text-[2.6rem]">Tanglewood Golf</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-[#bcc6c9]">
              Home of two championship courses designed by Robert Trent Jones, Sr. One of the premier public golf facilities in the U.S., located along the Yadkin River just minutes from Historic Broyhill.
            </p>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-8">
              <h3 className="hb-display text-2xl text-[#f4ecda]">Championship Course</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[#bcc6c9]">
                A challenging and historic course that has hosted major championships, including the 1974 PGA Championship and the Vantage Championship (1988–2002). Renovated in 2018 by Robert Trent Jones II.
              </p>
              <ul className="mt-4 space-y-1.5 text-[15px] text-[#bcc6c9]">
                <li>· 18 Holes, Par 70</li>
                <li>· Hours: 7am - 7pm</li>
                <li>· Designed by Robert Trent Jones, Sr.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-8">
              <h3 className="hb-display text-2xl text-[#f4ecda]">Reynolds Course</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[#bcc6c9]">
                A scenic and enjoyable layout that blends beauty, strategy, and challenge throughout the course.
              </p>
              <ul className="mt-4 space-y-1.5 text-[15px] text-[#bcc6c9]">
                <li>· 18 Holes, Par 72</li>
                <li>· Hours: 7am - 7pm</li>
                <li>· Designed by Robert Trent Jones, Sr.</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="hb-display text-xl text-[#f4ecda]">Par-3 Course</h3>
              <p className="mt-2 text-[14px] text-[#bcc6c9]">
                Par 54 course, great for all ages. Most holes are 100 yards or less, can be played in two hours. Ideal for family and friends.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="hb-display text-xl text-[#f4ecda]">Driving Ranges</h3>
              <p className="mt-2 text-[14px] text-[#bcc6c9]">
                Two convenient driving ranges with practice putting greens, perfect for warming up or refining your game.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="https://golf.tanglewoodpark.org" target="_blank" rel="noopener noreferrer" className="rounded-md bg-[#c2a15a] px-6 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:bg-[#d2b268]">Visit Tanglewood Golf</a>
            <a href="https://sc.cps.golf/TanglewoodGolf" target="_blank" rel="noopener noreferrer" className="rounded-md border border-white/25 px-6 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#e9e2d3] transition hover:border-white/55">Book Tee Time</a>
          </div>
          <p className="mt-4 text-xs text-[#9ba6b7]">100 Clubhouse Circle, Clemmons, NC 27012 · (336) 703-6420</p>
        </div>
      </section>

      {/* Aquatic Center */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Recreation</Eyebrow>
          <h2 className="hb-display mt-4 text-3xl text-[#182c3e] md:text-[2.6rem]">Peter S. Brunstetter Aquatic Center</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-[#5a6672]">
            Beat the heat at Tanglewood Park's premier aquatic facility. Four sections for all members of the family to enjoy.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Main Pool</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Large main pool with 2 diving boards and 2 slides (48" height requirement)</p>
          </div>
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Wading Pool</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Zero depth entry wading pool with 3 large water features</p>
          </div>
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Splash Pad</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Water features for the little ones to enjoy</p>
          </div>
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Tubing River</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Winding tubing river with 2 slides of its own</p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-[#e4dac6] bg-[#efe7d6] p-6">
          <div className="grid gap-6 md:grid-cols-2 md:items-center">
            <div>
              <h3 className="hb-display text-xl text-[#182c3e]">Pricing</h3>
              <ul className="mt-3 space-y-1.5 text-[15px] text-[#5a6672]">
                <li>· Daily Admission: $10</li>
                <li>· Children 3-5 & Seniors 55+: $8</li>
                <li>· Children 2 & Under: FREE</li>
                <li>· Family Season Pass: $500 (up to 5)</li>
                <li>· Individual Pass: $150</li>
              </ul>
            </div>
            <div>
              <a href="https://www.forsyth.cc/parks/tanglewood/aquaticcenter/" target="_blank" rel="noopener noreferrer" className="inline-block rounded-md bg-[#c2a15a] px-6 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:bg-[#d2b268]">Visit Aquatic Center</a>
              <p className="mt-3 text-xs text-[#8c7d5f]">775 Tanglewood Park Road, Clemmons, NC 27012 · (336) 703-6403</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tennis */}
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <div className="max-w-2xl">
            <Eyebrow light={true}>Recreation</Eyebrow>
            <h2 className="hb-display mt-4 text-3xl text-[#f4ecda] md:text-[2.6rem]">Tennis at Tanglewood</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-[#bcc6c9]">
              Tanglewood Park offers tennis facilities for your guests. Excelsior at the Manor House also offers dedicated tennis packages for guests.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="https://excelsioratmanor.com/tennis-package-1" target="_blank" rel="noopener noreferrer" className="rounded-md bg-[#c2a15a] px-6 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:bg-[#d2b268]">Tennis Package at Excelsior</a>
          </div>
        </div>
      </section>

      {/* Entertainment */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Entertainment & Activities</Eyebrow>
          <h2 className="hb-display mt-4 text-3xl text-[#182c3e] md:text-[2.6rem]">More to Explore in Tanglewood Park</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-[#5a6672]">
            Tanglewood Park offers endless activities for conference attendees and their families—all within the park.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Tanglewood Arboretum</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Showcases global plant varieties with beautiful gardens and trail systems</p>
          </div>
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Tanglewood Stables</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Horseback riding on 385 acres along the Yadkin River. Trail rides, pony rides, hay rides, carriage rides, and riding lessons available year-round.</p>
            <ul className="mt-3 space-y-1 text-[13px] text-[#5a6672]">
              <li>· Trail rides for all experience levels</li>
              <li>· Pony rides for children under 6</li>
              <li>· Hay rides for groups and events</li>
              <li>· White formal and mahogany carriage rides</li>
              <li>· Private and group riding lessons</li>
            </ul>
            <a href="https://tanglewoodstables.com" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-[#182c3e] hover:text-[#a8853f]">Visit Tanglewood Stables →</a>
            <p className="mt-2 text-xs text-[#8c7d5f]">Stables Office: (336) 766-9540</p>
          </div>
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Fishing & Pedal Boats</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Enjoy the lakes at Tanglewood Park with fishing and pedal boat rentals</p>
          </div>
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Trail Systems</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Miles of walking and hiking trails throughout Tanglewood Park</p>
          </div>
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Playgrounds & Picnic Areas</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Family-friendly playgrounds and picnic shelters throughout the park</p>
          </div>
          <div className="rounded-xl border border-[#e4dac6] bg-white/60 p-6">
            <h3 className="hb-display text-xl text-[#182c3e]">Festival of Lights</h3>
            <p className="mt-2 text-[14px] text-[#5a6672]">Annual holiday light display (seasonal)—a magical drive-through experience</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-xl border border-[#e4dac6] bg-[#efe7d6] p-8 text-center">
          <h2 className="hb-display text-2xl text-[#182c3e]">Plan Your Conference Stay</h2>
          <p className="mt-3 text-[16px] text-[#5a6672]">
            Contact us to coordinate lodging, recreation, and activities for your out-of-town conference attendees.
          </p>
          <a href="#visit" className="mt-6 inline-block rounded-md bg-[#c2a15a] px-8 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:bg-[#d2b268]">Request Planning Assistance</a>
        </div>
      </section>
    </main>
  );
}

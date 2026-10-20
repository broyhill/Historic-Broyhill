import InquiryForm from "./components/InquiryForm";

/* Historic Broyhill — public site.
   Brand match (owner brochure): deep navy + cream + gold, Playfair Display + EB Garamond.
   Content is the owner's own; unverified facts are [CONFIRM]; images are TODO-PHOTO. No lodging. */

const VENUES = [
  {
    num: "01",
    kicker: "Celebrate",
    name: "The Magnolia Room",
    capacity: "20–120 seated · up to 140 for a standing reception",
    blurb:
      "Our signature hall for ceremonies, receptions, rehearsal dinners, and milestone celebrations. Roaming receptions accommodate upwards of 140 guests — ask about the lobby, courtyard, and other common areas.",
    photo: "The Magnolia Room set for a reception",
    src: "/photos/magnolia.jpg",
    pos: "center",
  },
  {
    num: "02",
    kicker: "Connect",
    name: "The Loft",
    capacity: "Up to 20 · for smaller gatherings",
    blurb:
      "A private space for corporate meetings, small gatherings, and training seminars. Boardroom or lounge setting, a private bathroom and coffee bar, and multi-day meeting options — comfortable and entirely your own.",
    photo: "The Loft set boardroom-style for a meeting",
    src: "/photos/the-loft.jpg",
    pos: "50% 55%",
  },
  {
    num: "03",
    kicker: "Gather",
    name: "The Dock",
    capacity: "Outdoor · capacity varies with layout",
    blurb:
      "Our outside patio area — a covered stage and a flat lot for seating, made for smaller outdoor events and live music. The rear grounds offer room for community gatherings and food trucks.",
    photo: "The Dock's covered outdoor stage, with a live band and guests in lawn chairs",
    src: "/photos/the-dock.jpg",
    pos: "50% 48%",
  },
];

const INCLUDED = [
  "Tables & chairs, with setup and breakdown",
  "TV with connections for presentations",
  "Projector available upon request",
  "Private bathrooms & parking",
  "Use of designated event areas",
];

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${light ? "text-[#d6b574]" : "text-[#a8853f]"}`}>
      {children}
    </p>
  );
}

// Front-page photo: the whole exterior, its edges softly faded into the navy page, with the logo over the lawn.
function HeroPhoto() {
  const fade = "radial-gradient(ellipse 72% 76% at 50% 48%, #000 60%, transparent 100%)";
  return (
    <div className="relative w-full" style={{ aspectRatio: "2048 / 1072" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/photos/exterior.jpg"
        alt="The Historic Broyhill at dusk — the landmark exterior with its white columns"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ WebkitMaskImage: fade, maskImage: fade }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/photos/logo-cream.png"
        alt="Historic Broyhill"
        className="absolute left-1/2 w-[40%] max-w-[540px] -translate-x-1/2"
        style={{ top: "76%", filter: "drop-shadow(0 2px 12px rgba(0,0,0,0.6))" }}
      />
    </div>
  );
}

function Photo({ caption, className = "", onDark = false, src, position = "center" }: { caption: string; className?: string; onDark?: boolean; src?: string; position?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg ${onDark ? "border border-white/10 bg-white/[0.04]" : "border border-[#e2d8c3] bg-[#ece2cf]"} ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={caption} className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position }} />
      ) : (
        <>
          <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "radial-gradient(circle at 28% 22%, rgba(194,161,90,0.18) 0, transparent 60%), radial-gradient(circle at 78% 82%, rgba(194,161,90,0.12) 0, transparent 55%)" }} />
          <div className="relative flex h-full min-h-[180px] flex-col items-center justify-center gap-1.5 px-4 text-center">
            <span className="text-[#c2a15a] text-lg">◢</span>
            <span className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${onDark ? "text-[#c2a15a]" : "text-[#a8853f]"}`}>Photo</span>
            <span className={`text-xs ${onDark ? "text-[#aeb9c0]" : "text-[#8c7d5f]"}`}>{caption}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <main className="hb-body bg-[#f6f1e7] text-[#273440]">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#182c3e]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <a href="#top" className="hb-display text-lg tracking-wide text-[#f4ecda]">Historic Broyhill</a>
          <nav className="hidden items-center gap-7 text-[15px] text-[#cdd5d9] md:flex">
            <a href="#venues" className="hover:text-white">Event Venues</a>
            <a href="#tour" className="hover:text-white">Virtual Tour</a>
            <a href="#offices" className="hover:text-white">Offices</a>
            <a href="#studio" className="hover:text-white">Podcast Studio</a>
            <a href="#visit" className="hover:text-white">Visit</a>
          </nav>
          <a href="#visit" className="rounded-md bg-[#c2a15a] px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:bg-[#d2b268]">Request a tour</a>
        </div>
      </header>

      {/* Hero — navy, like the brochure */}
      <section id="top" className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:py-24">
          <div>
            <Eyebrow light>Clemmons, North Carolina · the Old Clemmons School, est. 1925</Eyebrow>
            <h1 className="hb-display mt-5 text-4xl leading-[1.08] text-[#f4ecda] sm:text-5xl md:text-[3.3rem]">
              Where the walls hold generations of memories.
            </h1>
            <p className="mt-5 max-w-xl text-[18px] leading-relaxed text-[#bcc6c9]">
              The former Old Clemmons School — built in 1925, renovated in 2006, minutes from downtown
              Winston-Salem. Now three distinctive event venues, Class A executive offices, a virtual office
              program, and a turnkey podcast studio.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#visit" className="rounded-md bg-[#c2a15a] px-6 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:bg-[#d2b268]">Request a tour</a>
              <a href="#venues" className="rounded-md border border-white/25 px-6 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#e9e2d3] transition hover:border-white/55">Explore the venues</a>
            </div>
          </div>
          <HeroPhoto />
        </div>
      </section>

      {/* Heritage */}
      <section className="border-b border-[#e4dac6] bg-[#efe7d6]">
        <div className="mx-auto max-w-6xl px-5 py-14 md:py-16">
          <div className="grid gap-8 md:grid-cols-[0.82fr_1.18fr] md:items-center">
            <div>
              <Eyebrow>Our story</Eyebrow>
              <h2 className="hb-display mt-3 text-2xl text-[#182c3e] md:text-3xl">The former Old Clemmons School, since 1925.</h2>
            </div>
            <p className="text-[16px] leading-relaxed text-[#5a6672]">
              Built in 1925 as the Old Clemmons School and lovingly renovated in 2006, this landmark keeps
              the character of its original architecture — arched doorways, tall windows, a checkerboard
              foyer — while welcoming a new century of celebrations, businesses, and community gatherings.
              This building houses memories. It houses dreams.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { src: "/photos/heritage-then.jpg", alt: "The school auditorium long ago, with a choir on the stage beneath draped curtains", label: "Then", note: "The school auditorium" },
              { src: "/photos/heritage-music.jpg", alt: "A band playing on the stage of the arched hall during an evening event", label: "Over the years", note: "An evening of live music" },
              { src: "/photos/heritage-hall.jpg", alt: "The arched hall set with round tables, flowers and candles for a celebration", label: "And now", note: "The hall, set for a celebration" },
            ].map((p) => (
              <figure key={p.src} className="overflow-hidden rounded-lg border border-[#e2d8c3] bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={p.alt} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                <figcaption className="px-4 py-3">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a8853f]">{p.label}</span>
                  <span className="block text-[14px] text-[#5a6672]">{p.note}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Venues */}
      <section id="venues" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Three venues · one special place</Eyebrow>
          <h2 className="hb-display mt-4 text-3xl text-[#182c3e] md:text-[2.6rem]">A setting for your next occasion.</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-[#5a6672]">
            Showers, birthdays, graduations, anniversaries, wedding receptions — bring your celebration,
            meeting, or community gathering to the heart of Clemmons, with onsite event planners to help
            with the details. Rental rates on request.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {VENUES.map((v) => (
            <article key={v.name} className="flex flex-col overflow-hidden rounded-xl border border-[#e4dac6] bg-white/60 transition hover:shadow-[0_18px_44px_-26px_rgba(24,44,62,0.5)]">
              <Photo caption={v.photo} src={v.src || undefined} position={v.pos} className="aspect-[16/10] rounded-none border-0 border-b border-[#e4dac6]" />
              <div className="flex flex-1 flex-col p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a8853f]">{v.num} / {v.kicker}</p>
                <h3 className="hb-display mt-2 text-2xl text-[#182c3e]">{v.name}</h3>
                <p className="mt-1 text-[13px] font-medium uppercase tracking-[0.06em] text-[#8f6f2f]">{v.capacity}</p>
                <p className="mt-3 flex-1 text-[15px] leading-relaxed text-[#5a6672]">{v.blurb}</p>
                <a href="#visit" className="mt-4 text-sm font-semibold text-[#182c3e] hover:text-[#a8853f]">Inquire about {v.name} →</a>
              </div>
            </article>
          ))}
        </div>

        {/* Included with your event */}
        <div className="mt-10 rounded-xl border border-[#e4dac6] bg-[#efe7d6] p-6 sm:p-8">
          <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr] md:items-center">
            <div>
              <Eyebrow>Included with your event</Eyebrow>
              <p className="hb-display mt-2 text-xl italic text-[#182c3e]">Historic charm. Memorable gatherings.</p>
            </div>
            <ul className="grid gap-x-6 gap-y-2 text-[15px] text-[#4b5661] sm:grid-cols-2">
              {INCLUDED.map((i) => (
                <li key={i} className="flex gap-2"><span className="text-[#c2a15a]">·</span>{i}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Virtual tour */}
      <section id="tour" className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <div className="max-w-2xl">
            <Eyebrow light>Explore the venue</Eyebrow>
            <h2 className="hb-display mt-4 text-3xl text-[#f4ecda] md:text-[2.6rem]">Walk the Historic Broyhill in 3D.</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-[#bcc6c9]">
              Take a self-guided virtual tour — step through the spaces from anywhere, at your own pace.
            </p>
          </div>
          <div className="mt-8 overflow-hidden rounded-xl border border-white/10 bg-black/20 shadow-2xl">
            <iframe
              title="Historic Broyhill — 3D virtual tour"
              src="https://my.matterport.com/show/?m=AenPk2dALQ7&play=1&qs=1"
              allow="fullscreen; xr-spatial-tracking"
              allowFullScreen
              loading="lazy"
              className="h-[72vw] max-h-[600px] min-h-[340px] w-full"
            />
          </div>
        </div>
      </section>

      {/* Offices */}
      <section id="offices" className="border-y border-[#e4dac6] bg-[#efe7d6]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <Eyebrow>Work here</Eyebrow>
          <h2 className="hb-display mt-4 text-3xl text-[#182c3e] md:text-[2.6rem]">Class A offices with character.</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-[#e2d8c3] bg-white/60 p-7">
              <h3 className="hb-display text-xl text-[#182c3e]">Executive office suites</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[#5a6672]">
                Premium, move-in-ready offices in a landmark setting — home to accountants, attorneys,
                financial and insurance firms, and counseling practices. Sizes and availability on request.
              </p>
              <a href="mailto:Kristin@Broyhill.net" className="mt-4 inline-block text-sm font-semibold text-[#182c3e] hover:text-[#a8853f]">Ask about availability →</a>
            </div>
            <div className="rounded-xl border border-[#e2d8c3] bg-white/60 p-7">
              <h3 className="hb-display text-xl text-[#182c3e]">The Boardrooms</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[#5a6672]">
                Meeting rooms by the day or half-day — boardroom tables, upholstered seating, whiteboards,
                and Wi-Fi. Open to tenants and the public for working sessions and presentations.
              </p>
              <a href="#visit" className="mt-4 inline-block text-sm font-semibold text-[#182c3e] hover:text-[#a8853f]">Reserve a room →</a>
            </div>
            <div className="rounded-xl border border-[#e2d8c3] bg-white/60 p-7">
              <div className="flex items-baseline justify-between">
                <h3 className="hb-display text-xl text-[#182c3e]">Virtual Office</h3>
                <span className="hb-display text-xl text-[#a8853f]">$150<span className="text-sm text-[#8c7d5f]">/mo</span></span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wider text-[#8c7d5f]">12-month term</p>
              <ul className="mt-4 space-y-1.5 text-[15px] text-[#5a6672]">
                <li>· Professional business address</li>
                <li>· Wi-Fi, coffee &amp; tea, lobby for guests</li>
                <li>· Copier — 50 color + 100 B&amp;W monthly</li>
                <li>· 2 hrs large conference room</li>
                <li>· Two 6-seat breakout rooms (as available)</li>
                <li>· One key fob (extra fobs $50)</li>
              </ul>
              <a href="#visit" className="mt-4 inline-block text-sm font-semibold text-[#182c3e] hover:text-[#a8853f]">Get started →</a>
            </div>
          </div>
        </div>
      </section>

      {/* Podcast studio */}
      <section id="studio" className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <div className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Eyebrow>The HB Podcast Studio</Eyebrow>
            <h2 className="hb-display mt-4 text-3xl text-[#182c3e] md:text-[2.6rem]">A turnkey studio, ready when you are.</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-[#5a6672]">
              Top-quality, user-friendly equipment with an engineer on hand — book a session and record
              your podcast, interview, or promotion without the setup. Equipment list and rates on request.
            </p>
            <a href="#visit" className="mt-6 inline-block rounded-md border border-[#182c3e]/25 px-6 py-3 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:border-[#182c3e]/50">Book the studio</a>
          </div>
          <Photo caption="The podcast studio — guests recording around the mixing table, with microphones and the green leaf wall" src="/photos/podcast-studio.jpg" position="50% 45%" className="aspect-[4/3]" />
        </div>
      </section>

      {/* Visit */}
      <section id="visit" className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <Eyebrow light>Let's plan your event</Eyebrow>
            <h2 className="hb-display mt-4 text-3xl leading-tight text-[#f4ecda] md:text-[2.6rem]">Start with a tour.</h2>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed text-[#bcc6c9]">
              See the spaces, share your vision, and explore the options for your gathering. Prefer to book
              directly? Use our booking portal.
            </p>

            <div className="mt-7 flex items-center gap-5 border-t border-white/12 pt-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/photos/sonja-kennedy.jpg"
                alt="Sonja Kennedy, Event Director"
                width={104}
                height={104}
                className="h-24 w-24 shrink-0 rounded-full border-2 border-[#c2a15a]/60 object-cover sm:h-[104px] sm:w-[104px]"
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b574]">Event Director</p>
                <p className="hb-display mt-1 text-2xl text-[#f4ecda]">Sonja Kennedy</p>
                <p className="mt-1 text-[15px]">
                  <a href="tel:+13369088382" className="hover:text-white">336-908-8382</a> ·{" "}
                  <a href="mailto:bledsoesonja1@gmail.com" className="break-all hover:text-white">bledsoesonja1@gmail.com</a>
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-2 text-[15px] text-[#bcc6c9]">
              <p><a href="https://broyhill.skedda.com/booking" className="inline-block rounded-md bg-[#c2a15a] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:bg-[#d2b268]">Book now →</a></p>
              <p className="pt-2">3540 Clemmons Road, Suite 111 · Clemmons, NC 27012</p>
              <p>General: <a href="tel:+13367931191" className="hover:text-white">336-793-1191</a> · <a href="mailto:Info@Broyhill.net" className="hover:text-white">Info@Broyhill.net</a></p>
              <p>Office suites: <a href="mailto:Kristin@Broyhill.net" className="hover:text-white">Kristin@Broyhill.net</a></p>
              <p>
                <a href="https://www.instagram.com/historicbroyhill/" className="text-[#d6b574] hover:text-white">Instagram</a>
                {" · "}
                <a href="https://www.facebook.com/share/1EqXF8Xgpd/" className="text-[#d6b574] hover:text-white">Facebook</a>
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-[#f6f1e7] p-6 text-[#273440] sm:p-8">
            <InquiryForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#101f2d] text-[#9fb0b6]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 sm:flex-row sm:items-center">
          <div>
            <p className="hb-display text-base tracking-wide text-[#e9e2d3]">Historic Broyhill</p>
            <p className="mt-1 text-xs">The former Old Clemmons School, built 1925 · Clemmons, North Carolina.</p>
          </div>
          <p className="text-xs">Events: Sonja Kennedy · 336-908-8382 · <a href="mailto:Info@Broyhill.net" className="hover:text-[#e9e2d3]">Info@Broyhill.net</a></p>
        </div>
      </footer>
    </main>
  );
}

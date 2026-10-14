import Link from "next/link";
import { PhotoPlaceholder } from "@/components/photo-placeholder";

const offerings = [
  {
    number: "01",
    title: "Gather together",
    description: "Distinctive rooms for celebrations, conferences, and all the moments between.",
    href: "/event-spaces",
  },
  {
    number: "02",
    title: "Plan your event",
    description: "Explore event availability and tell us about your gathering.",
    href: "/availability",
  },
  {
    number: "03",
    title: "Lease a Class A office",
    description: "Class A office suites for lease for independent work and growing teams.",
    href: "/office-suites",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">A place with a past. Room for what’s next.</span>
          <h1>Gathered well.<br /><em>Remembered always.</em></h1>
          <p>
            A historic setting for meaningful gatherings and Class A office
            suites for lease.
          </p>
          <div className="hero-actions">
            <Link className="button button-dark" href="/plan-your-event">Plan your event <span aria-hidden="true">↗</span></Link>
            <Link className="text-link" href="/heritage">Discover our story <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="hero-caption"><span className="small-rule" /> A warm welcome. Open to possibility.</div>
        </div>
        <PhotoPlaceholder label="TODO-PHOTO · historic exterior or archival detail" className="hero-image" />
        <div className="hero-stamp" aria-hidden="true"><span>HISTORIC</span><strong>HB</strong><span>EST. WITH CARE</span></div>
      </section>

      <section className="story-band section-pad">
        <div className="story-heading">
          <span className="eyebrow">The Historic Broyhill story</span>
          <h2>Some places hold more<br />than a room.</h2>
        </div>
        <div className="story-copy">
          <p>
            There’s a different feeling to a place with character. Historic
            Broyhill brings people together in a setting shaped by craft,
            history, and the promise of what comes next.
          </p>
          <Link className="text-link" href="/heritage">Get to know the story <span aria-hidden="true">↗</span></Link>
          <p className="content-note">Heritage details and archival imagery will be added as they are confirmed.</p>
        </div>
      </section>

      <section className="offerings-section section-pad">
        <div className="section-heading">
          <div><span className="eyebrow">Gather here. Work here.</span><h2>Good things happen here.</h2></div>
          <Link className="text-link" href="/contact">Get in touch <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="offering-grid">
          {offerings.map((item) => (
            <Link className="offering-card" href={item.href} key={item.number}>
              <span className="offering-number">{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <span className="card-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-cta">
        <PhotoPlaceholder label="TODO-PHOTO · archival interior" className="cta-image" />
        <div className="cta-copy">
          <span className="eyebrow">The first step is a conversation</span>
          <h2>Let’s make room<br />for something good.</h2>
          <Link className="button button-light" href="/plan-your-event">Start planning <span aria-hidden="true">↗</span></Link>
        </div>
      </section>
    </>
  );
}

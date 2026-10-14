import type { Metadata } from "next";
import { InquiryForm } from "@/components/inquiry-form";
import { PageHeading } from "@/components/page-heading";

export const metadata: Metadata = { title: "Contact & directions" };

export default function ContactPage() {
  return (
    <>
      <section className="page-top section-pad">
        <PageHeading
          description="Questions about gatherings, stays, or a place to work? We’d love to hear what you have in mind."
          eyebrow="We’re all ears"
          note="Venue address, contact details, and directions will be added once confirmed."
          title="Come say hello."
        />
      </section>
      <section className="section-pad contact-section">
        <div className="directions-card">
          <div className="map-placeholder" aria-hidden="true">
            <span className="map-route map-route-one" />
            <span className="map-route map-route-two" />
            <span className="map-pin">HB</span>
            <span className="map-caption">LOCATION TO BE CONFIRMED</span>
          </div>
          <div className="directions-copy">
            <span className="eyebrow">Find your way here</span>
            <h2>Directions, coming soon.</h2>
            <p>The venue address and local directions will appear here once the site details are confirmed.</p>
            <span className="content-note">No map location has been assumed.</span>
          </div>
        </div>
        <div className="contact-form-wrap">
          <div className="form-aside">
            <span className="eyebrow">The beginning of something</span>
            <h2>What can we help with?</h2>
            <p>Send a note about your event, a group stay, office space, or anything else.</p>
            <div className="contact-shortcuts">
              <a href="/plan-your-event">Event planning <span aria-hidden="true">↗</span></a>
              <a href="/stay">Group stays <span aria-hidden="true">↗</span></a>
              <a href="/office-suites">Office leasing <span aria-hidden="true">↗</span></a>
            </div>
          </div>
          <InquiryForm
            intro="A few words are enough to get us started."
            kind="contact"
            title="Send us a note."
          />
        </div>
      </section>
    </>
  );
}

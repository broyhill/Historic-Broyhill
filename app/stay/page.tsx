import type { Metadata } from "next";
import { InquiryForm } from "@/components/inquiry-form";
import { PageHeading } from "@/components/page-heading";
import { PhotoPlaceholder } from "@/components/photo-placeholder";

export const metadata: Metadata = { title: "Stay" };

const hotelTypes = [
  { label: "Full-service stay", detail: "Hotel partner details and room-block terms to be confirmed." },
  { label: "Characterful boutique", detail: "Hotel partner details and room-block terms to be confirmed." },
  { label: "Longer stays", detail: "Hotel partner details and room-block terms to be confirmed." },
];

export default function StayPage() {
  return (
    <>
      <section className="page-top section-pad">
        <PageHeading
          description="Make the occasion an easy getaway. We’re building a local guide to trusted stays and group room blocks."
          eyebrow="A little further from home"
          note="Lodging categories are placeholders until partner properties and details are confirmed."
          title="Stay awhile."
        />
      </section>
      <section className="section-pad stay-section">
        <div className="hotel-grid">
          {hotelTypes.map((hotel, index) => (
            <article className="hotel-card" key={hotel.label}>
              <PhotoPlaceholder className={`hotel-photo photo-${["sage", "rust", "blue"][index]}`} label="TODO-PHOTO · partner hotel" />
              <span className="eyebrow">Partner stay · details to come</span>
              <h2>{hotel.label}</h2>
              <p>{hotel.detail}</p>
              <a href="#group-block" className="text-link">Ask about a group block <span aria-hidden="true">↗</span></a>
            </article>
          ))}
        </div>
      </section>
      <section className="section-pad form-section" id="group-block">
        <div className="form-aside">
          <span className="eyebrow">Travel together</span>
          <h2>One less thing to coordinate.</h2>
          <p>Tell us how many rooms your group needs and when you’re hoping to visit.</p>
          <span className="content-note">Room-block requests will be connected to a confirmed lodging partner before launch.</span>
        </div>
        <InquiryForm
          intro="We’ll help you explore suitable group options."
          kind="stay"
          stayOptions={hotelTypes.map((hotel) => hotel.label)}
          title="Request a group block."
        />
      </section>
    </>
  );
}

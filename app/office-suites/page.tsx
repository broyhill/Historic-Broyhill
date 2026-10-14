import type { Metadata } from "next";
import { InquiryForm } from "@/components/inquiry-form";
import { PageHeading } from "@/components/page-heading";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import suites from "@/data/suites.json";

export const metadata: Metadata = {
  title: "Class A office suites for lease",
  description: "Explore Class A office suites for lease at Historic Broyhill and inquire about availability or an office tour.",
};

export default function OfficeSuitesPage() {
  return (
    <>
      <section className="page-top section-pad">
        <PageHeading
          description="Explore Class A office suites for lease in a historic setting made for ideas and good work."
          eyebrow="Class A office leasing"
          note="Suite descriptions and availability are sample listings pending confirmation."
          title="Class A office suites for lease."
        />
      </section>
      <section className="section-pad suites-section">
        <div className="suite-intro">
          <div><span className="eyebrow">Find your corner</span><h2>Space to think.<br />Room to grow.</h2></div>
          <p>Whether you need a private office or a suite for your team, get in touch about office leasing, availability, and a tour.</p>
        </div>
        <div className="suite-grid">
          {suites.map((suite, index) => (
            <article className="suite-card" key={suite.name}>
              <PhotoPlaceholder className={`suite-photo photo-${["sage", "blue", "rust"][index]}`} label={`TODO-PHOTO · ${suite.name}`} />
              <div className="suite-card-copy">
                <span className={`suite-status${suite.status === "Coming soon" ? " status-coming" : ""}`}>{suite.status}</span>
                <h3>{suite.name}</h3>
                <p>{suite.size}</p>
                <span className="content-note">Sample office lease listing · confirm details</span>
                <a className="text-link" href="#leasing">Ask about leasing this office <span aria-hidden="true">↗</span></a>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="section-pad form-section" id="leasing">
        <div className="form-aside">
          <span className="eyebrow">Make it your workday</span>
          <h2>A good place to put down roots.</h2>
          <p>Share your office requirements and we’ll start a conversation about a Class A office lease or a tour.</p>
        </div>
        <InquiryForm
          intro="Tell us a little about your team and timing."
          kind="lease"
          suiteOptions={suites.map((suite) => suite.name)}
          title="Ask about office leasing."
        />
      </section>
    </>
  );
}

import type { Metadata } from "next";
import { InquiryForm } from "@/components/inquiry-form";
import { PageHeading } from "@/components/page-heading";
import { PhotoPlaceholder } from "@/components/photo-placeholder";
import suites from "@/data/suites.json";

export const metadata: Metadata = { title: "Office suites" };

export default function OfficeSuitesPage() {
  return (
    <>
      <section className="page-top section-pad">
        <PageHeading
          description="A little more character in your workday. Explore flexible office suites in a place made for ideas and good work."
          eyebrow="A place to do your thing"
          note="Suite descriptions and availability are sample listings pending confirmation."
          title="Work with a little more history."
        />
      </section>
      <section className="section-pad suites-section">
        <div className="suite-intro">
          <div><span className="eyebrow">Find your corner</span><h2>Space to think.<br />Room to grow.</h2></div>
          <p>Whether you need a private room or a small team base, get in touch to explore the right fit.</p>
        </div>
        <div className="suite-grid">
          {suites.map((suite, index) => (
            <article className="suite-card" key={suite.name}>
              <PhotoPlaceholder className={`suite-photo photo-${["sage", "blue", "rust"][index]}`} label={`TODO-PHOTO · ${suite.name}`} />
              <div className="suite-card-copy">
                <span className={`suite-status${suite.status === "Coming soon" ? " status-coming" : ""}`}>{suite.status}</span>
                <h3>{suite.name}</h3>
                <p>{suite.size}</p>
                <span className="content-note">Sample listing · confirm details</span>
                <a className="text-link" href="#leasing">Ask about this suite <span aria-hidden="true">↗</span></a>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="section-pad form-section" id="leasing">
        <div className="form-aside">
          <span className="eyebrow">Make it your workday</span>
          <h2>A good place to put down roots.</h2>
          <p>Share what you’re looking for and we’ll start a conversation about leasing.</p>
        </div>
        <InquiryForm
          intro="Tell us a little about your team and timing."
          kind="lease"
          suiteOptions={suites.map((suite) => suite.name)}
          title="Ask about leasing."
        />
      </section>
    </>
  );
}

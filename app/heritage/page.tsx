import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { PhotoPlaceholder } from "@/components/photo-placeholder";

export const metadata: Metadata = { title: "Heritage" };

const chapters = [
  {
    index: "01",
    era: "The beginning",
    title: "A story takes shape.",
    description: "Add the verified founding date, people, and purpose of Historic Broyhill here.",
    image: "TODO-PHOTO · earliest archival image",
  },
  {
    index: "02",
    era: "A place grows",
    title: "Made to bring people together.",
    description: "Add a sourced account of how the place, its rooms, and its community changed over time.",
    image: "TODO-PHOTO · people or place through the years",
  },
  {
    index: "03",
    era: "The next chapter",
    title: "History, still being made.",
    description: "Share how Historic Broyhill is welcoming a new generation of gatherings and ideas.",
    image: "TODO-PHOTO · present-day detail",
  },
];

export default function HeritagePage() {
  return (
    <>
      <section className="page-top section-pad">
        <PageHeading
          description="A place’s story is told in its details, its people, and the memories made inside it."
          eyebrow="A living history"
          note="Timeline copy and dates are placeholders pending verified archival research."
          title="The story is in the details."
        />
      </section>
      <section className="heritage-intro section-pad">
        <PhotoPlaceholder label="TODO-PHOTO · archival portrait or building detail" className="heritage-lead-photo" />
        <div>
          <span className="eyebrow">A history worth holding onto</span>
          <h2>Then, now, and everything in between.</h2>
          <p>
            Historic Broyhill is a place to gather around what matters. This
            timeline is ready for the people, moments, and milestones that
            make its history unmistakably its own.
          </p>
          <span className="content-note">No dates or historical claims have been added without source material.</span>
        </div>
      </section>
      <section className="timeline-section section-pad">
        <div className="section-heading">
          <div><span className="eyebrow">A timeline</span><h2>Three chapters. One unfolding story.</h2></div>
          <span className="timeline-pending">Historical sources to be added</span>
        </div>
        <ol className="timeline">
          {chapters.map((chapter) => (
            <li className="timeline-entry" key={chapter.index}>
              <div className="timeline-marker"><span>{chapter.index}</span></div>
              <div className="timeline-copy">
                <span className="eyebrow">{chapter.era} · date to confirm</span>
                <h3>{chapter.title}</h3>
                <p>{chapter.description}</p>
              </div>
              <PhotoPlaceholder className="timeline-photo" label={chapter.image} />
            </li>
          ))}
        </ol>
      </section>
      <section className="simple-cta section-pad">
        <span className="eyebrow">Make a little history of your own</span>
        <h2>Bring your people together.</h2>
        <Link className="button button-dark" href="/event-spaces">Explore event spaces <span aria-hidden="true">↗</span></Link>
      </section>
    </>
  );
}

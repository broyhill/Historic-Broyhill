import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { SpaceBrowser } from "@/components/space-browser";
import rooms from "@/data/rooms.json";

export const metadata: Metadata = { title: "Event spaces" };

export default function EventSpacesPage() {
  return (
    <>
      <section className="page-top section-pad">
        <PageHeading
          description="From an intimate boardroom to a room for the whole company, find a setting that fits the way you want to gather."
          eyebrow="Rooms for good company"
          note="Room names, capacities, and history notes are sample data. Confirm details before publishing."
          title="Find your kind of room."
        />
      </section>
      <section className="section-pad spaces-section">
        <SpaceBrowser rooms={rooms} />
      </section>
      <section className="simple-cta section-pad">
        <span className="eyebrow">Not sure where to start?</span>
        <h2>We’ll help you find the right fit.</h2>
        <a className="button button-dark" href="/plan-your-event">Tell us what you’re planning <span aria-hidden="true">↗</span></a>
      </section>
    </>
  );
}

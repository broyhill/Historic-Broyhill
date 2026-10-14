import type { Metadata } from "next";
import { InquiryForm } from "@/components/inquiry-form";
import { PageHeading } from "@/components/page-heading";
import rooms from "@/data/rooms.json";

export const metadata: Metadata = { title: "Plan your event" };
export const instant = false;

type EventPageProps = {
  searchParams: Promise<{ spaces?: string | string[] }>;
};

export default async function PlanYourEventPage({ searchParams }: EventPageProps) {
  const params = await searchParams;
  const rawSpaces = Array.isArray(params.spaces) ? params.spaces.join(",") : params.spaces ?? "";
  const requestedIds = new Set(rawSpaces.split(",").filter(Boolean));
  const selectedSpaceIds = rooms.filter((room) => requestedIds.has(room.id)).map((room) => room.id);

  return (
    <>
      <section className="page-top section-pad">
        <PageHeading
          description="Tell us what you’re bringing people together for. We’ll help you work out the room, the details, and the rest."
          eyebrow="Plan something memorable"
          note="This form is a preview and does not transmit submissions."
          title="Let’s make it yours."
        />
      </section>
      <section className="section-pad request-section">
        <div className="request-aside">
          <span className="eyebrow">Thoughtful from the start</span>
          <h2>A few details make a good beginning.</h2>
          <p>Share what you know so far. Your date, guest count, and the kind of gathering are plenty to get a conversation started.</p>
          <div className="request-aside-note"><span>01</span><p>Looking for a date? Check the <a href="/availability">availability calendar</a>.</p></div>
          <div className="request-aside-note"><span>02</span><p>Still finding your room? Browse <a href="/event-spaces">event spaces</a>.</p></div>
        </div>
        <InquiryForm
          initialSpaceIds={selectedSpaceIds}
          intro="No need to have every detail figured out. We’ll take it from here."
          kind="event"
          spaces={rooms.map(({ id, name }) => ({ id, name }))}
          title="Your event, your way."
        />
      </section>
    </>
  );
}

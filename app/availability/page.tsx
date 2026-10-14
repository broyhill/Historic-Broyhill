import type { Metadata } from "next";
import { AvailabilityCalendar, type AvailabilityData } from "@/components/availability-calendar";
import { PageHeading } from "@/components/page-heading";
import availability from "@/data/availability.json";

export const metadata: Metadata = { title: "Availability" };

export default function AvailabilityPage() {
  return (
    <>
      <section className="page-top section-pad">
        <PageHeading
          description="A first look at dates for your celebration, meeting, or gathering. Choose a day to check its current status."
          eyebrow="Make a date"
          note="Sample schedule · open, held, and booked dates are loaded from data/availability.json."
          title="A good day starts here."
        />
      </section>
      <section className="section-pad availability-section">
        <AvailabilityCalendar data={availability as AvailabilityData} />
      </section>
    </>
  );
}

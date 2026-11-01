import type { Metadata } from "next";
import SiteHeader from "../components/SiteHeader";
import AvailabilityCalendar from "../components/AvailabilityCalendar";
import { AVAILABILITY, SPACES } from "@/lib/spaces";

export const metadata: Metadata = {
  title: "Availability — Historic Broyhill",
  description: "A first look at open, held and booked dates for every Historic Broyhill event space. Pick a day to see which rooms are open, then send your request.",
};

export default function AvailabilityPage() {
  return (
    <main className="hb-body bg-[#f6f1e7] text-[#273440]">
      <SiteHeader />
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b574]">Availability</p>
          <h1 className="hb-display mt-5 text-4xl text-[#f4ecda] sm:text-5xl md:text-[3.3rem]">A good day starts here.</h1>
          <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-[#bcc6c9]">
            Choose a day to see which of our four spaces are open. The venue team confirms every date — nothing is reserved until you hear from us.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-12 md:py-16">
        <AvailabilityCalendar spaces={SPACES} data={AVAILABILITY} />
      </section>
      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="rounded-xl border border-[#e4dac6] bg-[#efe7d6] p-8 text-center">
          <h2 className="hb-display text-2xl text-[#182c3e]">Prefer to book a room directly?</h2>
          <p className="mt-3 text-[16px] text-[#5a6672]">Our booking portal handles day and half-day room reservations.</p>
          <a href="https://broyhill.skedda.com/booking" className="mt-5 inline-flex min-h-[44px] items-center rounded-md bg-[#c2a15a] px-6 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:bg-[#d2b268]">Book now →</a>
        </div>
      </section>
    </main>
  );
}

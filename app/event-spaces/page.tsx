import type { Metadata } from "next";
import SiteHeader from "../components/SiteHeader";
import SpaceBrowser from "../components/SpaceBrowser";
import { SPACES, validDate } from "@/lib/spaces";

export const metadata: Metadata = {
  title: "Event Spaces — Historic Broyhill",
  description: "Find the right room at Historic Broyhill: filter The Magnolia Room, The Boardrooms, The Dock and The Loft by guest count and setup, then add them to your event request.",
};

export default async function EventSpacesPage({ searchParams }: { searchParams: Promise<{ date?: string | string[] }> }) {
  const params = await searchParams;
  const date = validDate(params.date);
  return (
    <main className="hb-body bg-[#f6f1e7] text-[#273440]">
      <SiteHeader />
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b574]">Event Spaces</p>
          <h1 className="hb-display mt-5 text-4xl text-[#f4ecda] sm:text-5xl md:text-[3.3rem]">Find your kind of room.</h1>
          <p className="mt-5 max-w-2xl text-[18px] leading-relaxed text-[#bcc6c9]">
            From a private boardroom to a hall for 140, choose the setting that fits the way you want to gather. Pick the spaces you are considering and we will pre-fill your request.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-12 md:py-16">
        <SpaceBrowser spaces={SPACES} date={date} />
      </section>
      <section className="mx-auto max-w-6xl px-5 pb-16">
        <div className="rounded-xl border border-[#e4dac6] bg-[#efe7d6] p-8 text-center">
          <h2 className="hb-display text-2xl text-[#182c3e]">Have a date in mind?</h2>
          <p className="mt-3 text-[16px] text-[#5a6672]">See which rooms are open on the day you are planning.</p>
          <a href="/availability" className="mt-5 inline-flex min-h-[44px] items-center rounded-md border border-[#182c3e]/25 px-6 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:border-[#182c3e]/50">Check availability →</a>
        </div>
      </section>
    </main>
  );
}

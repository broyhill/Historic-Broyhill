import type { Metadata } from "next";
import SiteHeader from "../components/SiteHeader";
import InquiryForm from "../components/InquiryForm";
import { formatDateKey, spaceById, validDate, validSpaceIds } from "@/lib/spaces";

export const metadata: Metadata = {
  title: "Plan Your Event — Historic Broyhill",
  description: "Tell us about your gathering at Historic Broyhill. Your request arrives pre-filled with the spaces and date you picked.",
};

type Params = { spaces?: string | string[]; date?: string | string[] };

export default async function PlanYourEventPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const spaceIds = validSpaceIds(params.spaces);
  const spaceNames = spaceIds.map((id) => spaceById(id)!.name);
  const date = validDate(params.date);

  return (
    <main className="hb-body bg-[#f6f1e7] text-[#273440]">
      <SiteHeader />
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b574]">Plan your event</p>
            <h1 className="hb-display mt-4 text-4xl leading-tight text-[#f4ecda] md:text-[3rem]">Let&rsquo;s make it yours.</h1>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed text-[#bcc6c9]">
              Share what you know so far — your date, your guest count and the kind of gathering are plenty to start a conversation.
            </p>

            <dl className="mt-8 space-y-4 border-t border-white/15 pt-6 text-[15px]">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b574]">Spaces you picked</dt>
                <dd className="mt-1 text-[#e9e2d3]">
                  {spaceNames.length ? spaceNames.join(" · ") : "None yet"}
                  {" — "}
                  <a href={`/event-spaces${date ? `?date=${date}` : ""}`} className="text-[#d6b574] underline hover:text-white">{spaceNames.length ? "change" : "browse event spaces"}</a>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b574]">Date you picked</dt>
                <dd className="mt-1 text-[#e9e2d3]">
                  {date ? formatDateKey(date) : "Not chosen yet"}
                  {" — "}
                  <a href="/availability" className="text-[#d6b574] underline hover:text-white">{date ? "change" : "check availability"}</a>
                </dd>
              </div>
            </dl>

            <div className="mt-8 space-y-2 text-[15px] text-[#bcc6c9]">
              <p>Events: Sonja Kennedy · <a href="tel:+13369088382" className="hover:text-white">336-908-8382</a></p>
              <p>General: <a href="tel:+13367931191" className="hover:text-white">336-793-1191</a> · <a href="mailto:Info@Broyhill.net" className="hover:text-white">Info@Broyhill.net</a></p>
              <p>3540 Clemmons Road, Suite 111 · Clemmons, NC 27012</p>
            </div>
          </div>
          <div className="rounded-xl bg-[#f6f1e7] p-6 text-[#273440] sm:p-8">
            <InquiryForm initialSpaces={spaceNames} initialDate={date ?? undefined} />
          </div>
        </div>
      </section>
    </main>
  );
}

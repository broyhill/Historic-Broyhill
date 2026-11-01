import type { Metadata } from "next";
import SiteHeader from "../components/SiteHeader";
import ExpressBookForm from "../components/ExpressBookForm";
import { formatDateKey, spaceById, validDate, validSpaceIds } from "@/lib/spaces";

export const metadata: Metadata = {
  title: "Request a Date — Historic Broyhill",
  description: "Ask for a room on a date at Historic Broyhill. The venue team confirms every request personally before anything is held.",
};

type Params = { space?: string | string[]; date?: string | string[] };

export default async function BookPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const space = validSpaceIds(params.space)[0];
  const date = validDate(params.date);
  const spaceName = space ? spaceById(space)!.name : null;

  return (
    <main className="hb-body bg-[#f6f1e7] text-[#273440]">
      <SiteHeader />
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b574]">Request a date</p>
            <h1 className="hb-display mt-4 text-4xl leading-tight text-[#f4ecda] md:text-[3rem]">Hold my spot.</h1>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed text-[#bcc6c9]">
              Pick a room and a day. Your request goes straight to the venue team — a real person confirms it, usually the same day.
            </p>
            <dl className="mt-8 space-y-4 border-t border-white/15 pt-6 text-[15px]">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b574]">You asked for</dt>
                <dd className="mt-1 text-[#e9e2d3]">
                  {(spaceName || date)
                    ? <>{spaceName ?? "Any space"}{date ? ` on ${formatDateKey(date)}` : ""} — <a href="/availability" className="text-[#d6b574] underline hover:text-white">change</a></>
                    : <>Nothing picked yet — <a href="/availability" className="text-[#d6b574] underline hover:text-white">check availability first</a></>}
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
            <ExpressBookForm initialSpace={space} initialDate={date ?? undefined} />
          </div>
        </div>
      </section>
    </main>
  );
}

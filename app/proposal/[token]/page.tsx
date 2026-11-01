import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import { prisma } from "@/lib/prisma";
import { ensureVenueTables } from "@/lib/venue-db";
import { spaceById } from "@/lib/spaces";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Proposal — Historic Broyhill",
  description: "A private proposal link prepared by the Historic Broyhill venue team.",
  robots: { index: false, follow: false },
};

// Public, unguessable proposal link shared by the venue team. Read-only.
export default async function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-z0-9]{16,64}$/i.test(token)) notFound();

  try {
    await ensureVenueTables();
  } catch {
    notFound();
  }
  const event = await prisma.venueEvent.findUnique({ where: { shareToken: token } }).catch(() => null);
  if (!event) notFound();

  const rooms = (Array.isArray(event.spaces) ? event.spaces : [])
    .map((id) => spaceById(String(id))?.name ?? String(id));

  return (
    <main className="hb-body bg-[#f6f1e7] text-[#273440]">
      <SiteHeader />
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto max-w-3xl px-5 py-14 md:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b574]">Historic Broyhill</p>
          <h1 className="hb-display mt-4 text-4xl leading-tight text-[#f4ecda]">{event.name}</h1>
          <dl className="mt-6 grid gap-x-8 gap-y-3 border-t border-white/15 pt-6 text-[15px] sm:grid-cols-2">
            <div><dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b574]">Spaces</dt><dd className="mt-1 text-[#e9e2d3]">{rooms.join(" · ") || "To be confirmed"}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b574]">Date</dt><dd className="mt-1 text-[#e9e2d3]">{event.dateStart ?? "To be confirmed"}{event.dateEnd ? ` – ${event.dateEnd}` : ""}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b574]">Guests</dt><dd className="mt-1 text-[#e9e2d3]">{event.guests ?? "To be confirmed"}</dd></div>
            <div><dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6b574]">Status</dt><dd className="mt-1 text-[#e9e2d3]">{event.status.charAt(0) + event.status.slice(1).toLowerCase()}</dd></div>
          </dl>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-5 py-12 space-y-10">
        <div>
          <h2 className="hb-display text-2xl text-[#182c3e]">Your proposal</h2>
          <div className="mt-4 whitespace-pre-wrap rounded-xl border border-[#e4dac6] bg-white p-6 text-[15px] leading-relaxed text-[#273440]">
            {event.proposalDraft ?? "Your proposal is being prepared — the venue team will have it here shortly."}
          </div>
        </div>
        {event.beoDraft && (
          <div>
            <h2 className="hb-display text-2xl text-[#182c3e]">Run of day</h2>
            <div className="mt-4 whitespace-pre-wrap rounded-xl border border-[#e4dac6] bg-white p-6 text-[15px] leading-relaxed text-[#273440]">
              {event.beoDraft}
            </div>
          </div>
        )}
        <div className="rounded-xl border border-[#e4dac6] bg-[#efe7d6] p-8 text-center">
          <h2 className="hb-display text-2xl text-[#182c3e]">Ready to move forward?</h2>
          <p className="mt-3 text-[16px] text-[#5a6672]">Sonja Kennedy, events · <a href="tel:+13369088382" className="text-[#182c3e] underline">336-908-8382</a> · <a href="mailto:Info@Broyhill.net" className="text-[#182c3e] underline">Info@Broyhill.net</a></p>
        </div>
      </section>
    </main>
  );
}

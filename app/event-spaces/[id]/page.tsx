import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import { SPACES } from "@/lib/spaces";

type Params = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return SPACES.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const space = SPACES.find((s) => s.id === id);
  if (!space) return { title: "Event Spaces — Historic Broyhill" };
  const cap = space.maxGuests ? `up to ${space.maxGuests} guests` : "capacity on request";
  return {
    title: `${space.name} — Historic Broyhill`,
    description: `${space.name} at Historic Broyhill in Clemmons, NC: ${space.kind.toLowerCase()}, ${cap}. Setups, features and how to request a proposal.`,
    alternates: { canonical: `/event-spaces/${space.id}` },
  };
}

export default async function SpacePage({ params }: Params) {
  const { id } = await params;
  const space = SPACES.find((s) => s.id === id);
  if (!space) notFound();
  const others = SPACES.filter((s) => s.id !== space.id);
  const planHref = `/plan-your-event?spaces=${encodeURIComponent(space.id)}`;

  return (
    <main className="hb-body bg-[#f6f1e7] text-[#273440]">
      <SiteHeader />
      <section className="bg-[#182c3e] text-[#e9e2d3]">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <nav aria-label="Breadcrumb" className="text-[12px] uppercase tracking-[0.18em] text-[#9fb0b8]">
              <a href="/event-spaces" className="inline-flex min-h-[44px] items-center hover:text-white">Event Spaces</a>
              <span aria-hidden="true" className="px-2">/</span>
              <span className="text-[#d6b574]">{space.name}</span>
            </nav>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d6b574]">{space.kind}{space.indoor ? "" : " · Outdoor"}</p>
            <h1 className="hb-display mt-4 text-4xl text-[#f4ecda] sm:text-5xl">{space.name}</h1>
            <p className="mt-5 text-[18px] leading-relaxed text-[#bcc6c9]">{space.story}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={planHref} className="inline-flex min-h-[48px] items-center rounded-md bg-[#c2a15a] px-6 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:bg-[#d6b574]">
                Request a proposal
              </a>
              <a href="/availability" className="inline-flex min-h-[48px] items-center rounded-md border border-[#e9e2d3]/40 px-6 text-sm font-semibold uppercase tracking-[0.1em] text-[#e9e2d3] transition hover:border-[#e9e2d3]">
                Check availability
              </a>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#223b52]">
            {space.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={space.photo} alt={space.photoAlt} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-sm text-[#9fb0b8]">{space.photoAlt}</div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-12 md:grid-cols-3 md:py-16">
        <div className="md:col-span-2">
          <h2 className="hb-display text-2xl text-[#182c3e]">Capacity by setup</h2>
          <table className="mt-4 w-full text-[15px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-[#7a6f58]">
                <th className="py-2 font-semibold">Setup</th>
                <th className="py-2 text-right font-semibold">Guests</th>
              </tr>
            </thead>
            <tbody>
              {space.capacities.map((c) => (
                <tr key={c.setup} className="border-t border-[#e4dac6]">
                  <td className="py-2.5">{c.setup}</td>
                  <td className="py-2.5 text-right text-[#273440]">{c.guests}</td>
                </tr>
              ))}
              <tr className="border-t border-[#e4dac6]">
                <td className="py-2.5">Room size</td>
                <td className="py-2.5 text-right">{space.sizeSqFt ? `${space.sizeSqFt} sq ft` : "[CONFIRM: size]"}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-[13px] text-[#7a6f58]">Numbers marked [CONFIRM] are being verified by the venue team; ask us and we will confirm for your layout.</p>
        </div>
        <div>
          <h2 className="hb-display text-2xl text-[#182c3e]">Features</h2>
          <ul className="mt-4 space-y-2 text-[15px]">
            {space.features.map((f) => (
              <li key={f} className="flex gap-2"><span aria-hidden="true" className="text-[#c2a15a]">◆</span>{f}</li>
            ))}
          </ul>
          {space.setups.length ? (
            <>
              <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7a6f58]">Setups we arrange</h3>
              <p className="mt-2 text-[15px]">{space.setups.join(" · ")}</p>
            </>
          ) : null}
        </div>
      </section>

      <section className="border-t border-[#e4dac6] bg-[#efe7d6]">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <h2 className="hb-display text-2xl text-[#182c3e]">Other spaces</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-3">
            {others.map((o) => (
              <li key={o.id}>
                <a href={`/event-spaces/${o.id}`} className="flex min-h-[44px] flex-col rounded-lg border border-[#d8cdb8] bg-white/60 p-4 hover:border-[#c2a15a]">
                  <span className="hb-display text-lg text-[#182c3e]">{o.name}</span>
                  <span className="text-[13px] text-[#7a6f58]">{o.maxGuests ? `Up to ${o.maxGuests} guests` : "Capacity on request"}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

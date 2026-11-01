"use client";

import { useMemo, useState } from "react";
import { fitsGuests, type Space } from "@/lib/spaces";

/* Event Spaces finder. Filters never hide a room whose capacity the venue has not
   published; those rooms stay listed with a "capacity to confirm" note. */

const GUEST_OPTIONS = [
  { value: 0, label: "Any size party" },
  { value: 10, label: "10 or more guests" },
  { value: 20, label: "20 or more guests" },
  { value: 60, label: "60 or more guests" },
  { value: 100, label: "100 or more guests" },
];

const field =
  "min-h-[44px] w-full rounded-lg border border-[#d8cdb8] bg-white/80 px-3.5 py-2.5 text-[15px] text-[#1b2a36] focus:border-[#c2a15a] focus:outline-none focus:ring-2 focus:ring-[#c2a15a]/30";
const label = "block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7a6f58] mb-1.5";

export default function SpaceBrowser({ spaces, date }: { spaces: Space[]; date?: string | null }) {
  const [minGuests, setMinGuests] = useState(0);
  const [setup, setSetup] = useState("any");
  const [selected, setSelected] = useState<string[]>([]);

  const setups = useMemo(() => [...new Set(spaces.flatMap((s) => s.setups))].sort(), [spaces]);
  const filtered = useMemo(
    () => spaces.filter((s) => fitsGuests(s, minGuests) && (setup === "any" || s.setups.includes(setup))),
    [spaces, minGuests, setup],
  );

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  const params = new URLSearchParams();
  if (selected.length) params.set("spaces", selected.join(","));
  if (date) params.set("date", date);
  const planHref = `/plan-your-event${params.toString() ? `?${params}` : ""}`;

  return (
    <div>
      <form
        className="grid gap-4 rounded-xl border border-[#e4dac6] bg-white/60 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        aria-label="Filter event spaces"
        onSubmit={(e) => e.preventDefault()}
      >
        <div>
          <label htmlFor="es-guests" className={label}>How many guests</label>
          <select id="es-guests" className={field} value={minGuests} onChange={(e) => setMinGuests(Number(e.target.value))}>
            {GUEST_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="es-setup" className={label}>Setup</label>
          <select id="es-setup" className={field} value={setup} onChange={(e) => setSetup(e.target.value)}>
            <option value="any">Any setup</option>
            {setups.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => { setMinGuests(0); setSetup("any"); }}
          className="min-h-[44px] rounded-lg border border-[#182c3e]/25 px-4 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:border-[#182c3e]/50 active:scale-[0.97] motion-reduce:active:scale-100"
        >
          Reset
        </button>
      </form>

      <p className="mt-3 text-xs text-[#7a6f58]" aria-live="polite">
        Showing {filtered.length} of {spaces.length} spaces. Sizes and some capacities are not published yet; the venue team confirms every detail.
      </p>

      {filtered.length ? (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {filtered.map((space, index) => {
            const isSelected = selected.includes(space.id);
            return (
              <article key={space.id} className="flex flex-col overflow-hidden rounded-xl border border-[#e4dac6] bg-white/60">
                <div className="relative aspect-[4/3] bg-[#ece2cf]">
                  {space.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={space.photo} alt={space.photoAlt} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a8853f]">Photo</span>
                      <span className="text-xs text-[#8c7d5f]">{space.photoAlt}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <div className="flex items-baseline justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a8853f]">
                    <span>{space.kind}</span>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h2 className="hb-display mt-2 text-2xl text-[#182c3e]"><a href={`/event-spaces/${space.id}`} className="inline-flex min-h-[44px] items-center hover:text-[#a8853f]">{space.name}</a></h2>
                  <p className="mt-2 text-[15px] leading-relaxed text-[#5a6672]">{space.story}</p>

                  <table className="mt-4 w-full text-[14px]">
                    <caption className="sr-only">{space.name} capacity by setup</caption>
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-[#7a6f58]">
                        <th scope="col" className="py-1 font-semibold">Setup</th>
                        <th scope="col" className="py-1 text-right font-semibold">Guests</th>
                      </tr>
                    </thead>
                    <tbody>
                      {space.capacities.map((c) => (
                        <tr key={c.setup} className="border-t border-[#e4dac6]">
                          <td className="py-1.5 text-[#273440]">{c.setup}</td>
                          <td className="py-1.5 text-right text-[#273440]">{c.guests}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-[#e4dac6]">
                        <td className="py-1.5 text-[#273440]">Size</td>
                        <td className="py-1.5 text-right text-[#273440]">{space.sizeSqFt ? `${space.sizeSqFt.toLocaleString("en-US")} sq ft` : "[CONFIRM: size]"}</td>
                      </tr>
                    </tbody>
                  </table>
                  {space.maxGuests === null ? (
                    <p className="mt-2 text-xs text-[#7a6f58]">Capacity to confirm with the venue — kept in every search.</p>
                  ) : null}

                  <ul className="mt-4 flex flex-wrap gap-2">
                    {space.setups.map((s) => (
                      <li key={s} className="rounded-full border border-[#e4dac6] bg-[#f6f1e7] px-3 py-1 text-xs text-[#5a6672]">{s}</li>
                    ))}
                  </ul>
                  <ul className="mt-3 space-y-1 text-[13px] text-[#5a6672]">
                    {space.features.map((f) => <li key={f}>· {f}</li>)}
                  </ul>

                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggle(space.id)}
                    className={`mt-5 min-h-[44px] w-full rounded-lg px-4 text-sm font-semibold uppercase tracking-[0.1em] transition active:scale-[0.97] motion-reduce:active:scale-100 ${
                      isSelected ? "bg-[#182c3e] text-[#f4ecda] hover:bg-[#22384c]" : "border border-[#182c3e]/25 text-[#182c3e] hover:border-[#182c3e]/50"
                    }`}
                  >
                    {isSelected ? "Added to my event ✓" : "Add to my event"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-6 rounded-xl border border-[#e4dac6] bg-white/60 p-6 text-[15px] text-[#5a6672]">
          No space matches those filters. Try a smaller guest count or any setup — or <a href="/plan-your-event" className="font-semibold text-[#182c3e] underline">tell us what you are planning</a>.
        </p>
      )}

      <div className="sticky bottom-0 mt-8">
        <div className="rounded-xl border border-[#e4dac6] bg-[#efe7d6]/95 p-4 shadow-[0_-4px_24px_rgba(24,44,62,0.08)] backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a8853f]">
              {selected.length ? `${selected.length} ${selected.length === 1 ? "space" : "spaces"} selected` : "Your event"}
              {date ? ` · ${date}` : ""}
            </p>
            {selected.length ? (
              <ul aria-label="Selected spaces" className="mt-2 flex flex-wrap gap-2">
                {selected.map((id) => {
                  const space = spaces.find((s) => s.id === id);
                  if (!space) return null;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        aria-label={`Remove ${space.name} from my event`}
                        onClick={() => toggle(id)}
                        className="min-h-[44px] rounded-full border border-[#182c3e]/25 bg-white/80 px-4 text-sm text-[#182c3e] hover:border-[#182c3e]/50"
                      >
                        {space.name} <span aria-hidden="true">×</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-1 text-[14px] text-[#5a6672]">Add the spaces you are considering and we will pre-fill your request.</p>
            )}
          </div>
          <a
            href={planHref}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-md bg-[#c2a15a] px-6 text-sm font-semibold uppercase tracking-[0.1em] text-[#182c3e] transition hover:bg-[#d2b268] sm:mt-0"
          >
            {selected.length ? "Plan my event →" : "Plan an event →"}
          </a>
        </div>
      </div>
    </div>
  );
}

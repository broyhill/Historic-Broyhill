"use client";

import { useEffect, useState } from "react";
import { formatDateKey, statusFor, type Availability, type Space, type Status } from "@/lib/spaces";

/* Month calendar driven by app/data/availability.json. Each day shows how many
   rooms are open; picking a day lists every room's status for it. The calendar
   opens on the visitor's current month (set after mount, so there is no
   hard-coded date and no server/client mismatch). */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function keyFor(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<Status, string> = { open: "Open", held: "Held", booked: "Booked" };
const STATUS_DOT: Record<Status, string> = { open: "bg-[#2f7d4f]", held: "bg-[#b7791f]", booked: "bg-[#b83232]" };

export default function AvailabilityCalendar({ spaces, data }: { spaces: Space[]; data: Availability }) {
  const [month, setMonth] = useState<Date | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  }, []);

  if (!month) {
    return <div className="min-h-[420px] rounded-xl border border-[#e4dac6] bg-white/60" aria-busy="true" aria-label="Loading calendar" />;
  }

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  const offset = new Date(year, monthIndex, 1).getDay();
  const cells = Array.from({ length: Math.ceil((offset + dayCount) / 7) * 7 }, (_, i) => {
    const day = i - offset + 1;
    return day >= 1 && day <= dayCount ? day : null;
  });
  const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function shift(amount: number) {
    setMonth((cur) => (cur ? new Date(cur.getFullYear(), cur.getMonth() + amount, 1) : cur));
    setSelected(null);
  }

  function openCount(dateKey: string) {
    return spaces.filter((s) => statusFor(s.id, dateKey, data) === "open").length;
  }

  const planHref = selected ? `/plan-your-event?date=${selected}` : "/plan-your-event";

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-xl border border-[#e4dac6] bg-white/60 p-3 sm:p-6" aria-label="Availability calendar">
        <div className="flex items-center justify-between gap-4">
          <h2 className="hb-display text-2xl text-[#182c3e]">{monthLabel}</h2>
          <div className="flex gap-2">
            <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="grid h-11 w-11 place-items-center rounded-lg border border-[#182c3e]/25 text-[#182c3e] transition hover:border-[#182c3e]/50 active:scale-[0.97] motion-reduce:active:scale-100">←</button>
            <button type="button" aria-label="Next month" onClick={() => shift(1)} className="grid h-11 w-11 place-items-center rounded-lg border border-[#182c3e]/25 text-[#182c3e] transition hover:border-[#182c3e]/50 active:scale-[0.97] motion-reduce:active:scale-100">→</button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-0 sm:gap-2" role="grid" aria-label={`${monthLabel} availability`}>
          {WEEKDAYS.map((d) => (
            <div key={d} role="columnheader" className="pb-1 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7a6f58]">{d}</div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <span key={`blank-${i}`} aria-hidden="true" />;
            const dateKey = keyFor(year, monthIndex, day);
            const open = openCount(dateKey);
            const tone = open === spaces.length ? "open" : open === 0 ? "booked" : "held";
            const isSelected = selected === dateKey;
            return (
              <button
                key={dateKey}
                type="button"
                role="gridcell"
                aria-selected={isSelected}
                aria-label={`${formatDateKey(dateKey)}: ${open} of ${spaces.length} rooms open`}
                onClick={() => setSelected(dateKey)}
                className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center rounded-lg border text-[14px] transition active:scale-[0.97] motion-reduce:active:scale-100 sm:min-h-[56px] ${
                  isSelected ? "border-[#182c3e] bg-[#182c3e] text-[#f4ecda]" : "border-[#e4dac6] bg-white/70 text-[#273440] hover:border-[#a8853f]"
                }`}
              >
                <span>{day}</span>
                <span className="mt-1 flex items-center gap-1 text-[10px]">
                  <i aria-hidden="true" className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[tone]}`} />
                  <span className={isSelected ? "text-[#f4ecda]/80" : "text-[#7a6f58]"}>{open}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-xs text-[#5a6672]">
          <span className="flex items-center gap-1.5"><i className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT.open}`} /> All rooms open</span>
          <span className="flex items-center gap-1.5"><i className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT.held}`} /> Some rooms held or booked</span>
          <span className="flex items-center gap-1.5"><i className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT.booked}`} /> No rooms open</span>
          <span>· number = rooms open that day</span>
        </div>
      </section>

      <aside className="rounded-xl border border-[#e4dac6] bg-[#efe7d6] p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a8853f]">Rooms on your date</p>
        {selected ? (
          <>
            <h3 className="hb-display mt-3 text-2xl text-[#182c3e]">{formatDateKey(selected)}</h3>
            <ul className="mt-4 divide-y divide-[#e4dac6]" aria-live="polite">
              {spaces.map((space) => {
                const status = statusFor(space.id, selected, data);
                return (
                  <li key={space.id} className="flex items-center justify-between gap-3 py-2.5 text-[15px]">
                    <span className="text-[#273440]">{space.name}</span>
                    <span className="flex items-center gap-1.5 text-[#5a6672]">
                      <i aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
                      {STATUS_LABEL[status]}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-[15px] leading-relaxed text-[#5a6672]">Choose a day to see which rooms are open, held or booked.</p>
        )}
        <p className="mt-5 text-xs text-[#7a6f58]">Open dates are a starting point. The venue team confirms every date before anything is reserved.</p>
        {data.sample ? <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#a8853f]">Sample schedule</p> : null}
        <a
          href={planHref}
          className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-[#182c3e] px-5 text-sm font-semibold uppercase tracking-[0.1em] text-[#f4ecda] transition hover:bg-[#22384c]"
        >
          {selected ? "Request this date →" : "Plan your event →"}
        </a>
      </aside>
    </div>
  );
}

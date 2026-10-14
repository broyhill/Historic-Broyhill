"use client";

import { useState } from "react";
import Link from "next/link";

export type Status = "open" | "held" | "booked";
export type AvailabilityData = {
  sample: boolean;
  defaultStatus: Status;
  statuses: Record<string, Status>;
};

const weekdayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function AvailabilityCalendar({ data }: { data: AvailabilityData }) {
  const [month, setMonth] = useState(() => new Date(2026, 9, 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const monthStart = new Date(year, monthIndex, 1);
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  const startingOffset = (monthStart.getDay() + 6) % 7;
  const cellCount = Math.ceil((startingOffset + dayCount) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - startingOffset + 1;
    if (day < 1 || day > dayCount) return null;
    return day;
  });
  const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const selectedStatus = selectedDate
    ? data.statuses[selectedDate] ?? data.defaultStatus
    : null;

  function shiftMonth(amount: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
    setSelectedDate(null);
  }

  return (
    <div className="availability-layout">
      <section className="calendar-card" aria-label="Availability calendar">
        <div className="calendar-header">
          <div>
            <span className="eyebrow">The calendar</span>
            <h2>{monthLabel}</h2>
          </div>
          <div className="calendar-controls">
            <button aria-label="Previous month" onClick={() => shiftMonth(-1)} type="button">←</button>
            <button aria-label="Next month" onClick={() => shiftMonth(1)} type="button">→</button>
          </div>
        </div>
        <div className="calendar-grid">
          {weekdayNames.map((day) => <div className="weekday" key={day}>{day}</div>)}
          {cells.map((day, index) => {
            if (!day) return <span aria-hidden="true" className="calendar-blank" key={`blank-${index}`} />;
            const dateKey = `${monthKey}-${String(day).padStart(2, "0")}`;
            const status = data.statuses[dateKey] ?? data.defaultStatus;
            return (
              <button
                aria-label={`${monthLabel.split(" ")[0]} ${day}: ${status}`}
                aria-pressed={selectedDate === dateKey}
                className={`calendar-day status-${status}${selectedDate === dateKey ? " day-selected" : ""}`}
                key={dateKey}
                onClick={() => setSelectedDate(dateKey)}
                type="button"
              >
                <span>{day}</span><i aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <div className="calendar-legend">
          <span><i className="legend-open" /> Open</span>
          <span><i className="legend-held" /> Held</span>
          <span><i className="legend-booked" /> Booked</span>
        </div>
        {selectedDate ? (
          <p aria-live="polite" className="date-detail">
            {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US", {
              weekday: "long", month: "long", day: "numeric",
            })} is <strong>{selectedStatus}</strong>. Contact us to confirm your date.
          </p>
        ) : (
          <p className="calendar-hint">Select a date to see its current status.</p>
        )}
      </section>
      <aside className="calendar-aside">
        <span className="eyebrow">A date in mind?</span>
        <h2>Start with what matters most.</h2>
        <p>
          Choose a day, then tell us what you have in mind. We’ll help you find
          the right room and shape the details around it.
        </p>
        <div className="calendar-note">
          <span className="status-dot status-open" />Open dates are a starting point. Availability is confirmed by the venue team.
        </div>
        {data.sample ? <p className="content-note">Sample calendar data · edit data/availability.json to update dates.</p> : null}
        <Link className="text-link" href="/plan-your-event">Tell us about your date <span aria-hidden="true">↗</span></Link>
      </aside>
    </div>
  );
}

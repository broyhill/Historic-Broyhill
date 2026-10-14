"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PhotoPlaceholder } from "@/components/photo-placeholder";

type Room = {
  id: string;
  name: string;
  kind: string;
  squareFeet: number;
  capacity: number;
  setups: string[];
  historyNote: string;
  accent: string;
};

export function SpaceBrowser({ rooms }: { rooms: Room[] }) {
  const [capacity, setCapacity] = useState("0");
  const [maxArea, setMaxArea] = useState("any");
  const [setup, setSetup] = useState("any");
  const [selected, setSelected] = useState<string[]>([]);
  const setups = [...new Set(rooms.flatMap((room) => room.setups))].sort();
  const filtered = useMemo(
    () =>
      rooms.filter(
        (room) =>
          room.capacity >= Number(capacity) &&
          (maxArea === "any" || room.squareFeet <= Number(maxArea)) &&
          (setup === "any" || room.setups.includes(setup)),
      ),
    [capacity, maxArea, rooms, setup],
  );

  function toggleRoom(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((roomId) => roomId !== id) : [...current, id],
    );
  }

  return (
    <div className="space-browser">
      <div className="filter-panel" aria-label="Filter event spaces">
        <label>
          Guest capacity
          <select value={capacity} onChange={(event) => setCapacity(event.target.value)}>
            <option value="0">Any capacity</option>
            <option value="20">20+ guests</option>
            <option value="50">50+ guests</option>
            <option value="100">100+ guests</option>
            <option value="200">200+ guests</option>
          </select>
        </label>
        <label>
          Room size
          <select value={maxArea} onChange={(event) => setMaxArea(event.target.value)}>
            <option value="any">Any square footage</option>
            <option value="1000">Up to 1,000 sq ft</option>
            <option value="2000">Up to 2,000 sq ft</option>
            <option value="3500">Up to 3,500 sq ft</option>
            <option value="5000">Up to 5,000 sq ft</option>
          </select>
        </label>
        <label>
          Preferred setup
          <select value={setup} onChange={(event) => setSetup(event.target.value)}>
            <option value="any">Any setup</option>
            {setups.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <button
          className="filter-reset"
          onClick={() => {
            setCapacity("0");
            setMaxArea("any");
            setSetup("any");
          }}
          type="button"
        >
          Reset filters
        </button>
      </div>

      {filtered.length ? (
        <div className="space-grid">
          {filtered.map((room, index) => (
            <article className="space-card" key={room.id}>
              <PhotoPlaceholder
                className={`space-photo photo-${room.accent}`}
                label={`TODO-PHOTO · ${room.name}`}
              />
              <div className="space-card-content">
                <div className="space-kicker"><span>{room.kind}</span><span>{String(index + 1).padStart(2, "0")}</span></div>
                <h2>{room.name}</h2>
                <div className="space-facts">
                  <span>Up to {room.capacity} guests</span>
                  <span>{room.squareFeet.toLocaleString()} sq ft</span>
                </div>
                <div className="setup-list">{room.setups.map((name) => <span key={name}>{name}</span>)}</div>
                <div className="history-note"><span>Room story · sample</span><p>{room.historyNote}</p></div>
                <button
                  aria-pressed={selected.includes(room.id)}
                  className={`select-room ${selected.includes(room.id) ? "is-selected" : ""}`}
                  onClick={() => toggleRoom(room.id)}
                  type="button"
                >
                  {selected.includes(room.id) ? "Added to your request" : "Add to your request"}
                  <span aria-hidden="true">{selected.includes(room.id) ? "✓" : "+"}</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">No rooms match those filters. Try widening your search.</p>
      )}

      {selected.length > 0 ? (
        <div className="selection-bar">
          <span>{selected.length} {selected.length === 1 ? "space" : "spaces"} selected</span>
          <Link href={`/plan-your-event?spaces=${encodeURIComponent(selected.join(","))}`}>
            Continue to your event request <span aria-hidden="true">↗</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

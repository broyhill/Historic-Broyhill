"use client";

import { useState } from "react";
import { SPACES, formatDateKey } from "@/lib/spaces";

// Self-serve "request this date" form. It records a request — staff still confirm
// every date; nothing here reserves a room.
export default function ExpressBookForm({ initialSpace, initialDate }: { initialSpace?: string; initialDate?: string }) {
  const [spaceId, setSpaceId] = useState(initialSpace ?? SPACES[0].id);
  const [date, setDate] = useState(initialDate ?? "");
  const [guests, setGuests] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const input = "w-full rounded-md border border-[#d8ccb4] bg-white px-3 py-2.5 text-[15px] text-[#273440] focus:outline-none focus:border-[#c2a15a] focus:ring-2 focus:ring-[#c2a15a]/30";
  const label = "block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5a6672] mb-1.5";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/express-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceId,
          date,
          guests: guests ? Number(guests) : null,
          name,
          email,
          phone: phone || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Something went wrong — please try again.");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setError("Could not reach the site — please try again.");
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="rounded-lg border border-[#c9bd9e] bg-[#f4ecda] p-6 text-center">
        <p className="hb-display text-2xl text-[#182c3e]">Request received.</p>
        <p className="mt-3 text-[15px] leading-relaxed text-[#5a6672]">
          The venue team confirms every date personally — you will hear from us before anything is held.
          Questions in the meantime: <a href="tel:+13367931191" className="text-[#182c3e] underline">336-793-1191</a>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="eb-space" className={label}>Space</label>
          <select id="eb-space" value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className={input}>
            {SPACES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="eb-date" className={label}>Date</label>
          <input id="eb-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={input} min={new Date().toISOString().slice(0, 10)} />
          {date && <p className="mt-1 text-[12px] text-[#5a6672]">{formatDateKey(date)}</p>}
        </div>
        <div>
          <label htmlFor="eb-guests" className={label}>Guests (estimate)</label>
          <input id="eb-guests" type="number" min={1} inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value)} className={input} placeholder="e.g. 60" />
        </div>
        <div>
          <label htmlFor="eb-name" className={label}>Your name</label>
          <input id="eb-name" required value={name} onChange={(e) => setName(e.target.value)} className={input} autoComplete="name" />
        </div>
        <div>
          <label htmlFor="eb-email" className={label}>Email</label>
          <input id="eb-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} autoComplete="email" />
        </div>
        <div>
          <label htmlFor="eb-phone" className={label}>Phone (optional)</label>
          <input id="eb-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} autoComplete="tel" />
        </div>
      </div>
      <div>
        <label htmlFor="eb-notes" className={label}>Anything we should know? (optional)</label>
        <textarea id="eb-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
      </div>
      {state === "error" && <p className="text-[13px] text-[#9a3a2d]" role="alert">{error}</p>}
      <button
        type="submit"
        disabled={state === "sending"}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-[#182c3e] px-6 text-sm font-semibold uppercase tracking-[0.1em] text-[#f4ecda] transition hover:bg-[#223a52] disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Request this date"}
      </button>
      <p className="text-[12px] leading-relaxed text-[#5a6672]">A request, not a reservation — the team confirms every date before anything is held.</p>
    </form>
  );
}

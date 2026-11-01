"use client";

import React, { useState } from "react";

const INTERESTS = [
  "The Magnolia Room",
  "The Loft",
  "The Dock",
  "The Boardrooms",
  "Executive office suite",
  "Virtual Office Program",
  "The HB Podcast Studio",
  "Something else",
];

/** Who we host. Grouped so the list reads quickly on a phone. */
export const EVENT_TYPES: { group: string; items: string[] }[] = [
  { group: "Business", items: ["Corporate meeting or retreat", "Conference or training", "Chamber of Commerce or civic group", "Office suite or Virtual Office tour", "Podcast or recording session"] },
  { group: "Community", items: ["Nonprofit fundraiser or gala", "Church or religious gathering", "Holiday party", "Community or cultural event"] },
  { group: "Celebrations", items: ["Wedding or reception", "Quinceañera", "Birthday or anniversary party", "Baby shower or baptism celebration", "Memorial or celebration of life"] },
  { group: "Other", items: ["Something else"] },
];
const ALL_EVENT_TYPES = EVENT_TYPES.flatMap((g) => g.items);

const GROUP_SIZES = ["Under 20", "20–50", "50–100", "100–140", "More than 140 / not sure"];
const BUDGETS = ["Prefer not to say", "Under $1,000", "$1,000–$2,500", "$2,500–$5,000", "$5,000–$10,000", "Over $10,000"];
const NEEDS = ["Catering", "Audio-visual or hybrid meeting setup", "Overnight stay for guests", "Podcast studio time", "Outdoor space"];
const HEARD = ["", "Google search", "Instagram or Facebook", "Drove by the building", "Referred by a friend or planner", "Chamber of Commerce", "Previous guest", "Other"];

type Props = {
  /** Space names chosen on /event-spaces; pre-fills the interest and is sent with the request. */
  initialSpaces?: string[];
  /** YYYY-MM-DD chosen on /availability. */
  initialDate?: string;
  /** Event type chosen elsewhere (e.g. the Spanish landing page). */
  initialEventType?: string;
  /** Submit-button text. */
  ctaLabel?: string;
};

export default function InquiryForm({ initialSpaces = [], initialDate = "", initialEventType, ctaLabel = "Request a proposal" }: Props) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    interest: INTERESTS.find((i) => initialSpaces.includes(i)) ?? INTERESTS[0],
    eventType: ALL_EVENT_TYPES.includes(initialEventType ?? "") ? (initialEventType as string) : "",
    groupSize: "",
    eventDate: initialDate,
    flexibleDates: false,
    budget: BUDGETS[0],
    heard: "",
    message: "",
    emailOptIn: false,
    smsOptIn: false,
  });
  const [spaces, setSpaces] = useState<string[]>(initialSpaces);
  const [needs, setNeeds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleNeed = (n: string) => setNeeds((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const tags = [
        "Website RFP",
        form.interest,
        ...spaces.filter((s) => s !== form.interest),
        form.eventType,
        form.groupSize ? `Group: ${form.groupSize}` : "",
        form.flexibleDates ? "Flexible dates" : "",
        ...needs.map((n) => `Needs: ${n}`),
        form.emailOptIn ? "Email opt-in" : "",
        form.smsOptIn ? "SMS opt-in" : "",
      ].filter(Boolean);
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          company: form.company || "Website Inquiry",
          notes: [
            form.eventType ? `Event type: ${form.eventType}.` : "",
            `Interest: ${form.interest}.`,
            spaces.length ? `Spaces: ${spaces.join(", ")}.` : "",
            form.groupSize ? `Group size: ${form.groupSize}.` : "",
            form.eventDate ? `Preferred date: ${form.eventDate}${form.flexibleDates ? " (flexible)" : ""}.` : form.flexibleDates ? "Dates are flexible." : "",
            needs.length ? `Needs: ${needs.join(", ")}.` : "",
            form.budget !== BUDGETS[0] ? `Budget: ${form.budget}.` : "",
            form.heard ? `Heard about us: ${form.heard}.` : "",
            `Consent: email ${form.emailOptIn ? "yes" : "no"}, text ${form.smsOptIn ? "yes" : "no"}.`,
            `Message: ${form.message || "None provided"}`,
          ].filter(Boolean).join(" "),
          tags,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Something went wrong. Please call us at 336-793-1191.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const field = "w-full min-h-[44px] rounded-lg border border-[#d8cdb8] bg-white/70 px-3.5 py-2.5 text-[15px] text-[#1b2a36] placeholder:text-[#9a8f78] focus:outline-none focus:border-[#c2a15a] focus:ring-2 focus:ring-[#c2a15a]/30";
  const label = "block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7a6f58] mb-1.5";
  const check = "flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-[#d8cdb8] bg-white/50 px-3.5 text-[15px] text-[#1b2a36] has-[:checked]:border-[#c2a15a] has-[:checked]:bg-[#c2a15a]/10";
  const box = "h-5 w-5 shrink-0 accent-[#182c3e]";

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[#d8cdb8] bg-[#fbf7ef] p-8 text-center">
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#1f4d2e]/10 text-[#1f4d2e] text-xl">✓</div>
        <h3 className="hb-display text-xl text-[#182c3e]">Thank you, {form.name.split(" ")[0] || "friend"}.</h3>
        <p className="mt-2 text-[15px] text-[#4b5a63]">
          We have your request{form.eventType ? ` for a ${form.eventType.toLowerCase()}` : ""}
          {form.eventDate ? ` on ${form.eventDate}` : ""}. Our team will reply by email, usually within a business day. For anything urgent, call{" "}
          <a href="tel:+13367931191" className="font-medium text-[#8f1f1f] underline">336-793-1191</a>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div role="alert" className="rounded-lg border border-[#8f1f1f]/30 bg-[#8f1f1f]/5 px-3 py-2.5 text-sm text-[#8f1f1f]">{error}</div>
      )}

      <fieldset className="space-y-4">
        <legend className="hb-display text-lg text-[#182c3e]">Your event</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="iq-type" className={label}>What are you planning? *</label>
            <select id="iq-type" required value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })} className={field}>
              <option value="">Choose one…</option>
              {EVENT_TYPES.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((i) => <option key={i}>{i}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="iq-size" className={label}>How many guests?</label>
            <select id="iq-size" value={form.groupSize} onChange={(e) => setForm({ ...form, groupSize: e.target.value })} className={field}>
              <option value="">Not sure yet</option>
              {GROUP_SIZES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="iq-date" className={label}>Preferred date</label>
            <input id="iq-date" type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} className={field} />
          </div>
          <div className="sm:pt-6">
            <label className={check}>
              <input type="checkbox" className={box} checked={form.flexibleDates} onChange={(e) => setForm({ ...form, flexibleDates: e.target.checked })} />
              My dates are flexible
            </label>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="iq-interest" className={label}>Space I'm most interested in</label>
            <select id="iq-interest" value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} className={field}>
              {INTERESTS.map((i) => <option key={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="iq-budget" className={label}>Budget range (optional)</label>
            <select id="iq-budget" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className={field}>
              {BUDGETS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
        </div>
        {spaces.length ? (
          <div>
            <p className={label}>Spaces you picked</p>
            <ul className="flex flex-wrap gap-2" aria-label="Spaces you picked">
              {spaces.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    aria-label={`Remove ${s}`}
                    onClick={() => setSpaces((cur) => cur.filter((x) => x !== s))}
                    className="min-h-[44px] rounded-full border border-[#182c3e]/25 bg-white/70 px-4 text-sm text-[#182c3e] hover:border-[#182c3e]/50"
                  >
                    {s} <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div>
          <p className={label}>Would you like help with…</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {NEEDS.map((n) => (
              <label key={n} className={check}>
                <input type="checkbox" className={box} checked={needs.includes(n)} onChange={() => toggleNeed(n)} />
                {n}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t border-[#e4dac6] pt-4">
        <legend className="hb-display text-lg text-[#182c3e] pt-4">About you</legend>
        <div>
          <label htmlFor="iq-name" className={label}>Name *</label>
          <input id="iq-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} placeholder="Jane Caldwell" autoComplete="name" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="iq-email" className={label}>Email *</label>
            <input id="iq-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} placeholder="jane@email.com" autoComplete="email" />
          </div>
          <div>
            <label htmlFor="iq-phone" className={label}>Phone</label>
            <input id="iq-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} placeholder="(336) 555-0100" autoComplete="tel" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="iq-company" className={label}>Company / Organization</label>
            <input id="iq-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={field} placeholder="Optional" autoComplete="organization" />
          </div>
          <div>
            <label htmlFor="iq-heard" className={label}>How did you hear about us?</label>
            <select id="iq-heard" value={form.heard} onChange={(e) => setForm({ ...form, heard: e.target.value })} className={field}>
              {HEARD.map((h) => <option key={h || "none"} value={h}>{h || "Choose one (optional)"}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="iq-message" className={label}>Anything else we should know?</label>
          <textarea id="iq-message" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={field} placeholder="A fall reception for about 80 guests, ceremony on The Dock if weather allows…" />
        </div>
        <div className="grid gap-2">
          <label className={check}>
            <input type="checkbox" className={box} checked={form.emailOptIn} onChange={(e) => setForm({ ...form, emailOptIn: e.target.checked })} />
            Email me seasonal openings and holiday dates (a few times a year, unsubscribe anytime)
          </label>
          <label className={check}>
            <input type="checkbox" className={box} checked={form.smsOptIn} onChange={(e) => setForm({ ...form, smsOptIn: e.target.checked })} />
            It's okay to text me about this request
          </label>
        </div>
      </fieldset>

      <button type="submit" disabled={loading} className="w-full min-h-[48px] rounded-lg bg-[#182c3e] px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#f4ecda] transition hover:bg-[#223b52] disabled:opacity-60">
        {loading ? "Sending…" : ctaLabel}
      </button>
      <p className="text-center text-xs text-[#7a6f58]">We'll reply by email, usually within a business day. Nothing is reserved until you hear from us.</p>
    </form>
  );
}

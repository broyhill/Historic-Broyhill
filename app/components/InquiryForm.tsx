"use client";

import React, { useState } from "react";

const INTERESTS = [
  "Magnolia Room",
  "The Boardrooms",
  "The Dock",
  "The Loft",
  "Executive office suite",
  "Virtual Office Program",
  "The HB Podcast Studio",
  "Something else",
];

export default function InquiryForm() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", interest: INTERESTS[0], message: "" });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          company: form.company || "Website Inquiry",
          notes: `Interest: ${form.interest}. Message: ${form.message || "None provided"}`,
          tags: ["Website Inquiry", form.interest],
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

  const field = "w-full min-h-[44px] rounded-lg border border-[#d8cdb8] bg-white/70 px-3.5 py-2.5 text-[15px] text-[#1b2a36] placeholder:text-[#9a8f78] focus:outline-none focus:border-[#b0894f] focus:ring-2 focus:ring-[#b0894f]/30";
  const label = "block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7a6f58] mb-1.5";

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[#d8cdb8] bg-[#fbf7ef] p-8 text-center">
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#1f4d2e]/10 text-[#1f4d2e] text-xl">✓</div>
        <h3 className="font-serif text-xl text-[#13303f]">Thank you, {form.name.split(" ")[0] || "friend"}.</h3>
        <p className="mt-2 text-[15px] text-[#4b5a63]">
          Our team will be in touch shortly about {form.interest.toLowerCase()}. For anything urgent, call{" "}
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
      <div>
        <label htmlFor="iq-name" className={label}>Name *</label>
        <input id="iq-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} placeholder="Jane Caldwell" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="iq-email" className={label}>Email *</label>
          <input id="iq-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} placeholder="jane@email.com" />
        </div>
        <div>
          <label htmlFor="iq-phone" className={label}>Phone</label>
          <input id="iq-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={field} placeholder="(336) 555-0100" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="iq-company" className={label}>Company / Organization</label>
          <input id="iq-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={field} placeholder="Optional" />
        </div>
        <div>
          <label htmlFor="iq-interest" className={label}>I'm interested in</label>
          <select id="iq-interest" value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} className={field}>
            {INTERESTS.map((i) => <option key={i}>{i}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="iq-message" className={label}>Tell us about your plans</label>
        <textarea id="iq-message" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={field} placeholder="A fall reception for about 80 guests…" />
      </div>
      <button type="submit" disabled={loading} className="w-full min-h-[48px] rounded-lg bg-[#13303f] px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#f7f1e4] transition hover:bg-[#1b4256] disabled:opacity-60 active:scale-[0.99] motion-reduce:active:scale-100">
        {loading ? "Sending…" : "Request a tour"}
      </button>
      <p className="text-center text-xs text-[#7a6f58]">We'll reply by email, usually within a business day.</p>
    </form>
  );
}

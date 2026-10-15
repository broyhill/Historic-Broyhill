"use client";
import React, { useState } from "react";
export default function CapturePage() {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", company: "", phone: "", interest: "Grand Ballroom Gala & Reception", notes: "" });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setError(null);
    try {
      const res = await fetch("/api/capture", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.firstName, last_name: form.lastName, email: form.email, company: form.company || "Private Inquiry",
          phone: form.phone || null, notes: "Interest: " + form.interest + ". Vision: " + (form.notes || "None provided"),
          tags: ["In-Person NFC Tap", form.interest.includes("Gala") ? "High Net Worth" : "VIP"]
        })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to submit"); }
      setSubmitted(true);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-neutral-900/80 border border-neutral-800 rounded-2xl p-8 shadow-2xl backdrop-blur">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-serif text-neutral-100">Historic Broyhill</h1>
          <p className="text-xs uppercase tracking-widest text-amber-400 font-mono mt-1">Executive Guest Registry</p>
        </div>
        {submitted ? (
          <div className="text-center py-6 space-y-4">
            <h2 className="text-lg font-medium text-emerald-400">Inquiry Received</h2>
            <p className="text-sm text-neutral-400">Thank you, {form.firstName}. Our executive team will review your requirements.</p>
            <button onClick={() => setSubmitted(false)} className="text-xs font-mono uppercase text-amber-400 hover:underline">Register Another →</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && <div className="p-3 bg-red-950/40 border border-red-800 text-red-300 text-xs rounded-lg font-mono">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-mono uppercase text-neutral-400 mb-1">First Name *</label>
                <input required value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100" placeholder="James" />
              </div>
              <div><label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Last Name *</label>
                <input required value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100" placeholder="Madison" />
              </div>
            </div>
            <div><label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Email *</label>
              <input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100" placeholder="madison@estate.org" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Company</label>
                <input value={form.company} onChange={e => setForm({...form, company: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100" placeholder="Montpelier Foundation" />
              </div>
              <div><label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Phone</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100" placeholder="+1 555-019-2834" />
              </div>
            </div>
            <div><label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Interest</label>
              <select value={form.interest} onChange={e => setForm({...form, interest: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100">
                <option>Grand Ballroom Gala & Reception</option>
                <option>Executive Board Retreat & Hospitality</option>
                <option>Historic Grounds Private Tour</option>
              </select>
            </div>
            <div><label className="block text-xs font-mono uppercase text-neutral-400 mb-1">Notes / Vision</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-100" placeholder="Targeting late fall for 40 trustees..." />
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-medium text-sm rounded-lg transition">
              {loading ? "Processing..." : "Submit Registry Entry"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
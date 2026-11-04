"use client";

import React, { useCallback, useEffect, useState } from "react";

type Entry = {
  id: string;
  folder: string;
  title: string;
  data: Record<string, unknown>;
  note?: string | null;
  enabled: boolean;
};

const FOLDERS: { key: string; label: string; hint: string; fields: { key: string; label: string }[] }[] = [
  {
    key: "competitors",
    label: "Competitors",
    hint: "Venues the watcher tracks — their ads, offers and inventory.",
    fields: [
      { key: "name", label: "Venue / brand" },
      { key: "metaPage", label: "Meta page (optional)" },
      { key: "site", label: "Website (optional)" },
    ],
  },
  {
    key: "benchmarks",
    label: "Market benchmarks",
    hint: "Niche numbers the weekly card scores you against (occupancy, inquiry rates, seasonal demand).",
    fields: [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Value" },
      { key: "source", label: "Source (optional)" },
    ],
  },
  {
    key: "ad-snapshots",
    label: "Ad snapshots",
    hint: "Competitor ads worth remembering — creative notes, offer, how long it ran.",
    fields: [
      { key: "competitor", label: "Competitor" },
      { key: "offer", label: "Offer / hook" },
      { key: "duration", label: "Run duration (optional)" },
    ],
  },
  {
    key: "microsegments",
    label: "Prospect microsegments",
    hint: "Audiences the CMO plans and writes for.",
    fields: [
      { key: "name", label: "Segment" },
      { key: "who", label: "Who they are" },
      { key: "angle", label: "Message angle (optional)" },
    ],
  },
  {
    key: "venue-facts",
    label: "Venue facts",
    hint: "Verified facts the brain may state — capacities, prices, policies. Unverified claims never leave this folder.",
    fields: [
      { key: "fact", label: "Fact" },
      { key: "value", label: "Value" },
    ],
  },
  {
    key: "brand-memory",
    label: "Brand memory",
    hint: "Lasting facts and rules the brain applies to every generation (positioning, do/don't claims).",
    fields: [{ key: "fact", label: "Memory / rule" }],
  },
];

export default function LibraryPanel() {
  const [folder, setFolder] = useState(FOLDERS[0].key);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (f: string) => {
    const r = await fetch(`/api/admin/library?folder=${encodeURIComponent(f)}`);
    if (r.ok) setEntries((await r.json()).entries ?? []);
  }, []);

  useEffect(() => {
    setForm({});
    load(folder).catch(() => {});
  }, [folder, load]);

  const active = FOLDERS.find((f) => f.key === folder)!;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const filled = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim()));
    if (!filled[active.fields[0].key]) return;
    setSaving(true);
    await fetch("/api/admin/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        folder,
        title: filled[active.fields[0].key],
        data: filled,
      }),
    });
    setSaving(false);
    setForm({});
    load(folder).catch(() => {});
  }

  async function toggle(entry: Entry) {
    await fetch(`/api/admin/library/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !entry.enabled }),
    });
    load(folder).catch(() => {});
  }

  async function remove(id: string) {
    await fetch(`/api/admin/library/${id}`, { method: "DELETE" });
    load(folder).catch(() => {});
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="ibox p-5">
        <h3 className="hb-display text-[22px] text-ink">Marketing library</h3>
        <p className="text-[14px] text-muted mt-1 leading-relaxed">
          What the brain works from — every plan, draft and answer is composed against these folders.
          Edit them any time; the brain reads the current state.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FOLDERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFolder(f.key)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${
              folder === f.key ? "bg-accent text-white" : "border border-line text-ink hover:bg-slate-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="ibox p-5">
        <p className="text-[13px] text-muted leading-relaxed">{active.hint}</p>

        <form onSubmit={add} className="mt-4 grid gap-2 sm:grid-cols-3">
          {active.fields.map((field) => (
            <input
              key={field.key}
              value={form[field.key] ?? ""}
              onChange={(e) => setForm((s) => ({ ...s, [field.key]: e.target.value }))}
              placeholder={field.label}
              className="rounded-lg border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-accent"
            />
          ))}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:brightness-110 disabled:opacity-50 sm:col-span-1"
          >
            Add to {active.label}
          </button>
        </form>

        <ul className="mt-5 divide-y divide-line">
          {entries.length === 0 && (
            <li className="py-6 text-center text-[13px] text-muted">Nothing in this folder yet.</li>
          )}
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className={`text-[14px] font-semibold ${entry.enabled ? "text-ink" : "text-muted line-through"}`}>
                  {entry.title}
                </p>
                <p className="text-[13px] text-muted mt-0.5 truncate">
                  {Object.entries(entry.data)
                    .filter(([k]) => k !== active.fields[0].key)
                    .map(([, v]) => String(v))
                    .join(" · ")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggle(entry)}
                  className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-ink hover:bg-slate-50"
                >
                  {entry.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(entry.id)}
                  className="rounded-full border border-line px-3 py-1.5 text-[12px] font-semibold text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

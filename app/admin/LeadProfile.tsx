"use client";
import { useCallback, useEffect, useState } from "react";

// One lead's profile — opened by clicking a row in the Leads table.
// Header: photo placeholder + identity. Left column: contact info, socials,
// microsegment, tags, and enrichment modules (LinkedIn bio, work history,
// relationships, awards, affinities, client history) — every module is
// editable inline; saves merge into lead.customFields via PATCH.
// Right column: newsfeed timeline of every marketing touch and the lead's
// response (sent, RSVP, contract, unopened, call-back, etc.).

interface TimelineRow { at: string; kind: "activity" | "journey" | "send"; label: string; detail: string; }
interface ProfileData { lead: any; timeline: TimelineRow[]; }

const KIND_CHIP: Record<string, string> = {
  send: "bg-navy text-white",
  journey: "bg-info/15 text-info",
  activity: "bg-line text-muted",
};

const RESPONSE_LABELS: [RegExp, string][] = [
  [/rsvp/i, "RSVP"],
  [/contract/i, "Contract"],
  [/unopened|not.?opened/i, "Unopened"],
  [/call.?back|recalled/i, "Called back"],
  [/sent|published/i, "Campaign sent"],
];

function responseLabel(t: TimelineRow): string {
  const hay = `${t.label} ${t.detail}`;
  for (const [re, label] of RESPONSE_LABELS) if (re.test(hay)) return label;
  return t.label;
}

const inputCls = "w-full text-[13px] px-2 py-1.5 border border-line rounded bg-white text-ink";

// One module with an Edit toggle. Lists edit one value per line; strings edit
// a textarea. Save merges {key: value} into customFields (empty = deletes).
function EditableModule({ title, empty, listKey, value, isList, render, saving, onSave }: {
  title: string; empty: string; listKey: string;
  value: unknown; isList: boolean;
  render: () => React.ReactNode;
  saving: boolean;
  onSave: (key: string, value: unknown) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const has = isList ? Array.isArray(value) && value.length > 0 : Boolean(value);

  const start = () => {
    setText(isList ? (Array.isArray(value) ? value.map((v: any) => typeof v === "string" ? v : JSON.stringify(v)).join("\n") : "")
                  : String(value ?? ""));
    setEditing(true);
  };
  const save = async () => {
    const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
    await onSave(listKey, isList ? (lines.length ? lines : null) : (text.trim() || null));
    setEditing(false);
  };

  return (
    <section className="ibox"><div className="ibox-content">
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="text-[12px] font-semibold text-muted uppercase tracking-wide">{title}</h4>
        {!editing && <button onClick={start} disabled={saving} className="text-[11px] text-info hover:underline disabled:opacity-60">Edit</button>}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={isList ? 4 : 3}
            className={inputCls} placeholder={isList ? "One per line" : ""} aria-label={`Edit ${title}`} />
          {isList && <p className="text-[11px] text-subtle">One value per line.</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-3 py-1.5 bg-accent text-white rounded text-[12px] font-semibold disabled:opacity-60">Save</button>
            <button onClick={() => setEditing(false)} disabled={saving} className="px-3 py-1.5 border border-line rounded text-[12px] text-muted">Cancel</button>
          </div>
        </div>
      ) : has ? render() : <p className="text-[12.5px] text-subtle italic">{empty}</p>}
    </div></section>
  );
}

export default function LeadProfile({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/leads/profile?id=${leadId}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not load the profile.");
      setData(d);
    } catch (e: any) { setError(e.message); }
  }, [leadId]);
  useEffect(() => { load(); }, [load]);

  const saveField = useCallback(async (key: string, value: unknown) => {
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/admin/leads/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, customFields: { [key]: value } }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed.");
      await load();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  }, [leadId, load]);

  const l = data?.lead;
  const cf = (l?.customFields && typeof l.customFields === "object" && !Array.isArray(l.customFields) ? l.customFields : {}) as Record<string, any>;
  const initials = [l?.firstName, l?.lastName].filter(Boolean).map((s: string) => s[0]).join("").toUpperCase()
    || (l?.name ? l.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() : "?");

  const socials: { label: string; url: string }[] = [
    l?.linkedinId ? { label: "LinkedIn", url: /^https?:/.test(l.linkedinId) ? l.linkedinId : `https://www.linkedin.com/in/${l.linkedinId}` } : null,
    cf.facebookUrl ? { label: "Facebook", url: cf.facebookUrl } : null,
    cf.instagramUrl ? { label: "Instagram", url: cf.instagramUrl } : null,
    cf.twitterUrl ? { label: "X / Twitter", url: cf.twitterUrl } : null,
    cf.websiteUrl ? { label: "Website", url: cf.websiteUrl } : null,
  ].filter(Boolean) as { label: string; url: string }[];

  const chips = (items: string[]) => (
    <div className="flex flex-wrap gap-1.5">{items.map((a, i) => <span key={i} className="px-2 py-0.5 rounded-full border border-line text-[11.5px] text-muted">{a}</span>)}</div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 p-4 md:p-8" role="dialog" aria-modal="true" aria-label="Lead profile" onClick={onClose}>
      <div className="w-full max-w-5xl bg-canvas border border-line rounded-lg shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-4 p-5 bg-white border-b border-line sticky top-0 z-10">
          <div className="h-20 w-20 rounded-full bg-navy text-cream flex items-center justify-center text-2xl font-serif shrink-0" aria-label="Photo placeholder">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-ink font-serif">
              {l ? ([l.salutation, l.firstName, l.middleName, l.lastName].filter(Boolean).join(" ") || l.name || l.email) : "Loading…"}
            </h2>
            <p className="text-[13px] text-muted">
              {[l?.company, [l?.city, l?.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
            </p>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {l?.leadStatus && <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium tracking-wider bg-line text-muted">{l.leadStatus}</span>}
              {l?.primaryTrack && <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium tracking-wider bg-accent/15 text-accent">{l.primaryTrack}</span>}
              {l != null && <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium tracking-wider bg-navy/10 text-navy">Score {l.leadScore}</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl leading-none px-2" aria-label="Close profile">✕</button>
        </div>

        {error && <p className="p-5 text-[13px] text-red-600" role="alert">{error}</p>}
        {!data && !error && <p className="p-5 text-[13px] text-subtle">Loading profile…</p>}

        {l && (
          <div className="grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 p-5">
            <div className="space-y-4">
              <section className="ibox"><div className="ibox-content">
                <h4 className="text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Contact</h4>
                <ul className="text-[13px] space-y-1">
                  <li><a href={`mailto:${l.email}`} className="text-info hover:underline">{l.email}</a></li>
                  {l.phone && <li><a href={`tel:${l.phone}`} className="text-ink">{l.phone}</a></li>
                  {l.companyLinkedin && <li><a href={l.companyLinkedin} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">Company LinkedIn ↗</a></li>}
                  {l.leadSource && <li className="text-subtle">Source: {l.leadSource}</li>}
                  {l.estimatedValue != null && <li className="text-subtle">Est. value ${l.estimatedValue.toLocaleString()}</li>}
                </ul>
              </div></section>

              <EditableModule title="Microsegment" empty="No microsegment assigned yet." listKey="microsegment"
                value={cf.microsegment} isList saving={saving} onSave={saveField}
                render={() => chips(cf.microsegment)} />

              <EditableModule title="Tags" empty="No tags assigned." listKey="tags"
                value={cf.tags} isList saving={saving} onSave={saveField}
                render={() => chips(cf.tags)} />

              <section className="ibox"><div className="ibox-content">
                <h4 className="text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Social media</h4>
                {socials.length ? (
                  <ul className="text-[13px] space-y-1">{socials.map((s) => <li key={s.label}><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-info hover:underline">{s.label} ↗</a></li>)}</ul>
                ) : <p className="text-[12.5px] text-subtle italic">No social profiles linked yet — enrichment will fill these.</p>}
              </div></section>

              <EditableModule title="LinkedIn bio" empty="Not enriched yet — run Find people / enrichment to pull the bio."
                listKey="linkedinBio" value={cf.linkedinBio} isList={false} saving={saving} onSave={saveField}
                render={() => <p className="text-[13px] text-ink whitespace-pre-line">{cf.linkedinBio}</p>} />

              <EditableModule title="Work history" empty="No work history on file yet. One role per line: Title — Company (years)."
                listKey="workHistory" value={cf.workHistory} isList saving={saving} onSave={saveField}
                render={() => <ul className="text-[13px] space-y-1">{cf.workHistory.map((w: any, i: number) => <li key={i} className="text-ink">{typeof w === "string" ? w : [w.title, w.company].filter(Boolean).join(" — ")}{w.years ? ` (${w.years})` : ""}</li>)}</ul>} />

              <EditableModule title="Network relationships" empty="No known relationships mapped yet. One per line: Name — relationship."
                listKey="relationships" value={cf.relationships} isList saving={saving} onSave={saveField}
                render={() => <ul className="text-[13px] space-y-1">{cf.relationships.map((r: any, i: number) => <li key={i} className="text-ink">{typeof r === "string" ? r : [r.name, r.relation].filter(Boolean).join(" — ")}</li>)}</ul>} />

              <EditableModule title="Client history with Historic Broyhill" empty="No bookings, events or contracts on file yet. One per line."
                listKey="clientHistory" value={cf.clientHistory} isList saving={saving} onSave={saveField}
                render={() => <ul className="text-[13px] space-y-1">{cf.clientHistory.map((h: any, i: number) => <li key={i} className="text-ink">{typeof h === "string" ? h : [h.date, h.label].filter(Boolean).join(" — ")}</li>)}</ul>} />

              <EditableModule title="Awards & recognitions" empty="No awards recorded yet. One per line."
                listKey="awards" value={cf.awards} isList saving={saving} onSave={saveField}
                render={() => <ul className="text-[13px] space-y-1">{cf.awards.map((a: any, i: number) => <li key={i} className="text-ink">{typeof a === "string" ? a : [a.title, a.year].filter(Boolean).join(" — ")}</li>)}</ul>} />

              <EditableModule title="Affinities — local" empty="No local affinities tagged yet."
                listKey="affinitiesLocal" value={cf.affinitiesLocal} isList saving={saving} onSave={saveField}
                render={() => chips(cf.affinitiesLocal)} />

              <EditableModule title="Affinities — statewide" empty="No statewide affinities tagged yet."
                listKey="affinitiesState" value={cf.affinitiesState} isList saving={saving} onSave={saveField}
                render={() => chips(cf.affinitiesState)} />

              {l.notes && (
                <section className="ibox"><div className="ibox-content">
                  <h4 className="text-[12px] font-semibold text-muted uppercase tracking-wide mb-1.5">Notes</h4>
                  <p className="text-[13px] text-ink whitespace-pre-line">{l.notes}</p>
                </div></section>
              )}
            </div>

            <div>
              <section className="ibox"><div className="ibox-content">
                <h4 className="text-[12px] font-semibold text-muted uppercase tracking-wide mb-3">Marketing timeline</h4>
                {data.timeline.length === 0 ? (
                  <p className="text-[12.5px] text-subtle italic">No campaigns or touches recorded yet — the feed fills in as journeys and sends reach this lead.</p>
                ) : (
                  <ol className="relative border-l border-line ml-1.5 space-y-4">
                    {data.timeline.map((t, i) => (
                      <li key={i} className="ml-4">
                        <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-line border border-line" aria-hidden />
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium tracking-wide ${KIND_CHIP[t.kind]}`}>{responseLabel(t)}</span>
                          <time className="text-[11px] text-subtle">{new Date(t.at).toLocaleString()}</time>
                        </div>
                        <p className="text-[12.5px] text-ink mt-0.5">{t.label}{t.detail ? ` — ${t.detail}` : ""}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div></section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

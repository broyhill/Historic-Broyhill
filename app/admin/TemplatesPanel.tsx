"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { previewChecks, subjectChecks, unresolvedTags } from "@/lib/campaign-rules";
import { mediaChecks, smsChecks, smsInfo } from "@/lib/sms-rules";
import { CAMPAIGN_TEMPLATES, TEXT_TEMPLATES } from "@/lib/campaign-templates";

type Channel = "email" | "sms" | "mms";
interface Saved { id: string; name: string; subject: string; previewText: string; body: string; mediaUrl: string }
interface Draft { id?: string; name: string; subject: string; previewText: string; body: string; mediaUrl: string }

const EMPTY: Draft = { name: "", subject: "", previewText: "", body: "", mediaUrl: "" };
const TABS: { key: Channel; label: string; hint: string }[] = [
  { key: "email", label: "Email", hint: "Subject, preview text and body" },
  { key: "sms", label: "SMS", hint: "Text message, no picture" },
  { key: "mms", label: "MMS", hint: "Text message with a picture" },
];

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  if (res.status === 401) { window.location.assign("/admin/login"); throw new Error("Signed out"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

const inputCls = "w-full rounded-md border border-[#e7e9eb] px-3 py-2 text-[14px] text-[#323a46] focus:outline-none focus:border-[#1ab394]";
const btnPrimary = "h-9 px-4 rounded-md bg-[#1ab394] text-white text-[13px] font-semibold disabled:opacity-50";
const btnGhost = "h-9 px-3 rounded-md border border-[#e7e9eb] text-[#6c757d] text-[13px] hover:border-[#1ab394]/50 disabled:opacity-50";

function Checks({ items }: { items: { ok: boolean; label: string }[] }) {
  return <ul className="text-[12px] space-y-0.5">{items.map((k) => <li key={k.label} className={k.ok ? "text-[#1ab394]" : "text-[#b7791f]"}>{k.ok ? "✓" : "•"} {k.label}</li>)}</ul>;
}

// Template library for email, SMS and MMS. A template is only a starting point: nothing here sends.
// Texting itself is not switched on yet; these are ready for when it is.
export default function TemplatesPanel() {
  const [channel, setChannel] = useState<Channel>("email");
  const [saved, setSaved] = useState<Saved[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [library, setLibrary] = useState<{ url: string; name: string; folder: string }[]>([]);

  const load = useCallback(async (ch: Channel) => {
    try { setSaved((await api(`/api/admin/email-campaigns?templates=1&channel=${ch}`)).templates || []); }
    catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(channel); }, [channel, load]);

  const switchTab = (ch: Channel) => { setChannel(ch); setDraft(EMPTY); setError(null); setNotice(null); };
  const edit = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const blanks = useMemo(() => unresolvedTags(`${draft.subject}\n${draft.previewText}\n${draft.body}\n${draft.mediaUrl}`), [draft]);
  const info = smsInfo(draft.body);

  const save = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const d = await api("/api/admin/email-campaigns/templates", { method: "POST", body: JSON.stringify({ ...draft, channel }) });
      setDraft((cur) => ({ ...cur, id: d.template.id })); setNotice("Template saved."); load(channel);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const remove = async (t: Saved) => {
    if (!window.confirm(`Delete the template "${t.name}"? Campaigns made from it are not affected.`)) return;
    try { await api(`/api/admin/email-campaigns/${t.id}`, { method: "DELETE" }); if (draft.id === t.id) setDraft(EMPTY); load(channel); }
    catch (e: any) { setError(e.message); }
  };

  const starters: { id: string; name: string; category: string; description: string; fill: Draft }[] =
    channel === "email"
      ? CAMPAIGN_TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: t.category, description: t.description, fill: { name: t.name, subject: t.subject, previewText: t.previewText, body: t.body, mediaUrl: "" } }))
      : TEXT_TEMPLATES.filter((t) => t.channel === channel).map((t) => ({ id: t.id, name: t.name, category: t.category, description: t.description, fill: { name: t.name, subject: "", previewText: "", body: t.body, mediaUrl: t.mediaUrl || "" } }));

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex gap-2 flex-wrap" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={channel === t.key} onClick={() => switchTab(t.key)}
            className={`px-4 py-2 rounded-md text-[13px] font-semibold border ${channel === t.key ? "bg-[#1ab394] text-white border-[#1ab394]" : "border-[#e7e9eb] text-[#6c757d] hover:border-[#1ab394]/50"}`}>
            {t.label}<span className={`block text-[10.5px] font-normal ${channel === t.key ? "text-white/80" : "text-[#9ba6b7]"}`}>{t.hint}</span>
          </button>
        ))}
      </div>
      {channel !== "email" && (
        <p className="text-[12.5px] text-[#6c757d]">Text messaging is not switched on yet. These templates are ready for when it is. Marketing texts must say who they're from and how to opt out.</p>
      )}

      <section className="ibox">
        <div className="ibox-title"><h3 className="text-sm font-semibold text-[#323a46]">Starter templates</h3></div>
        <div className="ibox-content grid grid-cols-1 sm:grid-cols-2 gap-2">
          {starters.map((s) => (
            <button key={s.id} onClick={() => { setDraft(s.fill); setNotice("Loaded. Change it, then click Save to keep your own copy."); setError(null); }}
              className="text-left rounded-md border border-[#e7e9eb] px-3 py-2 hover:border-[#1ab394]/50">
              <span className="block text-[11px] uppercase tracking-wider text-[#9ba6b7]">{s.category}</span>
              <span className="block text-[13.5px] font-semibold text-[#323a46]">{s.name}</span>
              <span className="block text-[12px] text-[#6c757d]">{s.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="ibox">
        <div className="ibox-title"><h3 className="text-sm font-semibold text-[#323a46]">My templates</h3>
          <button onClick={() => { setDraft(EMPTY); setNotice(null); setError(null); }} className="text-[12px] text-[#1ab394] hover:underline">New blank</button></div>
        <div className="ibox-content p-0">
          {saved.length === 0 && <p className="p-5 text-[13px] text-[#9ba6b7]">Nothing saved yet. Start from a template above, or write one below.</p>}
          {saved.map((t) => (
            <div key={t.id} className="px-5 py-3 border-t border-[#e7e9eb] first:border-0 flex items-center gap-3">
              <button className="flex-1 text-left min-w-0" onClick={() => { setDraft({ id: t.id, name: t.name, subject: t.subject, previewText: t.previewText, body: t.body, mediaUrl: t.mediaUrl }); setNotice(null); setError(null); }}>
                <span className="block text-[14px] font-semibold text-[#323a46] truncate">{t.name}</span>
                <span className="block text-[12px] text-[#9ba6b7] truncate">{channel === "email" ? (t.subject || "No subject") : t.body}</span>
              </button>
              <button className="text-[12px] text-[#9ba6b7] hover:text-red-600" aria-label={`Delete template ${t.name}`} onClick={() => remove(t)}>Delete</button>
            </div>
          ))}
        </div>
      </section>

      <section className="ibox">
        <div className="ibox-title"><h3 className="text-sm font-semibold text-[#323a46]">{draft.id ? "Edit template" : "Write a template"}</h3></div>
        <div className="ibox-content space-y-3">
          <label className="block text-[12px] font-semibold text-[#6c757d]">Template name
            <input value={draft.name} onChange={(e) => edit({ name: e.target.value })} className={`${inputCls} mt-1 font-normal`} maxLength={120} /></label>

          {channel === "email" && (<>
            <label className="block text-[12px] font-semibold text-[#6c757d]">Subject
              <input value={draft.subject} onChange={(e) => edit({ subject: e.target.value })} className={`${inputCls} mt-1 font-normal`} maxLength={300} /></label>
            <Checks items={draft.subject ? subjectChecks(draft.subject) : []} />
            <label className="block text-[12px] font-semibold text-[#6c757d]">Preview text
              <input value={draft.previewText} onChange={(e) => edit({ previewText: e.target.value })} className={`${inputCls} mt-1 font-normal`} maxLength={500} /></label>
            <Checks items={draft.previewText ? previewChecks(draft.previewText) : []} />
          </>)}

          <label className="block text-[12px] font-semibold text-[#6c757d]">{channel === "email" ? "Body" : "Message"}
            <textarea value={draft.body} onChange={(e) => edit({ body: e.target.value })} rows={channel === "email" ? 10 : 5} maxLength={channel === "email" ? 50000 : 1600}
              className={`${inputCls} mt-1 font-normal leading-relaxed`} /></label>

          {channel !== "email" && (<>
            <p className="text-[12.5px] text-[#323a46]">{info.length} characters · {info.segments} part{info.segments === 1 ? "" : "s"} · {info.encoding}{channel === "sms" ? ` · ${info.perSegment} per part` : ""}</p>
            <Checks items={draft.body ? smsChecks(draft.body, channel) : []} />
          </>)}

          {channel === "mms" && (<>
            <label className="block text-[12px] font-semibold text-[#6c757d]">Picture link (https://… .jpg, .png or .gif)
              <input value={draft.mediaUrl} onChange={(e) => edit({ mediaUrl: e.target.value })} className={`${inputCls} mt-1 font-normal`} maxLength={500} /></label>
            <button type="button" className={btnGhost} onClick={() => {
              setPickerOpen((o) => !o);
              if (!pickerOpen) api("/api/admin/photos").then((d) => setLibrary(d.photos || [])).catch((e) => setError(e.message));
            }}>{pickerOpen ? "Close library" : "Choose from photo library"}</button>
            {pickerOpen && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {library.length === 0 && <p className="col-span-full text-[12.5px] text-[#9ba6b7]">No photos in the library yet (or storage isn't connected).</p>}
                {library.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <button key={p.url} type="button" title={`${p.folder} / ${p.name}`} onClick={() => { edit({ mediaUrl: p.url }); setPickerOpen(false); }}
                    className="rounded-md overflow-hidden border border-[#e7e9eb] hover:border-[#1ab394]"><img src={p.url} alt={p.name} className="w-full aspect-square object-cover" loading="lazy" /></button>
                ))}
              </div>
            )}
            <Checks items={draft.mediaUrl && !draft.mediaUrl.includes("{{") ? mediaChecks(draft.mediaUrl) : []} />
            <p className="text-[11.5px] text-[#9ba6b7]">Keep pictures small (carriers often limit them to about 1 MB). The link is checked for format only.</p>
          </>)}

          {blanks.length > 0 && (
            <p className="text-[12.5px] text-[#b7791f]">Blanks to fill when you use this: {blanks.map((t) => `{{${t}}}`).join(", ")}. <b>{"{{firstName}}"}</b> is filled in automatically for each person.</p>
          )}
          {error && <p className="text-[13px] text-red-600" role="alert">{error}</p>}
          {notice && !error && <p className="text-[13px] text-[#1ab394]">{notice}</p>}
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={busy || !draft.name.trim() || !draft.body.trim()} onClick={save}>{busy ? "Saving…" : draft.id ? "Save changes" : "Save template"}</button>
            {draft.id && <button className={btnGhost} onClick={() => setDraft({ ...draft, id: undefined, name: `${draft.name} copy` })}>Save as a copy</button>}
          </div>
        </div>
      </section>
    </div>
  );
}

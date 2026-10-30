"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { previewChecks, subjectChecks, unresolvedTags } from "@/lib/campaign-rules";
import { mediaChecks, smsChecks, smsInfo } from "@/lib/sms-rules";
import { CAMPAIGN_TEMPLATES, TEXT_TEMPLATES } from "@/lib/campaign-templates";
import { defaultSettings, resolveLabel, type ListName, type TemplateSettings } from "@/lib/template-categories";
import { renderHtml, type Design } from "@/lib/studio";
import { starterDesigns } from "@/lib/studio-starters";
import { useBrand } from "@/lib/use-brand";

type Channel = "email" | "sms" | "mms";
interface Saved { id: string; name: string; subject: string; previewText: string; body: string; mediaUrl: string; category: string; kind: string; studio?: boolean }
interface Draft { id?: string; name: string; subject: string; previewText: string; body: string; mediaUrl: string; category: string; kind: string; studio?: boolean }

const EMPTY: Draft = { name: "", subject: "", previewText: "", body: "", mediaUrl: "", category: "", kind: "" };
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

const inputCls = "w-full rounded-md border border-line px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-accent";
const btnPrimary = "h-9 px-4 rounded-md bg-accent-deep text-white text-[13px] font-semibold hover:bg-navy disabled:opacity-50";
const btnGhost = "h-9 px-3 rounded-md border border-line text-muted text-[13px] hover:border-accent/50 disabled:opacity-50";

function Checks({ items }: { items: { ok: boolean; label: string }[] }) {
  return <ul className="text-[12px] space-y-0.5">{items.map((k) => <li key={k.label} className={k.ok ? "text-accent" : "text-warn"}>{k.ok ? "✓" : "•"} {k.label}</li>)}</ul>;
}

// Template library for email, SMS and MMS. A template is only a starting point: nothing here sends.
// Texting itself is not switched on yet; these are ready for when it is.
export interface TextPrefill { key: string; channel: "sms" | "mms"; draft: Draft }

export default function TemplatesPanel({ onOpenStudio, onOpenStarter, prefill }: { onOpenStudio?: (id: string) => void; onOpenStarter?: (id: string) => void; prefill?: TextPrefill | null }) {
  const [channel, setChannel] = useState<Channel>("email");
  const [saved, setSaved] = useState<Saved[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [library, setLibrary] = useState<{ url: string; name: string; folder: string }[]>([]);
  const [filter, setFilter] = useState<string>(""); // "" = all categories
  const [settings, setSettings] = useState<TemplateSettings>(defaultSettings());
  const [manageOpen, setManageOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [newLabel, setNewLabel] = useState<Record<ListName, string>>({ categories: "", kinds: "" });
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);

  useEffect(() => { api("/api/admin/template-settings").then((d) => setSettings(d.settings)).catch((e) => setError(e.message)); }, []);

  // Add, rename, delete or hide. The server relabels saved templates when a name changes.
  const manage = async (body: Record<string, unknown>, done: string) => {
    setError(null); setNotice(null);
    try {
      const d = await api("/api/admin/template-settings", { method: "POST", body: JSON.stringify(body) });
      setSettings(d.settings);
      if (d.relabeled) load(channel);
      setNotice(done + (d.relabeled ? ` (${d.relabeled} saved template${d.relabeled === 1 ? "" : "s"} updated)` : ""));
      return true;
    } catch (e: any) { setError(e.message); return false; }
  };

  const load = useCallback(async (ch: Channel) => {
    try { setSaved((await api(`/api/admin/email-campaigns?templates=1&channel=${ch}`)).templates || []); }
    catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(channel); }, [channel, load]);
  // Coming from the Examples library: switch to that text channel with the example filled in.
  useEffect(() => {
    if (!prefill) return;
    setChannel(prefill.channel); setDraft(prefill.draft); setError(null); setAiOptions([]);
    setNotice("Example loaded below. Change it, then Save template to keep your own copy.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.key]);

  const [aiGoal, setAiGoal] = useState("");
  const [aiLink, setAiLink] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiOptions, setAiOptions] = useState<{ body: string; length: number; segments: number; issues: string[] }[]>([]);
  const writeTexts = async () => {
    setAiBusy(true); setError(null); setAiOptions([]);
    try {
      const d = await api("/api/admin/text-drafts/ai", { method: "POST", body: JSON.stringify({ channel, goal: aiGoal, link: aiLink }) });
      setAiOptions(d.options || []);
    } catch (e: any) { setError(e.message); } finally { setAiBusy(false); }
  };

  const switchTab = (ch: Channel) => { setChannel(ch); setDraft(EMPTY); setError(null); setNotice(null); setAiOptions([]); };
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

  // Built-in starters follow any rename or deletion of their category/type; hidden ones are skipped.
  const cat = (c: string) => resolveLabel(c, settings.aliases.categories, settings.categories);
  const kindOf = (k: string) => resolveLabel(k, settings.aliases.kinds, settings.kinds);
  const baseStarters: { id: string; name: string; category: string; kind: string; description: string; fill: Draft }[] =
    channel === "email"
      ? CAMPAIGN_TEMPLATES.map((t) => ({ id: t.id, name: t.name, category: cat(t.category), kind: kindOf(t.kind), description: t.description, fill: { name: t.name, subject: t.subject, previewText: t.previewText, body: t.body, mediaUrl: "", category: cat(t.category), kind: kindOf(t.kind) } }))
      : TEXT_TEMPLATES.filter((t) => t.channel === channel).map((t) => ({ id: t.id, name: t.name, category: cat(t.category), kind: kindOf(t.kind), description: t.description, fill: { name: t.name, subject: "", previewText: "", body: t.body, mediaUrl: t.mediaUrl || "", category: cat(t.category), kind: kindOf(t.kind) } }));
  const hiddenCount = baseStarters.filter((s) => settings.hiddenStarters.includes(s.id)).length;
  const allStarters = showHidden ? baseStarters : baseStarters.filter((s) => !settings.hiddenStarters.includes(s.id));

  // How many templates (starters plus saved) sit in each category for this channel, for the filter chips.
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of allStarters) c[s.category] = (c[s.category] || 0) + 1;
    for (const s of saved) if (s.category) c[s.category] = (c[s.category] || 0) + 1;
    return c;
  }, [allStarters, saved]);
  const starters = filter ? allStarters.filter((s) => s.category === filter) : allStarters;
  const kit = useBrand();
  const designById = useMemo(() => Object.fromEntries(starterDesigns(kit).map((d) => [d.id, d])), [kit]);
  const savedShown = filter ? saved.filter((s) => s.category === filter) : saved;

  return (
    <div className="flex gap-6">
      <div className="flex-1 space-y-4 max-w-3xl">
      <div className="flex gap-2 flex-wrap" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={channel === t.key} onClick={() => switchTab(t.key)}
            className={`px-4 py-2 rounded-md text-[13px] font-semibold border ${channel === t.key ? "bg-accent text-white border-accent" : "border-line text-muted hover:border-accent/50"}`}>
            {t.label}<span className={`block text-[10.5px] font-normal ${channel === t.key ? "text-white/80" : "text-subtle"}`}>{t.hint}</span>
          </button>
        ))}
      </div>
      {channel !== "email" && (
        <p className="text-[12.5px] text-muted">Text messaging is not switched on yet. These templates are ready for when it is. Marketing texts must say who they're from and how to opt out.</p>
      )}

      <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter by category">
        {["", ...settings.categories].map((c) => {
          const n = c ? counts[c] || 0 : allStarters.length + saved.length;
          return (
            <button key={c || "all"} onClick={() => setFilter(c)} aria-pressed={filter === c}
              className={`px-3 py-1.5 rounded-full text-[12px] border ${filter === c ? "bg-ink text-white border-ink" : "border-line text-muted hover:border-accent/50"} ${c && n === 0 ? "opacity-60" : ""}`}>
              {c || "All"} <span className={filter === c ? "text-white/70" : "text-subtle"}>{n}</span>
            </button>
          );
        })}
      </div>

      <section className="ibox">
        <button onClick={() => setManageOpen((o) => !o)} aria-expanded={manageOpen} className="ibox-title w-full text-left">
          <span className="text-sm font-semibold text-ink">Manage categories and types</span>
          <span className="text-[12px] text-accent">{manageOpen ? "Close" : "Add, rename or delete"}</span>
        </button>
        {manageOpen && (
          <div className="ibox-content grid grid-cols-1 md:grid-cols-2 gap-6">
            {(["categories", "kinds"] as ListName[]).map((l) => (
              <div key={l} className="space-y-2">
                <div className="text-[12px] font-semibold text-muted">{l === "categories" ? "Categories (who it's for)" : "Types (what it does)"}</div>
                <ul className="space-y-1">
                  {settings[l].map((name) => (
                    <li key={name} className="flex items-center gap-2 text-[13.5px] text-ink">
                      <span className="flex-1 truncate">{name}</span>
                      <button className="text-[12px] text-muted hover:text-accent" aria-label={`Rename ${name}`} onClick={async () => {
                        const to = window.prompt(`Rename "${name}" to:`, name);
                        if (to && to.trim() && to.trim() !== name) {
                          if (await manage({ action: "rename", list: l, from: name, to }, `Renamed to "${to.trim()}".`) && filter === name) setFilter(to.trim());
                        }
                      }}>Rename</button>
                      <button className="text-[12px] text-subtle hover:text-red-600" aria-label={`Delete ${name}`} onClick={async () => {
                        const n = [...saved, ...allStarters].filter((s) => (l === "categories" ? s.category : s.kind) === name).length;
                        if (window.confirm(`Delete "${name}"? The ${n} template${n === 1 ? "" : "s"} using it will be kept, just without this ${l === "categories" ? "category" : "type"}.`)) {
                          if (await manage({ action: "delete", list: l, name }, `"${name}" deleted.`) && filter === name) setFilter("");
                        }
                      }}>Delete</button>
                    </li>
                  ))}
                  {settings[l].length === 0 && <li className="text-[12.5px] text-subtle">None yet. Add one below.</li>}
                </ul>
                <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await manage({ action: "add", list: l, name: newLabel[l] }, `"${newLabel[l].trim()}" added.`)) setNewLabel((x) => ({ ...x, [l]: "" })); }}>
                  <input value={newLabel[l]} onChange={(e) => setNewLabel((x) => ({ ...x, [l]: e.target.value }))} placeholder={l === "categories" ? "New category" : "New type"} maxLength={40} className={inputCls} aria-label={l === "categories" ? "New category name" : "New type name"} />
                  <button type="submit" className={btnPrimary} disabled={!newLabel[l].trim()}>Add</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      {channel === "email" ? (
      <section className="ibox">
        <div className="ibox-title">
          <h3 className="text-sm font-semibold text-ink">Finished emails to start from</h3>
          <span className="text-[12px] text-subtle">Pick a look, then change the words in the Studio</span>
        </div>
        <div className="ibox-content grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {starters.length === 0 && <p className="col-span-full text-[13px] text-subtle">No emails in this category yet.</p>}
          {starters.map((s) => {
            const hidden = settings.hiddenStarters.includes(s.id);
            const st = designById[s.id];
            return (
              <article key={s.id} className={`group rounded-lg border border-line bg-white overflow-hidden flex flex-col hover:border-accent transition-colors motion-reduce:transition-none ${hidden ? "opacity-60" : ""}`}>
                <button type="button" className="block text-left" onClick={() => onOpenStarter?.(s.id)} onMouseEnter={() => st && setPreviewTemplate(renderHtml(st.design, { title: s.name }))} aria-label={`Open ${s.name} in the Studio`}>
                  {st ? <Thumb design={st.design} title={s.name} /> : <div className="h-56 bg-canvas" />}
                </button>
                <div className="p-3 flex-1 flex flex-col gap-1">
                  <span className="text-[11px] uppercase tracking-wider text-subtle">{[s.category || "Uncategorized", s.kind].filter(Boolean).join(" · ")}{st ? ` · ${st.look}` : ""}</span>
                  <span className="text-[14px] font-semibold text-ink leading-tight">{s.name}</span>
                  <span className="text-[12.5px] text-muted">{s.description}</span>
                  <div className="mt-auto pt-2 flex items-center gap-2">
                    <button type="button" className={`${btnPrimary} min-h-[44px] sm:min-h-0`} onClick={() => onOpenStarter?.(s.id)}>Use this</button>
                    <button type="button" className={btnGhost} onClick={() => { setDraft(s.fill); setPreviewTemplate(null); setNotice("Loaded as plain text below."); setError(null); }}>Plain text</button>
                    <button type="button" className="ml-auto text-[12px] text-subtle hover:text-ink min-h-[44px] sm:min-h-0 px-2" aria-label={`${hidden ? "Show" : "Hide"} starter ${s.name}`}
                      onClick={() => manage(hidden ? { action: "restore" } : { action: "hide", id: s.id }, hidden ? "All hidden starters are back." : `"${s.name}" is hidden.`)}>{hidden ? "Show" : "Hide"}</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {hiddenCount > 0 && (
          <div className="px-5 pb-4 text-[12px] text-subtle">
            {hiddenCount} starter{hiddenCount === 1 ? "" : "s"} hidden.{" "}
            <button className="text-accent hover:underline" onClick={() => setShowHidden((v) => !v)}>{showHidden ? "Stop showing them" : "Show them"}</button>
            {" · "}
            <button className="text-accent hover:underline" onClick={() => manage({ action: "restore" }, "All hidden starters are back.")}>Bring them all back</button>
          </div>
        )}
      </section>
      ) : (
      <section className="ibox">
        <div className="ibox-title"><h3 className="text-sm font-semibold text-ink">Starter templates</h3></div>
        <div className="ibox-content grid grid-cols-1 sm:grid-cols-2 gap-2">
          {starters.length === 0 && <p className="col-span-full text-[13px] text-subtle">No starters in this category for {channel.toUpperCase()} yet. Write your own below and pick the category.</p>}
          {starters.map((s) => {
            const hidden = settings.hiddenStarters.includes(s.id);
            return (
              <div key={s.id} className={`rounded-md border border-line hover:border-accent/50 flex items-start ${hidden ? "opacity-60" : ""}`}>
                <button 
                  onClick={() => { setDraft(s.fill); setPreviewTemplate(s.fill.body); setNotice("Loaded. Change it, then click Save to keep your own copy."); setError(null); }}
                  onMouseEnter={() => setPreviewTemplate(s.fill.body)}
                  className="flex-1 text-left px-3 py-2 min-w-0"
                >
                  <span className="block text-[11px] uppercase tracking-wider text-subtle">{[s.category || "Uncategorized", s.kind].filter(Boolean).join(" · ")}</span>
                  <span className="block text-[13.5px] font-semibold text-ink">{s.name}</span>
                  <span className="block text-[12px] text-muted">{s.description}</span>
                </button>
                <button className="px-3 py-2 text-[12px] text-subtle hover:text-ink" aria-label={`${hidden ? "Show" : "Hide"} starter ${s.name}`}
                  onClick={() => manage(hidden ? { action: "restore" } : { action: "hide", id: s.id }, hidden ? "All hidden starters are back." : `"${s.name}" is hidden.`)}>
                  {hidden ? "Show" : "Hide"}
                </button>
              </div>
            );
          })}
        </div>
        {hiddenCount > 0 && (
          <div className="px-5 pb-4 text-[12px] text-subtle">
            {hiddenCount} starter{hiddenCount === 1 ? "" : "s"} hidden.{" "}
            <button className="text-accent hover:underline" onClick={() => setShowHidden((v) => !v)}>{showHidden ? "Stop showing them" : "Show them"}</button>
            {" · "}
            <button className="text-accent hover:underline" onClick={() => manage({ action: "restore" }, "All hidden starters are back.")}>Bring them all back</button>
          </div>
        )}
      </section>

      )}

      <section className="ibox">
        <div className="ibox-title"><h3 className="text-sm font-semibold text-ink">My templates</h3>
          <button onClick={() => { setDraft(EMPTY); setNotice(null); setError(null); }} className="text-[12px] text-accent hover:underline">New blank</button></div>
        <div className="ibox-content p-0">
          {savedShown.length === 0 && <p className="p-5 text-[13px] text-subtle">{saved.length === 0 ? "Nothing saved yet. Start from a template above, or write one below." : "None of your saved templates are in this category."}</p>}
          {savedShown.map((t) => (
            <div key={t.id} className="px-5 py-3 border-t border-line first:border-0 flex items-center gap-3">
              <button className="flex-1 text-left min-w-0" onClick={() => { if (t.studio) { onOpenStudio?.(t.id); return; } setDraft({ id: t.id, name: t.name, subject: t.subject, previewText: t.previewText, body: t.body, mediaUrl: t.mediaUrl, category: t.category, kind: t.kind }); setNotice(null); setError(null); }}>
                {(t.category || t.kind || t.studio) && <span className="block text-[11px] uppercase tracking-wider text-subtle">{[t.studio ? "Studio design" : "", t.category, t.kind].filter(Boolean).join(" · ")}</span>}
                <span className="block text-[14px] font-semibold text-ink truncate">{t.name}</span>
                <span className="block text-[12px] text-subtle truncate">{channel === "email" ? (t.subject || "No subject") : t.body}</span>
              </button>
              {t.studio && <button className="text-[12px] text-accent hover:underline" onClick={() => onOpenStudio?.(t.id)}>Open in Studio</button>}
              <button className="text-[12px] text-subtle hover:text-red-600" aria-label={`Delete template ${t.name}`} onClick={() => remove(t)}>Delete</button>
            </div>
          ))}
        </div>
      </section>

      {channel !== "email" && (
        <section className="ibox">
          <div className="ibox-title"><h3 className="text-sm font-semibold text-ink">Write a text with Claude</h3></div>
          <div className="ibox-content space-y-3">
            <label className="block text-[12px] font-semibold text-muted">What is the text for?
              <textarea value={aiGoal} onChange={(e) => setAiGoal(e.target.value)} rows={2} maxLength={1000} placeholder="e.g. Invite past clients to tour the Magnolia Room" className={`${inputCls} mt-1 font-normal`} /></label>
            <label className="block text-[12px] font-semibold text-muted">Link to include (optional, https://…)
              <input value={aiLink} onChange={(e) => setAiLink(e.target.value)} maxLength={300} className={`${inputCls} mt-1 font-normal`} /></label>
            <button type="button" className={btnPrimary} disabled={aiBusy || !aiGoal.trim()} onClick={writeTexts}>{aiBusy ? "Writing…" : "Suggest 3 texts"}</button>
            {aiOptions.map((o, i) => (
              <div key={i} className="rounded-md border border-line p-3 space-y-1.5">
                <p className="text-[13.5px] text-ink whitespace-pre-wrap">{o.body}</p>
                <p className="text-[11.5px] text-subtle">{o.length} characters · {o.segments} part{o.segments === 1 ? "" : "s"}{o.issues.length ? ` · Check: ${o.issues.join("; ")}` : " · passes the text rules"}</p>
                <button type="button" className={btnGhost} onClick={() => { edit({ body: o.body }); setNotice("Copied into the message box below. Review it, then save."); }}>Use this one</button>
              </div>
            ))}
            <p className="text-[11.5px] text-subtle">Suggestions only. Nothing is saved or sent, and texting itself is not switched on yet.</p>
          </div>
        </section>
      )}

      <section className="ibox">
        <div className="ibox-title"><h3 className="text-sm font-semibold text-ink">{draft.id ? "Edit template" : "Write a template"}</h3></div>
        <div className="ibox-content space-y-3">
          <label className="block text-[12px] font-semibold text-muted">Template name
            <input value={draft.name} onChange={(e) => edit({ name: e.target.value })} className={`${inputCls} mt-1 font-normal`} maxLength={120} /></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-[12px] font-semibold text-muted">Category (who it's for)
              <select value={draft.category} onChange={(e) => edit({ category: e.target.value })} className={`${inputCls} mt-1 font-normal`}>
                <option value="">None</option>{settings.categories.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="block text-[12px] font-semibold text-muted">Type (what it does)
              <select value={draft.kind} onChange={(e) => edit({ kind: e.target.value })} className={`${inputCls} mt-1 font-normal`}>
                <option value="">None</option>{settings.kinds.map((k) => <option key={k}>{k}</option>)}</select></label>
          </div>

          {channel === "email" && (<>
            <label className="block text-[12px] font-semibold text-muted">Subject
              <input value={draft.subject} onChange={(e) => edit({ subject: e.target.value })} className={`${inputCls} mt-1 font-normal`} maxLength={300} /></label>
            <Checks items={draft.subject ? subjectChecks(draft.subject) : []} />
            <label className="block text-[12px] font-semibold text-muted">Preview text
              <input value={draft.previewText} onChange={(e) => edit({ previewText: e.target.value })} className={`${inputCls} mt-1 font-normal`} maxLength={500} /></label>
            <Checks items={draft.previewText ? previewChecks(draft.previewText) : []} />
          </>)}

          <label className="block text-[12px] font-semibold text-muted">{channel === "email" ? "Body" : "Message"}
            <textarea value={draft.body} onChange={(e) => edit({ body: e.target.value })} rows={channel === "email" ? 10 : 5} maxLength={channel === "email" ? 50000 : 1600}
              className={`${inputCls} mt-1 font-normal leading-relaxed`} /></label>

          {channel !== "email" && (<>
            <p className="text-[12.5px] text-ink">{info.length} characters · {info.segments} part{info.segments === 1 ? "" : "s"} · {info.encoding}{channel === "sms" ? ` · ${info.perSegment} per part` : ""}</p>
            <Checks items={draft.body ? smsChecks(draft.body, channel) : []} />
          </>)}

          {channel === "mms" && (<>
            <label className="block text-[12px] font-semibold text-muted">Picture link (https://… .jpg, .png or .gif)
              <input value={draft.mediaUrl} onChange={(e) => edit({ mediaUrl: e.target.value })} className={`${inputCls} mt-1 font-normal`} maxLength={500} /></label>
            <button type="button" className={btnGhost} onClick={() => {
              setPickerOpen((o) => !o);
              if (!pickerOpen) api("/api/admin/photos").then((d) => setLibrary((d.photos || []).filter((x: { name: string }) => /\.(jpe?g|png|gif|webp)$/i.test(x.name)))).catch((e) => setError(e.message));
            }}>{pickerOpen ? "Close library" : "Choose from photo library"}</button>
            {pickerOpen && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {library.length === 0 && <p className="col-span-full text-[12.5px] text-subtle">No photos in the library yet (or storage isn't connected).</p>}
                {library.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <button key={p.url} type="button" title={`${p.folder} / ${p.name}`} onClick={() => { edit({ mediaUrl: p.url }); setPickerOpen(false); }}
                    className="rounded-md overflow-hidden border border-line hover:border-accent"><img src={p.url} alt={p.name} className="w-full aspect-square object-cover" loading="lazy" /></button>
                ))}
              </div>
            )}
            <Checks items={draft.mediaUrl && !draft.mediaUrl.includes("{{") ? mediaChecks(draft.mediaUrl) : []} />
            <p className="text-[11.5px] text-subtle">Keep pictures small (carriers often limit them to about 1 MB). The link is checked for format only.</p>
          </>)}

          {blanks.length > 0 && (
            <p className="text-[12.5px] text-warn">Blanks to fill when you use this: {blanks.map((t) => `{{${t}}}`).join(", ")}. <b>{"{{firstName}}"}</b> is filled in automatically for each person.</p>
          )}
          {error && <p className="text-[13px] text-red-600" role="alert">{error}</p>}
          {notice && <p className="text-[13px] text-success">{notice}</p>}
          <div className="flex gap-2">
            <button className={btnPrimary} disabled={busy || !draft.name.trim() || !draft.body.trim()} onClick={save}>{busy ? "Saving…" : draft.id ? "Save changes" : "Save template"}</button>
            {draft.id && <button className={btnGhost} onClick={() => setDraft({ ...draft, id: undefined, name: `${draft.name} copy` })}>Save as a copy</button>}
          </div>
        </div>
      </section>
    </div>

    {/* Right preview panel */}
    <div className="hidden xl:block w-[400px] shrink-0 bg-white border-l border-line overflow-y-auto" style={{ maxHeight: 'calc(100vh - 100px)' }}>
      <div className="p-4 border-b border-line">
        <h3 className="text-sm font-semibold text-ink">Template Preview</h3>
        <p className="text-[11.5px] text-subtle">Hover over templates to preview</p>
      </div>
      <div className="p-4">
        {previewTemplate ? (
          /<[a-z][\s\S]*>/i.test(previewTemplate)
            ? <iframe title="Template preview" sandbox="" srcDoc={previewTemplate} className="w-full border border-line rounded-md bg-white" style={{ height: 'calc(100vh - 200px)' }} />
            : <pre className="border border-line rounded-md p-3 text-[13px] text-ink whitespace-pre-wrap font-admin">{previewTemplate}</pre>
        ) : (
          <div className="text-center py-12 text-subtle">
            <p className="text-[13px]">Hover over a template to see preview</p>
          </div>
        )}
      </div>
    </div>
  </div>
  );
}

function Thumb({ design, title }: { design: Design; title: string }) {
  // The email is laid out at its real 600px width and shrunk to the card, so the card shows the
  // whole top of the email instead of a crop.
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(300);
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const scale = w / 640;
  return (
    <div ref={ref} className="h-56 overflow-hidden bg-canvas border-b border-line">
      <iframe title={`Preview of ${title}`} sandbox="" tabIndex={-1} scrolling="no" srcDoc={renderHtml(design, { title })} className="pointer-events-none" style={{ width: 640, height: 224 / scale, border: 0, transform: `scale(${scale})`, transformOrigin: "top left" }} />
    </div>
  );
}

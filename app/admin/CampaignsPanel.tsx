"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  VENUE_ADDRESS, MAX_TEST_ADDRESSES, completeness, fillFirstName, isEmail, previewChecks, reviewLinks, subjectChecks, unresolvedTags,
} from "@/lib/campaign-rules";
import { CAMPAIGN_TEMPLATES } from "@/lib/campaign-templates";

interface SavedTemplate { id: string; name: string; subject: string; previewText: string; body: string }

interface Campaign {
  id: string; name: string; status: string; subject: string; previewText: string;
  fromName: string; fromEmail: string; replyTo: string | null;
  recipientFilter: { q?: string; status?: string; track?: string; gap?: string } | null;
  recipientCount: number; designType: string; body: string;
  testSends: { at: string; results: { to: string; mode: string }[] }[] | null;
}
interface Summary { id: string; name: string; status: string; subject: string; recipientCount: number; updatedAt: string; done: number }

type SectionKey = "subject" | "sender" | "recipients" | "design" | "review";
const SECTIONS: { key: SectionKey; title: string; hint: string }[] = [
  { key: "subject", title: "Subject", hint: "Subject line and preview text" },
  { key: "sender", title: "Sender", hint: "From name, from address, reply-to" },
  { key: "recipients", title: "Recipients", hint: "Who gets it" },
  { key: "design", title: "Design", hint: "Write the email, by hand or with Claude" },
  { key: "review", title: "Review & test", hint: "Preview, check links, send a test" },
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

export default function CampaignsPanel() {
  const [list, setList] = useState<Summary[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setList((await api("/api/admin/email-campaigns")).campaigns); setError(null); }
    catch (e: any) { setError(e.message); setList([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    try { const d = await api("/api/admin/email-campaigns", { method: "POST", body: JSON.stringify({ name }) }); setName(""); setOpenId(d.campaign.id); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  if (openId) return <Editor id={openId} onBack={() => { setOpenId(null); load(); }} />;

  return (
    <div className="space-y-6 max-w-3xl">
      <section className="ibox">
        <div className="ibox-title"><h3 className="text-sm font-semibold text-[#323a46]">Create a campaign</h3></div>
        <div className="ibox-content">
          <p className="text-[13px] text-[#6c757d] leading-relaxed">
            Build an email step by step, by hand or with Claude's help on any step. You can send a test to yourself.
            Sending to a whole list is switched off in this version.
          </p>
          <form onSubmit={create} className="mt-3 flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Campaign name, e.g. Spring open house" className={inputCls} aria-label="Campaign name" />
            <button type="submit" disabled={!name.trim() || busy} className={btnPrimary}>Continue</button>
          </form>
          {error && <p className="mt-2 text-[13px] text-red-600" role="alert">{error}</p>}
        </div>
      </section>

      <section className="ibox">
        <div className="ibox-title"><h3 className="text-sm font-semibold text-[#323a46]">Your campaigns</h3></div>
        <div className="ibox-content p-0">
          {list === null && <p className="p-5 text-[13px] text-[#9ba6b7]">Loading…</p>}
          {list?.length === 0 && <p className="p-5 text-[13px] text-[#9ba6b7]">No campaigns yet.</p>}
          {list?.map((c) => (
            <button key={c.id} onClick={() => setOpenId(c.id)} className="w-full text-left px-5 py-3 border-t border-[#e7e9eb] first:border-0 hover:bg-[#f9fafb] flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-[#323a46] truncate">{c.name}</div>
                <div className="text-[12px] text-[#9ba6b7] truncate">{c.subject || "No subject yet"}</div>
              </div>
              <span className="text-[11px] text-[#6c757d]">{c.done}/5 done</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.status === "READY" ? "bg-[#1ab394]/15 text-[#1ab394]" : "bg-[#eef2f7] text-[#6c757d]"}`}>{c.status}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Editor({ id, onBack }: { id: string; onBack: () => void }) {
  const [c, setC] = useState<Campaign | null>(null);
  const [open, setOpen] = useState<SectionKey | null>("subject");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ tracks: string[]; statuses: string[] }>({ tracks: [], statuses: [] });
  const [options, setOptions] = useState<{ subject: string; previewText: string }[]>([]);
  const [brief, setBrief] = useState({ goal: "", callToAction: "", callToActionLink: "", include: "" });
  const [rewrite, setRewrite] = useState("");
  const [testTo, setTestTo] = useState("");
  const [saved, setSaved] = useState<SavedTemplate[]>([]);
  const [tplName, setTplName] = useState("");

  const loadSaved = useCallback(() => {
    api("/api/admin/email-campaigns?templates=1").then((d) => setSaved(d.templates || [])).catch(() => {});
  }, []);
  useEffect(() => { if (open === "design") loadSaved(); }, [open, loadSaved]);

  // Using a template copies it into this email; the original is never changed.
  const useTemplate = (t: { name: string; subject: string; previewText: string; body: string }) => {
    if (c && c.body.trim() && !window.confirm(`Replace the current subject and body with "${t.name}"? Your other settings stay.`)) return;
    edit({ subject: t.subject, previewText: t.previewText, body: t.body, designType: "plain" });
    setNotice(`"${t.name}" is loaded. Fill in any {{blanks}}, then click Save.`);
  };

  useEffect(() => {
    api(`/api/admin/email-campaigns/${id}`).then((d) => setC(d.campaign)).catch((e) => setError(e.message));
    // The leads endpoint also returns the distinct tracks/statuses; a query that matches nothing keeps it light.
    api("/api/admin/leads?q=%01nomatch").then((d) => setFilters({ tracks: d.tracks || [], statuses: d.statuses || [] })).catch(() => {});
  }, [id]);

  const done = useMemo(() => (c ? completeness(c) : null), [c]);

  const save = async (patch: Partial<Campaign>, message?: string) => {
    setBusy("save"); setError(null);
    try { const d = await api(`/api/admin/email-campaigns/${id}`, { method: "PATCH", body: JSON.stringify(patch) }); setC(d.campaign); setNotice(message ?? "Saved."); }
    catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };
  const edit = (patch: Partial<Campaign>) => setC((prev) => (prev ? { ...prev, ...patch } : prev));
  const ai = async (body: Record<string, unknown>) => api(`/api/admin/email-campaigns/${id}/ai`, { method: "POST", body: JSON.stringify(body) });

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(null); setNotice(null);
    try { await fn(); } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  if (!c || !done) return <p className="text-[13px] text-[#9ba6b7]">{error || "Loading…"}</p>;

  const links = reviewLinks(c.body);
  const blanks = unresolvedTags(`${c.subject}\n${c.previewText}\n${c.body}`);
  const f = c.recipientFilter || {};
  const allDone = Object.values(done).every(Boolean);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className={btnGhost}>← Campaigns</button>
        <h3 className="text-[16px] font-semibold text-[#323a46] flex-1 truncate">{c.name}</h3>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${allDone ? "bg-[#1ab394]/15 text-[#1ab394]" : "bg-[#eef2f7] text-[#6c757d]"}`}>{allDone ? "READY" : "DRAFT"}</span>
      </div>
      {error && <p className="text-[13px] text-red-600" role="alert">{error}</p>}
      {notice && !error && <p className="text-[13px] text-[#1ab394]">{notice}</p>}

      {SECTIONS.map((s) => (
        <section key={s.key} className="ibox">
          <button onClick={() => setOpen(open === s.key ? null : s.key)} className="ibox-title w-full text-left" aria-expanded={open === s.key}>
            <span className="flex items-center gap-3">
              <span className={`h-5 w-5 rounded-full grid place-items-center text-[11px] ${done[s.key] ? "bg-[#1ab394] text-white" : "border border-[#c3c9d1] text-transparent"}`}>✓</span>
              <span><span className="text-sm font-semibold text-[#323a46] block">{s.title}</span><span className="text-[12px] text-[#9ba6b7]">{s.hint}</span></span>
            </span>
            <span className="text-[12px] text-[#1ab394]">{open === s.key ? "Close" : done[s.key] ? "Edit" : "Add"}</span>
          </button>

          {open === s.key && s.key === "subject" && (
            <div className="ibox-content space-y-3">
              <label className="block text-[12px] font-semibold text-[#6c757d]">Subject
                <input value={c.subject} onChange={(e) => edit({ subject: e.target.value })} className={`${inputCls} mt-1 font-normal`} maxLength={300} /></label>
              <ul className="text-[12px] space-y-0.5">{subjectChecks(c.subject).map((k) => <li key={k.label} className={k.ok ? "text-[#1ab394]" : "text-[#b7791f]"}>{k.ok ? "✓" : "•"} {k.label}</li>)}</ul>
              <label className="block text-[12px] font-semibold text-[#6c757d]">Preview text
                <input value={c.previewText} onChange={(e) => edit({ previewText: e.target.value })} className={`${inputCls} mt-1 font-normal`} maxLength={500} /></label>
              <ul className="text-[12px] space-y-0.5">{previewChecks(c.previewText).map((k) => <li key={k.label} className={k.ok ? "text-[#1ab394]" : "text-[#b7791f]"}>{k.ok ? "✓" : "•"} {k.label}</li>)}</ul>
              <div className="flex gap-2 flex-wrap">
                <button className={btnPrimary} disabled={busy !== null} onClick={() => save({ subject: c.subject, previewText: c.previewText })}>Save</button>
                <button className={btnGhost} disabled={busy !== null || !c.body.trim()} title={c.body.trim() ? "" : "Write the email body first"}
                  onClick={() => run("subjects", async () => { setOptions((await ai({ action: "subjects" })).options); })}>
                  {busy === "subjects" ? "Claude is thinking…" : "✦ Suggest with Claude"}</button>
              </div>
              {options.map((o, i) => (
                <button key={i} onClick={() => { edit({ subject: o.subject, previewText: o.previewText }); setNotice("Applied. Click Save to keep it."); }}
                  className="block w-full text-left rounded-md border border-[#e7e9eb] px-3 py-2 hover:border-[#1ab394]/50">
                  <span className="block text-[13.5px] text-[#323a46] font-semibold">{o.subject}</span><span className="block text-[12px] text-[#6c757d]">{o.previewText}</span></button>
              ))}
            </div>
          )}

          {open === s.key && s.key === "sender" && (
            <div className="ibox-content space-y-3">
              <label className="block text-[12px] font-semibold text-[#6c757d]">From name
                <input value={c.fromName} onChange={(e) => edit({ fromName: e.target.value })} className={`${inputCls} mt-1 font-normal`} maxLength={120} /></label>
              <label className="block text-[12px] font-semibold text-[#6c757d]">From email
                <input value={c.fromEmail} onChange={(e) => edit({ fromEmail: e.target.value })} className={`${inputCls} mt-1 font-normal`} inputMode="email" /></label>
              <label className="block text-[12px] font-semibold text-[#6c757d]">Reply-to (optional)
                <input value={c.replyTo || ""} onChange={(e) => edit({ replyTo: e.target.value || null })} className={`${inputCls} mt-1 font-normal`} inputMode="email" /></label>
              {c.fromEmail && !isEmail(c.fromEmail) && <p className="text-[12px] text-[#b7791f]">That doesn't look like a valid email address.</p>}
              <p className="text-[12px] text-[#9ba6b7]">Use an address on your own verified domain, not a free webmail address.</p>
              <button className={btnPrimary} disabled={busy !== null} onClick={() => save({ fromName: c.fromName, fromEmail: c.fromEmail, replyTo: c.replyTo })}>Save</button>
            </div>
          )}

          {open === s.key && s.key === "recipients" && (
            <div className="ibox-content space-y-3">
              <label className="block text-[12px] font-semibold text-[#6c757d]">Search (name, company, email or phone)
                <input value={f.q || ""} onChange={(e) => edit({ recipientFilter: { ...f, q: e.target.value } })} className={`${inputCls} mt-1 font-normal`} /></label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-[12px] font-semibold text-[#6c757d]">Status
                  <select value={f.status || ""} onChange={(e) => edit({ recipientFilter: { ...f, status: e.target.value } })} className={`${inputCls} mt-1 font-normal`}>
                    <option value="">All</option>{filters.statuses.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="block text-[12px] font-semibold text-[#6c757d]">Interest / track
                  <select value={f.track || ""} onChange={(e) => edit({ recipientFilter: { ...f, track: e.target.value } })} className={`${inputCls} mt-1 font-normal`}>
                    <option value="">All</option>{filters.tracks.map((x) => <option key={x}>{x}</option>)}</select></label>
              </div>
              <p className="text-[13px] text-[#323a46]">Saved audience: <b>{c.recipientCount.toLocaleString()}</b> contact{c.recipientCount === 1 ? "" : "s"}</p>
              <p className="text-[12px] text-[#9ba6b7]">The count is worked out on the server when you save. Nothing is sent to these contacts in this version.</p>
              <button className={btnPrimary} disabled={busy !== null} onClick={() => save({ recipientFilter: { q: f.q || "", status: f.status || "", track: f.track || "", gap: f.gap || "" } })}>Save and count</button>
            </div>
          )}

          {open === s.key && s.key === "design" && (
            <div className="ibox-content space-y-4">
              <div className="space-y-2">
                <div className="text-[12px] font-semibold text-[#6c757d]">Start from a template</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CAMPAIGN_TEMPLATES.map((t) => (
                    <button key={t.id} onClick={() => useTemplate(t)} className="text-left rounded-md border border-[#e7e9eb] px-3 py-2 hover:border-[#1ab394]/50">
                      <span className="block text-[11px] uppercase tracking-wider text-[#9ba6b7]">{t.category}</span>
                      <span className="block text-[13.5px] font-semibold text-[#323a46]">{t.name}</span>
                      <span className="block text-[12px] text-[#6c757d]">{t.description}</span>
                    </button>
                  ))}
                </div>
                {saved.length > 0 && <div className="text-[12px] font-semibold text-[#6c757d] pt-1">My templates</div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {saved.map((t) => (
                    <div key={t.id} className="rounded-md border border-[#e7e9eb] px-3 py-2 flex items-start gap-2">
                      <button onClick={() => useTemplate(t)} className="flex-1 text-left">
                        <span className="block text-[13.5px] font-semibold text-[#323a46]">{t.name}</span>
                        <span className="block text-[12px] text-[#6c757d] truncate">{t.subject || "No subject"}</span>
                      </button>
                      <button aria-label={`Delete template ${t.name}`} className="text-[12px] text-[#9ba6b7] hover:text-red-600"
                        onClick={() => { if (window.confirm(`Delete the template "${t.name}"? Campaigns made from it are not affected.`)) run("tpl-del", async () => { await api(`/api/admin/email-campaigns/${t.id}`, { method: "DELETE" }); loadSaved(); }); }}>Delete</button>
                    </div>
                  ))}
                </div>
                <p className="text-[11.5px] text-[#9ba6b7]">A template is only a starting point. Changing your email never changes the template.</p>
              </div>
              <div className="rounded-md border border-dashed border-[#1ab394]/50 p-3 space-y-2">
                <div className="text-[12px] font-semibold text-[#1ab394]">✦ Let Claude draft it</div>
                <input value={brief.goal} onChange={(e) => setBrief({ ...brief, goal: e.target.value })} placeholder="What is this email for? (required)" className={inputCls} maxLength={1000} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input value={brief.callToAction} onChange={(e) => setBrief({ ...brief, callToAction: e.target.value })} placeholder="Call to action, e.g. Book a tour" className={inputCls} maxLength={200} />
                  <input value={brief.callToActionLink} onChange={(e) => setBrief({ ...brief, callToActionLink: e.target.value })} placeholder="Link (https://…)" className={inputCls} maxLength={300} />
                </div>
                <input value={brief.include} onChange={(e) => setBrief({ ...brief, include: e.target.value })} placeholder="Anything to include or avoid (optional)" className={inputCls} maxLength={1000} />
                <button className={btnPrimary} disabled={busy !== null || !brief.goal.trim()} onClick={() => run("draft", async () => {
                  const d = (await ai({ action: "draft", ...brief })).draft;
                  edit({ subject: d.subject, previewText: d.previewText, body: d.body });
                  setNotice("Claude wrote a draft. Read it, edit freely, then click Save.");
                })}>{busy === "draft" ? "Claude is writing…" : "Write the draft"}</button>
              </div>
              <label className="block text-[12px] font-semibold text-[#6c757d]">Email body (plain text)
                <textarea value={c.body} onChange={(e) => edit({ body: e.target.value })} rows={12} maxLength={50000} className={`${inputCls} mt-1 font-normal leading-relaxed`} /></label>
              <div className="flex gap-2">
                <input value={rewrite} onChange={(e) => setRewrite(e.target.value)} placeholder="Ask Claude to change it, e.g. make it shorter and warmer" className={inputCls} maxLength={500} />
                <button className={btnGhost} disabled={busy !== null || !rewrite.trim() || !c.body.trim()} onClick={() => run("rewrite", async () => {
                  edit({ body: (await ai({ action: "rewrite", instruction: rewrite })).body }); setRewrite(""); setNotice("Rewritten. Read it, then click Save.");
                })}>{busy === "rewrite" ? "Rewriting…" : "✦ Rewrite"}</button>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <button className={btnPrimary} disabled={busy !== null} onClick={() => save({ body: c.body, subject: c.subject, previewText: c.previewText, designType: "plain" })}>Save</button>
                <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Name to save this email as a template" className={`${inputCls} flex-1 min-w-[12rem]`} maxLength={120} />
                <button className={btnGhost} disabled={busy !== null || !tplName.trim() || !c.body.trim()} onClick={() => run("tpl", async () => {
                  await save({ body: c.body, subject: c.subject, previewText: c.previewText, designType: "plain" }, "");
                  await api(`/api/admin/email-campaigns/${id}/save-as-template`, { method: "POST", body: JSON.stringify({ name: tplName }) });
                  setTplName(""); loadSaved(); setNotice("Saved as a template.");
                })}>Save as template</button>
              </div>
            </div>
          )}

          {open === s.key && s.key === "review" && (
            <div className="ibox-content space-y-4">
              <div className="rounded-md bg-[#f1f2f7] p-4 text-[13.5px] text-[#323a46] whitespace-pre-wrap leading-relaxed">
                <div className="text-[11px] uppercase tracking-wider text-[#9ba6b7]">Preview</div>
                <div className="font-semibold mt-1">{fillFirstName(c.subject, null) || "(no subject)"}</div>
                <div className="text-[12px] text-[#6c757d]">{c.fromName} &lt;{c.fromEmail}&gt;{c.previewText ? ` · ${fillFirstName(c.previewText, null)}` : ""}</div>
                <div className="mt-3">{fillFirstName(c.body, null) || "(no body yet)"}</div>
                <div className="mt-2 text-[11.5px] text-[#9ba6b7]">{"{{firstName}}"} shows as "there" here; each recipient's own first name is used when a list send is turned on.</div>
                <div className="mt-4 pt-3 border-t border-[#d9dde3] text-[12px] text-[#6c757d]">{VENUE_ADDRESS}</div>
              </div>
              {blanks.length > 0 && (
                <div className="rounded-md border border-[#f5a623]/60 bg-[#fffaf0] px-3 py-2 text-[12.5px] text-[#b7791f]">
                  Fill in these blanks before this campaign can be ready: {blanks.map((t) => `{{${t}}}`).join(", ")}
                </div>
              )}
              <div>
                <div className="text-[12px] font-semibold text-[#6c757d] mb-1">Link review</div>
                {links.links.length === 0 && <p className="text-[12.5px] text-[#9ba6b7]">No links in the email.</p>}
                {links.links.map((u) => { const bad = links.issues.find((i) => i.url === u); return <p key={u} className={`text-[12.5px] break-all ${bad ? "text-[#b7791f]" : "text-[#1ab394]"}`}>{bad ? `• ${u} — ${bad.problem}` : `✓ ${u}`}</p>; })}
                <p className="text-[11.5px] text-[#9ba6b7] mt-1">This checks the link format only. It doesn't open the links.</p>
              </div>
              <div className="space-y-2">
                <div className="text-[12px] font-semibold text-[#6c757d]">Send a test (up to {MAX_TEST_ADDRESSES} addresses, separated by commas)</div>
                <div className="flex gap-2">
                  <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" className={inputCls} inputMode="email" />
                  <button className={btnPrimary} disabled={busy !== null || !testTo.trim()} onClick={() => run("test", async () => {
                    const d = await api(`/api/admin/email-campaigns/${id}/test`, { method: "POST", body: JSON.stringify({ to: testTo.split(/[,\s;]+/).filter(Boolean) }) });
                    setNotice(d.results.every((r: any) => r.mode === "DRY_RUN") ? "Dry run: nothing was actually sent (email sending is not live in this environment)." : `Test sent to ${d.results.length} address${d.results.length === 1 ? "" : "es"}.`);
                    setC((await api(`/api/admin/email-campaigns/${id}`)).campaign);
                  })}>{busy === "test" ? "Sending…" : "Send test"}</button>
                </div>
                {c.testSends?.slice(-3).reverse().map((t) => <p key={t.at} className="text-[12px] text-[#9ba6b7]">{new Date(t.at).toLocaleString()} → {t.results.map((r) => `${r.to} (${r.mode})`).join(", ")}</p>)}
              </div>
            </div>
          )}
        </section>
      ))}

      <section className="ibox">
        <div className="ibox-content">
          <div className="text-sm font-semibold text-[#323a46]">Send</div>
          <p className="mt-1 text-[13px] text-[#6c757d] leading-relaxed">
            {allDone ? "Everything on the checklist is done." : "Finish the checklist above."} Sending to a whole list is switched off in this version, so nothing here can reach your {c.recipientCount.toLocaleString()} recipients.
            It will be turned on later with unsubscribe links, your address footer and opt-in checks in place.
          </p>
          <button disabled className={`${btnPrimary} mt-3`}>Send to list (not available yet)</button>
        </div>
      </section>
    </div>
  );
}

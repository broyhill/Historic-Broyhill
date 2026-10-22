"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { applyOps, linksIn, type Op } from "@/lib/studio-commands";
import { BLOCK_TYPES, allowedFrom, buildPrompt, VENUE_ADDRESS, defaultBrand, designIssues, duplicateBlock, moveBlock, newBlock, newId, normalizeDesign, renderHtml, type Block, type BlockType, type Brand } from "@/lib/studio";
import { defaultSettings, type TemplateSettings } from "@/lib/template-categories";

interface Photo { url: string; folder: string; name: string }
interface SavedDesign { id: string; name: string; updatedAt: string; studio: { blocks: Block[]; brand: Brand } }

const inputCls = "w-full rounded-md border border-[#e7e9eb] px-3 py-2 text-[14px] text-[#323a46] focus:outline-none focus:border-[#1ab394]";
const btnPrimary = "h-9 px-4 rounded-md bg-[#1ab394] text-white text-[13px] font-semibold disabled:opacity-50";
const btnGhost = "h-8 px-3 rounded-md border border-[#e7e9eb] text-[#6c757d] text-[12.5px] hover:border-[#1ab394]/50 disabled:opacity-50";
const lbl = "text-[12px] font-semibold text-[#6c757d]";

type Device = "mobile" | "ipad" | "laptop" | "desktop";
const DEVICES: Record<Device, { label: string; width: number }> = {
  mobile: { label: "Mobile", width: 390 },
  ipad: { label: "iPad", width: 820 },
  laptop: { label: "Laptop", width: 1440 },
  desktop: { label: "Desktop", width: 1920 },
};
const PREVIEW_H = 620;

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (res.status === 401) { window.location.assign("/admin/login"); throw new Error("Signed out"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function StudioPanel({ openId }: { openId?: string | null }) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [brand, setBrand] = useState<Brand>(defaultBrand());
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [category, setCategory] = useState("");
  const [kind, setKind] = useState("");
  const [tset, setTset] = useState<TemplateSettings>(defaultSettings());
  const [saved, setSaved] = useState<SavedDesign[]>([]);
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [view, setView] = useState<Device>("desktop");
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(520);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el); setBoxW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  // Wide screens are shown shrunk to fit the panel, so the email is laid out at the real screen width.
  const scale = Math.min(1, Math.max(0.2, (boxW - 24) / DEVICES[view].width));
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [goal, setGoal] = useState("");
  const [suggest, setSuggest] = useState<{ blockId: string; options: string[] } | null>(null);
  const [review, setReview] = useState<{ suggestions: string[]; subjects: { subject: string; previewText: string }[] } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [direction, setDirection] = useState("");
  const [alts, setAlts] = useState<{ name: string; design: { blocks: Block[]; brand: Brand } }[] | null>(null);
  const [strip, setStrip] = useState<"ideas" | "templates">("ideas");
  const [past, setPast] = useState<{ snap: { blocks: Block[]; brand: Brand }; label: string }[]>([]);
  const [future, setFuture] = useState<{ snap: { blocks: Block[]; brand: Brand }; label: string }[]>([]);
  const [log, setLog] = useState<{ id: number; text: string; kind: "you" | "claude" | "done" | "skip" }[]>([]);
  const [cmd, setCmd] = useState("");
  const [aiCount, setAiCount] = useState(0);

  const refreshSaved = () => call("/api/admin/studio").then((d) => setSaved(d.designs)).catch(() => {});
  useEffect(() => {
    refreshSaved();
    call("/api/admin/template-settings").then((d) => setTset(d.settings)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Coming from the Templates list: open that design straight away.
  useEffect(() => { if (openId) openDesign(openId); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const design = useMemo(() => normalizeDesign({ blocks, brand }), [blocks, brand]);
  const html = useMemo(() => renderHtml(design, { title: subject || name || "Preview" }), [design, subject, name]);
  const issues = useMemo(() => designIssues(design), [design]);
  const issueFor = (bid: string) => issues.find((i) => i.blockId === bid)?.message;

  const change = (next: Block[]) => { setBlocks(next); setDirty(true); };
  const addLog = (entries: { text: string; kind: "you" | "claude" | "done" | "skip" }[]) =>
    setLog((l) => [...l, ...entries.map((e, k) => ({ id: Date.now() + k + Math.random(), ...e }))].slice(-60));
  // Every AI change goes through here, so each one can be undone and redone.
  const record = (label: string, nextBlocks: Block[], nextBrand: Brand) => {
    setPast((p) => [...p.slice(-29), { snap: { blocks, brand }, label }]); setFuture([]);
    setBlocks(nextBlocks); setBrand(nextBrand); setDirty(true);
  };
  const undoStep = () => {
    const last = past[past.length - 1]; if (!last) return;
    setFuture((f) => [{ snap: { blocks, brand }, label: last.label }, ...f]); setPast((p) => p.slice(0, -1));
    setBlocks(last.snap.blocks); setBrand(last.snap.brand); setDirty(true); addLog([{ text: `Undid: ${last.label}`, kind: "done" }]);
  };
  const redoStep = () => {
    const next = future[0]; if (!next) return;
    setPast((p) => [...p, { snap: { blocks, brand }, label: next.label }]); setFuture((f) => f.slice(1));
    setBlocks(next.snap.blocks); setBrand(next.snap.brand); setDirty(true); addLog([{ text: `Redid: ${next.label}`, kind: "done" }]);
  };
  const patch = (bid: string, p: Partial<Block>) => change(blocks.map((b) => (b.id === bid ? ({ ...b, ...p } as Block) : b)));
  const add = (type: BlockType) => { const b = newBlock(type); change([...blocks, b]); setOpen(b.id); };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setError(""); setNotice("");
    try { await fn(); } catch (e: any) { setError(e.message || "Something went wrong."); } finally { setBusy(null); }
  };

  const startNew = () => {
    if (dirty && !confirm("You have changes that aren't saved. Start a new design anyway?")) return;
    setId(null); setName(""); setSubject(""); setPreviewText(""); setCategory(""); setKind(""); setBlocks([]); setBrand(defaultBrand()); setOpen(null); setReview(null); setSuggest(null); setAlts(null); setPast([]); setFuture([]); setLog([]); setDirty(false); setNotice(""); setError("");
  };

  const openDesign = (did: string) => run("open", async () => {
    if (dirty && !confirm("You have changes that aren't saved. Open another design anyway?")) return;
    const { design: d } = await call(`/api/admin/studio?id=${encodeURIComponent(did)}`);
    setId(d.id); setName(d.name); setSubject(d.subject); setPreviewText(d.previewText); setCategory(d.category); setKind(d.kind);
    setBlocks(d.studio.blocks); setBrand(d.studio.brand); setOpen(null); setReview(null); setSuggest(null); setAlts(null); setPast([]); setFuture([]); setLog([]); setDirty(false);
  });

  const save = () => run("save", async () => {
    const d = await call("/api/admin/studio", post({ id, name, subject, previewText, category, kind, studio: design }));
    setId(d.design.id); setDirty(false); setNotice("Saved. It's now in your template list as an email template."); refreshSaved();
  });

  const remove = () => run("delete", async () => {
    if (!id || !confirm(`Delete "${name}"? This can't be undone.`)) return;
    await call(`/api/admin/studio?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setId(null); setBlocks([]); setName(""); setDirty(false); setNotice("Deleted."); refreshSaved();
  });

  const ai = (body: Record<string, unknown>) => call("/api/admin/studio/ai", post({ ...body, studio: design }));

  const draft = () => run("draft", async () => {
    if (blocks.length && !confirm("This adds Claude's draft after your current blocks. Continue?")) return;
    const { draft: d } = await ai({ action: "draft", goal });
    const added: Block[] = [
      { id: newId(), type: "heading", text: d.heading, align: "left" },
      ...d.paragraphs.map((p: string): Block => ({ id: newId(), type: "text", text: p, align: "left" })),
      { id: newId(), type: "button", label: d.buttonLabel, link: "", align: "center" },
    ];
    record("Added Claude's draft", [...blocks, ...added], brand); setAiCount((c) => c + 1);
    addLog([{ text: `Draft: ${goal}`, kind: "you" }, { text: "Added a heading, text and a button. Read it, edit it, and add a link to the button.", kind: "claude" }]);
    setNotice("Claude's draft was added. Read it, edit it, and add a link to the button.");
  });

  const rewrite = (b: Block, instruction: string) => run(`rw-${b.id}`, async () => {
    if (b.type !== "heading" && b.type !== "text") return;
    const { options } = await ai({ action: "rewrite", text: b.text, blockType: b.type, instruction });
    setSuggest({ blockId: b.id, options });
  });

  const redesign = (like?: string) => run("redesign", async () => {
    let lib = photos;
    if (lib === null) {
      lib = await call("/api/admin/photos").then((d) => (d.photos || []).filter((p: Photo) => /\.(jpe?g|png|gif|webp)$/i.test(p.name))).catch(() => []);
      setPhotos(lib);
    }
    const r = await ai({ action: "redesign", direction, like, photos: (lib || []).slice(0, 40).map((p) => ({ url: p.url, name: p.name })) });
    setAlts(r.alternatives); setStrip("ideas");
  });

  const useAlt = (a: { name: string; design: { blocks: Block[]; brand: Brand } }) => {
    record(`Used the “${a.name}” design`, a.design.blocks, a.design.brand); setOpen(null); setAlts(null);
    addLog([{ text: `Switched to the “${a.name}” design.`, kind: "done" }]);
    setNotice(`"${a.name}" is now your design. Click any block to edit it, or press Undo to go back.`);
  };

  const runCommand = () => run("command", async () => {
    const text = cmd.trim(); if (!text) return;
    let lib = photos;
    if (lib === null) {
      lib = await call("/api/admin/photos").then((d) => (d.photos || []).filter((p: Photo) => /\.(jpe?g|png|gif|webp)$/i.test(p.name))).catch(() => []);
      setPhotos(lib);
    }
    const r = await ai({ action: "command", instruction: text, photos: (lib || []).slice(0, 40).map((p) => ({ url: p.url, name: p.name })) });
    // Links the person typed in the command are allowed; links Claude made up are not.
    const allowed = allowedFrom(design, (lib || []).map((p) => p.url));
    linksIn(text).forEach((u) => allowed.links.add(u));
    const res = applyOps(design, r.ops as Op[], allowed);
    const entries: { text: string; kind: "you" | "claude" | "done" | "skip" }[] = [{ text, kind: "you" }];
    if (r.reply) entries.push({ text: r.reply, kind: "claude" });
    res.applied.forEach((t) => entries.push({ text: t, kind: "done" }));
    res.skipped.forEach((t) => entries.push({ text: t, kind: "skip" }));
    if (res.applied.length) record(text.slice(0, 60), res.design.blocks, res.design.brand);
    addLog(entries); setAiCount((c) => c + 1); setCmd("");
  });

  const copyPrompt = () => run("prompt", async () => {
    await navigator.clipboard.writeText(buildPrompt(design, { name, subject, previewText, category, kind }));
    setNotice("Prompt copied. Paste it into any AI to recreate or remix this email (for example “same, but for Novant”).");
  });
  const downloadHtml = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = `${(name || "email").replace(/[^\w-]+/g, "-")}.html`; a.click();
    setNotice("Downloaded the email as an .html file. Nothing was sent.");
  };

  const getReview = () => run("review", async () => { const r = await ai({ action: "review" }); setReview({ suggestions: r.suggestions, subjects: r.subjects }); });

  const openPicker = (bid: string) => {
    setPickFor(bid);
    if (photos === null) call("/api/admin/photos").then((d) => setPhotos((d.photos || []).filter((p: Photo) => /\.(jpe?g|png|gif|webp)$/i.test(p.name)))).catch((e) => { setPhotos([]); setError(e.message); });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputCls} !w-auto`} value={id ?? ""} onChange={(e) => (e.target.value ? openDesign(e.target.value) : startNew())}>
          <option value="">New design</option>
          {saved.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input className={`${inputCls} !w-64`} placeholder="Name this design" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
        <select className={`${inputCls} !w-auto`} value={category} onChange={(e) => { setCategory(e.target.value); setDirty(true); }}>
          <option value="">No category</option>{tset.categories.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className={`${inputCls} !w-auto`} value={kind} onChange={(e) => { setKind(e.target.value); setDirty(true); }}>
          <option value="">No type</option>{tset.kinds.map((k) => <option key={k}>{k}</option>)}
        </select>
        <button className={btnGhost} disabled={busy !== null || blocks.length === 0} onClick={copyPrompt}>Copy prompt</button>
        <button className={btnGhost} disabled={blocks.length === 0} onClick={downloadHtml}>Download HTML</button>
      </div>
      {notice && <p className="text-[13px] text-[#1a7f68]">{notice}</p>}
      {error && <p className="text-[13px] text-[#b83232]">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(360px,1fr)]">
        {/* Stage: the live preview, with Claude's alternative designs underneath */}
        <div className="space-y-3 min-w-0">
          <div className="rounded-2xl bg-[#14171a] p-4">
            <div className="mb-2 flex items-center justify-between text-[12px] text-[#8b95a1]">
              <span>{DEVICES[view].label} · {DEVICES[view].width} px wide</span>
              <span>Preview only. Sending is off.</span>
            </div>
            <div ref={boxRef} className="flex justify-center">
              <div style={{ width: DEVICES[view].width * scale, height: PREVIEW_H }} className={`overflow-hidden bg-white ${view === "mobile" || view === "ipad" ? "rounded-[26px] border-[7px] border-[#2b2f36]" : "rounded border border-[#2b2f36]"}`}>
                <iframe
                  title="Email preview"
                  sandbox=""
                  srcDoc={html}
                  style={{ width: DEVICES[view].width, height: PREVIEW_H / scale, transform: `scale(${scale})`, transformOrigin: "top left", border: 0, background: "#fff" }}
                />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {log.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-[#1c2024] p-2 text-[12.5px]" aria-label="What the assistant did">
                  {log.map((e) => (
                    <li key={e.id} className={e.kind === "you" ? "text-[#e8eaed]" : e.kind === "claude" ? "text-[#9ad7c6]" : e.kind === "done" ? "text-[#8b95a1]" : "text-[#e2b24a]"}>
                      {e.kind === "you" ? "You: " : e.kind === "claude" ? "Claude: " : e.kind === "done" ? "✓ " : "– "}{e.text}
                    </li>
                  ))}
                </ul>
              )}
              <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); runCommand(); }}>
                <input className="h-10 flex-1 rounded-lg border border-[#2b2f36] bg-[#1c2024] px-3 text-[14px] text-[#e8eaed] placeholder:text-[#6c757d] focus:outline-none focus:border-[#1ab394]"
                  placeholder="Give me a command to edit the email (e.g. make the intro shorter)" value={cmd} onChange={(e) => setCmd(e.target.value)} aria-label="Command for the assistant" />
                <button type="submit" disabled={busy !== null || !cmd.trim() || blocks.length === 0} className="h-10 rounded-lg bg-[#1ab394] px-4 text-[13px] font-semibold text-white disabled:opacity-50">{busy === "command" ? "Working…" : "Send"}</button>
                <button type="button" onClick={undoStep} disabled={past.length === 0} aria-label="Undo" title={past.length ? `Undo: ${past[past.length - 1].label}` : "Nothing to undo"} className="h-10 w-10 rounded-lg border border-[#2b2f36] text-[#e8eaed] disabled:opacity-40">↶</button>
                <button type="button" onClick={redoStep} disabled={future.length === 0} aria-label="Redo" title={future.length ? `Redo: ${future[0].label}` : "Nothing to redo"} className="h-10 w-10 rounded-lg border border-[#2b2f36] text-[#e8eaed] disabled:opacity-40">↷</button>
              </form>
              <div className="flex justify-between text-[11.5px] text-[#6c757d]"><span>Each change can be undone. Claude only uses links already in your email or typed in your command, and pictures from your library.</span><span>{aiCount} AI action{aiCount === 1 ? "" : "s"} this session</span></div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#e7e9eb] bg-white p-3">
            <div className="mb-2 flex items-center gap-2">
              {(["ideas", "templates"] as const).map((t) => (
                <button key={t} onClick={() => setStrip(t)} className={`text-[14px] font-semibold ${strip === t ? "text-[#323a46]" : "text-[#9ba6b7] hover:text-[#6c757d]"}`}>
                  {t === "ideas" ? "Ideas from Claude" : "My templates"}
                  <span className="ml-1.5 rounded-full bg-[#eef0f2] px-2 text-[11.5px] font-normal text-[#6c757d]">{t === "ideas" ? alts?.length ?? 0 : saved.length}</span>
                </button>
              ))}
            </div>
            {strip === "ideas" ? (
              !alts ? (
                <p className="text-[12.5px] text-[#9ba6b7]">{busy === "redesign" ? "Claude is designing three alternatives…" : "Press Redesign in the panel on the right and three alternatives will appear here."}</p>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {alts.map((a, k) => (
                    <div key={k} className="w-[220px] shrink-0 space-y-1">
                      <Thumb design={a.design} title={a.name} />
                      <div className="text-[12.5px] font-semibold text-[#323a46] truncate">{a.name}</div>
                      <div className="flex gap-1">
                        <button className={btnGhost} onClick={() => useAlt(a)}>Use this</button>
                        <button className={btnGhost} disabled={busy !== null} onClick={() => redesign(a.name)}>More like this</button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : saved.length === 0 ? (
              <p className="text-[12.5px] text-[#9ba6b7]">Nothing saved yet. Build an email and press Save as template, and it will show up here.</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {saved.map((d) => (
                  <div key={d.id} className="w-[220px] shrink-0 space-y-1">
                    <button className="block w-full text-left" onClick={() => openDesign(d.id)} aria-label={`Open ${d.name}`}><Thumb design={d.studio} title={d.name} /></button>
                    <div className="flex items-center justify-between gap-1">
                      <div className={`truncate text-[12.5px] font-semibold ${d.id === id ? "text-[#1ab394]" : "text-[#323a46]"}`}>{d.name}</div>
                      <button className={btnGhost} disabled={busy !== null || d.id === id} onClick={() => openDesign(d.id)}>{d.id === id ? "Open" : "Open"}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-1 pt-2 text-[14px] font-semibold text-[#323a46]">Instructions on how to use</div>
          <div className="space-y-2 rounded-2xl border border-[#e7e9eb] bg-white p-2">
            <Fold n="01" title="Start with a draft or a template" open>Type what the email is for under Draft on the right and press Draft, or open one of My templates under the preview. Everything Claude writes is a suggestion you can change.</Fold>
            <Fold n="02" title="Build it block by block">Add a heading, text, picture, button, divider or spacer. Click a block to edit it, and use the arrows to move it. Pictures come from your Photo Library.</Fold>
            <Fold n="03" title="Ask Claude for a more designed version">Press Redesign. Three alternatives appear under the preview. Press Use this to switch to one, and keep editing it. The undo arrow under the preview takes you back.</Fold>
            <Fold n="04" title="Check every screen size">Use Mobile, iPad, Laptop and Desktop at the bottom right to see how it looks. Most people read email on a phone, so check Mobile last.</Fold>
            <Fold n="05" title="Save it">Name it, pick a category and type, then Save as template. It appears in My templates here and in the Templates list. Nothing is sent from the Studio.</Fold>
          </div>

          <div className="px-1 pt-2 text-[14px] font-semibold text-[#323a46]">Coming next</div>
          <div className="space-y-2 rounded-2xl border border-dashed border-[#d9dde3] bg-[#fafbfc] p-2">
            <Fold n="•" title="Send a test to yourself">Not built yet. It will be turned on together with consent and unsubscribe handling, so nothing goes out before the safeguards are in place.</Fold>
            <Fold n="•" title="Different content for different groups">Not built yet. Show one version of a section to weddings, another to chambers, and so on, using the same segments as your categories.</Fold>
            <Fold n="•" title="Funnel templates">Not built yet. Saved wedding, corporate, community and office-suite sequences you can start from.</Fold>
            <Fold n="•" title="Results">Not built yet. Opens, clicks and replies per design, once sending is live.</Fold>
          </div>
        </div>

        {/* Control panel */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-[#e7e9eb] bg-white lg:sticky lg:top-4 lg:h-[calc(100vh-170px)] lg:min-h-[560px]">
        <div className="flex-1 space-y-3 overflow-y-auto p-3">
          <div className="rounded-lg border border-[#e7e9eb] bg-white p-3 grid gap-2 sm:grid-cols-2">
            <label className="block"><span className={lbl}>Subject</span><input className={inputCls} value={subject} onChange={(e) => { setSubject(e.target.value); setDirty(true); }} /></label>
            <label className="block"><span className={lbl}>Preview text</span><input className={inputCls} value={previewText} onChange={(e) => { setPreviewText(e.target.value); setDirty(true); }} /></label>
            <label className="block"><span className={lbl}>Button color</span><input type="color" className="h-9 w-full rounded-md border border-[#e7e9eb]" value={brand.accent} onChange={(e) => { setBrand({ ...brand, accent: e.target.value }); setDirty(true); }} /></label>
            <label className="block"><span className={lbl}>Letters</span>
              <select className={inputCls} value={brand.font} onChange={(e) => { setBrand({ ...brand, font: e.target.value === "sans" ? "sans" : "serif" }); setDirty(true); }}>
                <option value="serif">Classic (serif)</option><option value="sans">Clean (sans-serif)</option>
              </select></label>
          </div>

          <ol className="space-y-2">
            {blocks.map((b, i) => (
              <li key={b.id} className={`rounded-lg border bg-white ${issueFor(b.id) ? "border-[#e2b24a]" : "border-[#e7e9eb]"}`}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <button className="flex-1 text-left text-[13.5px] font-semibold text-[#323a46] capitalize" onClick={() => setOpen(open === b.id ? null : b.id)}>
                    {b.type}
                    <span className="ml-2 font-normal text-[#9ba6b7] normal-case">{b.type === "heading" || b.type === "text" ? b.text.slice(0, 40) : b.type === "button" ? b.label : b.type === "image" ? b.alt : ""}</span>
                  </button>
                  <button className={btnGhost} disabled={i === 0} onClick={() => change(moveBlock(blocks, b.id, -1))} aria-label="Move up">↑</button>
                  <button className={btnGhost} disabled={i === blocks.length - 1} onClick={() => change(moveBlock(blocks, b.id, 1))} aria-label="Move down">↓</button>
                  <button className={btnGhost} onClick={() => change(duplicateBlock(blocks, b.id))}>Copy</button>
                  <button className={btnGhost} onClick={() => change(blocks.filter((x) => x.id !== b.id))}>Remove</button>
                </div>
                {issueFor(b.id) && <p className="px-3 pb-2 text-[12px] text-[#b7791f]">{issueFor(b.id)}</p>}
                {open === b.id && (
                  <div className="border-t border-[#e7e9eb] p-3 space-y-2">
                    {(b.type === "heading" || b.type === "text") && (
                      <>
                        {b.type === "heading"
                          ? <input className={inputCls} value={b.text} onChange={(e) => patch(b.id, { text: e.target.value })} />
                          : <textarea className={inputCls} rows={5} value={b.text} onChange={(e) => patch(b.id, { text: e.target.value })} />}
                        <AlignPick value={b.align} onChange={(a) => patch(b.id, { align: a })} />
                        <div className="flex flex-wrap gap-2">
                          {["Make it warmer", "Make it shorter", "Make it more formal"].map((ins) => (
                            <button key={ins} className={btnGhost} disabled={busy !== null || !b.text.trim()} onClick={() => rewrite(b, ins)}>{busy === `rw-${b.id}` ? "…" : ins}</button>
                          ))}
                        </div>
                        {suggest?.blockId === b.id && (
                          <div className="space-y-2">
                            {suggest.options.map((o, k) => (
                              <div key={k} className="rounded-md bg-[#f6f7f8] p-2 text-[13px] text-[#323a46] whitespace-pre-wrap">
                                {o}
                                <div className="mt-1"><button className={btnGhost} onClick={() => { patch(b.id, { text: o }); setSuggest(null); }}>Use this</button></div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                    {b.type === "image" && (
                      <>
                        <div className="flex gap-2">
                          <input className={inputCls} placeholder="Picture web address (https://…)" value={b.url} onChange={(e) => patch(b.id, { url: e.target.value })} />
                          <button className={btnGhost} onClick={() => openPicker(b.id)}>From library</button>
                        </div>
                        <input className={inputCls} placeholder="Short description of the picture" value={b.alt} onChange={(e) => patch(b.id, { alt: e.target.value })} />
                        <input className={inputCls} placeholder="Link when clicked (optional)" value={b.link} onChange={(e) => patch(b.id, { link: e.target.value })} />
                        {pickFor === b.id && (
                          <div className="rounded-md border border-[#e7e9eb] p-2">
                            {photos === null ? <p className="text-[12px] text-[#9ba6b7]">Loading…</p> : photos.length === 0 ? <p className="text-[12px] text-[#9ba6b7]">No photos available (the photo store may not be connected yet).</p> : (
                              <div className="grid grid-cols-4 gap-2 max-h-56 overflow-auto">
                                {photos.map((p) => (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <button key={p.url} onClick={() => { patch(b.id, { url: p.url, alt: b.alt || p.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") }); setPickFor(null); }}>
                                    <img src={p.url} alt={p.name} className="h-16 w-full object-cover rounded" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                    {b.type === "button" && (
                      <>
                        <input className={inputCls} placeholder="Button words" value={b.label} onChange={(e) => patch(b.id, { label: e.target.value })} />
                        <input className={inputCls} placeholder="Where it goes (https://…)" value={b.link} onChange={(e) => patch(b.id, { link: e.target.value })} />
                        <AlignPick value={b.align} onChange={(a) => patch(b.id, { align: a })} />
                      </>
                    )}
                    {b.type === "spacer" && (
                      <label className="block"><span className={lbl}>Height ({b.height}px)</span>
                        <input type="range" min={8} max={80} value={b.height} onChange={(e) => patch(b.id, { height: Number(e.target.value) })} className="w-full" /></label>
                    )}
                    {b.type === "divider" && <p className="text-[12px] text-[#9ba6b7]">A thin line between sections.</p>}
                  </div>
                )}
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap gap-2">
            {BLOCK_TYPES.map((t) => <button key={t.type} className={btnGhost} onClick={() => add(t.type)}>+ {t.label}</button>)}
          </div>

          <div className="rounded-lg border border-dashed border-[#d9dde3] bg-[#fafbfc] p-3 text-[12px] text-[#6c757d]">
            <strong>Footer (locked):</strong> {VENUE_ADDRESS} and an unsubscribe link are added to every email automatically. You can't remove or change them here.
          </div>
        </div>
        {/* Claude's tools sit right under the edit controls and above the master buttons */}
        <div className="max-h-[40%] space-y-2 overflow-y-auto border-t border-[#e7e9eb] bg-[#fafbfc] p-3">
          <div className="rounded-lg border border-[#e7e9eb] bg-white p-3 space-y-2">
            <div className={lbl}>Ask Claude for a first draft</div>
            <div className="flex gap-2">
              <input className={inputCls} placeholder="e.g. Invite past wedding clients to a spring open house" value={goal} onChange={(e) => setGoal(e.target.value)} />
              <button className={btnGhost} disabled={busy !== null || !goal.trim()} onClick={draft}>{busy === "draft" ? "Writing…" : "Draft"}</button>
            </div>
          </div>

          <div className="rounded-lg border border-[#e7e9eb] bg-white p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className={lbl}>Ask Claude for a more designed version</div>
            </div>
            <div className="flex gap-2">
              <input className={inputCls} placeholder="Optional: more elegant, more photos, bolder…" value={direction} onChange={(e) => setDirection(e.target.value)} />
              <button className={btnGhost} disabled={busy !== null || blocks.length === 0} onClick={() => redesign()}>{busy === "redesign" ? "Designing…" : "Redesign"}</button>
            </div>
            <p className="text-[11.5px] text-[#9ba6b7]">Claude keeps your facts and links and only uses pictures from your library. Read the result before you save.</p>
          </div>

          <div className="rounded-lg border border-[#e7e9eb] bg-white p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className={lbl}>Ask Claude to review the whole email</div>
              <button className={btnGhost} disabled={busy !== null || issues.some((i) => i.message.startsWith("Add some text"))} onClick={getReview}>{busy === "review" ? "Reading…" : "Review"}</button>
            </div>
            {review && (
              <div className="space-y-2 text-[13px] text-[#323a46]">
                <ul className="list-disc pl-5 space-y-1">{review.suggestions.map((s, k) => <li key={k}>{s}</li>)}</ul>
                {review.subjects.map((s, k) => (
                  <div key={k} className="rounded-md bg-[#f6f7f8] p-2">
                    <div className="font-semibold">{s.subject}</div><div className="text-[#6c757d]">{s.previewText}</div>
                    <button className={`${btnGhost} mt-1`} onClick={() => { setSubject(s.subject); setPreviewText(s.previewText); setDirty(true); }}>Use these</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Master control: screen sizes and save, always visible at the bottom of the panel */}
        <div className="border-t border-[#e7e9eb] bg-[#fafbfc] p-3 space-y-2">
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(DEVICES) as Device[]).map((d) => (
              <button key={d} onClick={() => setView(d)} aria-pressed={view === d}
                className={`flex flex-col items-center gap-1 rounded-lg border py-2 text-[12px] font-semibold ${view === d ? "border-[#1ab394] text-[#1ab394] bg-white" : "border-[#e7e9eb] text-[#6c757d] bg-white hover:border-[#1ab394]/50"}`}>
                <DeviceIcon device={d} />{DEVICES[d].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button className={`${btnPrimary} flex-1`} disabled={busy !== null || !name.trim()} onClick={save}>{busy === "save" ? "Saving…" : "Save as template"}</button>
            {id && <button className={btnGhost} disabled={busy !== null} onClick={remove}>Delete</button>}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

function Fold({ n, title, open: startOpen, children }: { n: string; title: string; open?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(Boolean(startOpen));
  return (
    <div className="rounded-xl bg-[#f6f7f8]">
      <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[11.5px] font-semibold text-[#6c757d]">{n}</span>
        <span className="flex-1 text-[13.5px] font-semibold text-[#323a46]">{title}</span>
        <span className="text-[#9ba6b7]">{open ? "−" : "+"}</span>
      </button>
      {open && <p className="px-3 pb-3 pl-[52px] text-[13px] leading-relaxed text-[#6c757d]">{children}</p>}
    </div>
  );
}

function Thumb({ design, title }: { design: { blocks: Block[]; brand: Brand }; title: string }) {
  return (
    <div className="h-64 overflow-hidden rounded-lg border border-[#d9dde3] bg-white">
      <iframe title={`Thumbnail ${title}`} sandbox="" tabIndex={-1} srcDoc={renderHtml(design, { title })} className="pointer-events-none" style={{ width: 600, height: 900, border: 0, transform: "scale(0.366)", transformOrigin: "top left" }} />
    </div>
  );
}

function DeviceIcon({ device }: { device: Device }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...p}>
      {device === "mobile" && <><rect x="8" y="3" width="8" height="18" rx="2" /><path d="M11 18h2" /></>}
      {device === "ipad" && <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M11 18h2" /></>}
      {device === "laptop" && <><rect x="5" y="5" width="14" height="10" rx="1.5" /><path d="M3 19h18" /></>}
      {device === "desktop" && <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M9 20h6M12 16v4" /></>}
    </svg>
  );
}

function AlignPick({ value, onChange }: { value: "left" | "center" | "right"; onChange: (a: "left" | "center" | "right") => void }) {
  return (
    <div className="flex gap-1">
      {(["left", "center", "right"] as const).map((a) => (
        <button key={a} className={`${btnGhost} ${value === a ? "!border-[#1ab394] !text-[#1ab394]" : ""}`} onClick={() => onChange(a)}>{a}</button>
      ))}
    </div>
  );
}

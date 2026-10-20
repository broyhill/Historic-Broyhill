"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BLOCK_TYPES, VENUE_ADDRESS, defaultBrand, designIssues, duplicateBlock, moveBlock, newBlock, newId, normalizeDesign, renderHtml, type Block, type BlockType, type Brand } from "@/lib/studio";
import { defaultSettings, type TemplateSettings } from "@/lib/template-categories";

interface Photo { url: string; folder: string; name: string }
interface SavedDesign { id: string; name: string; updatedAt: string }

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
const PREVIEW_H = 640;

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
  const [undo, setUndo] = useState<{ blocks: Block[]; brand: Brand } | null>(null);

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
  const patch = (bid: string, p: Partial<Block>) => change(blocks.map((b) => (b.id === bid ? ({ ...b, ...p } as Block) : b)));
  const add = (type: BlockType) => { const b = newBlock(type); change([...blocks, b]); setOpen(b.id); };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setError(""); setNotice("");
    try { await fn(); } catch (e: any) { setError(e.message || "Something went wrong."); } finally { setBusy(null); }
  };

  const startNew = () => {
    if (dirty && !confirm("You have changes that aren't saved. Start a new design anyway?")) return;
    setId(null); setName(""); setSubject(""); setPreviewText(""); setCategory(""); setKind(""); setBlocks([]); setBrand(defaultBrand()); setOpen(null); setReview(null); setSuggest(null); setAlts(null); setUndo(null); setDirty(false); setNotice(""); setError("");
  };

  const openDesign = (did: string) => run("open", async () => {
    if (dirty && !confirm("You have changes that aren't saved. Open another design anyway?")) return;
    const { design: d } = await call(`/api/admin/studio?id=${encodeURIComponent(did)}`);
    setId(d.id); setName(d.name); setSubject(d.subject); setPreviewText(d.previewText); setCategory(d.category); setKind(d.kind);
    setBlocks(d.studio.blocks); setBrand(d.studio.brand); setOpen(null); setReview(null); setSuggest(null); setAlts(null); setUndo(null); setDirty(false);
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
    change([...blocks, ...added]); setNotice("Claude's draft was added. Read it, edit it, and add a link to the button.");
  });

  const rewrite = (b: Block, instruction: string) => run(`rw-${b.id}`, async () => {
    if (b.type !== "heading" && b.type !== "text") return;
    const { options } = await ai({ action: "rewrite", text: b.text, blockType: b.type, instruction });
    setSuggest({ blockId: b.id, options });
  });

  const redesign = (like?: string) => run("redesign", async () => {
    let lib = photos;
    if (lib === null) {
      lib = await call("/api/admin/photos").then((d) => (d.photos || []).filter((p: Photo) => !/\.(mp4|mov|webm|m4v)$/i.test(p.name))).catch(() => []);
      setPhotos(lib);
    }
    const r = await ai({ action: "redesign", direction, like, photos: (lib || []).slice(0, 40).map((p) => ({ url: p.url, name: p.name })) });
    setAlts(r.alternatives);
  });

  const useAlt = (a: { name: string; design: { blocks: Block[]; brand: Brand } }) => {
    setUndo({ blocks, brand });
    change(a.design.blocks); setBrand(a.design.brand); setOpen(null); setAlts(null);
    setNotice(`"${a.name}" is now your design. Click any block to edit it, or use Undo redesign to go back.`);
  };

  const getReview = () => run("review", async () => { const r = await ai({ action: "review" }); setReview({ suggestions: r.suggestions, subjects: r.subjects }); });

  const openPicker = (bid: string) => {
    setPickFor(bid);
    if (photos === null) call("/api/admin/photos").then((d) => setPhotos((d.photos || []).filter((p: Photo) => !/\.(mp4|mov|webm|m4v)$/i.test(p.name)))).catch((e) => { setPhotos([]); setError(e.message); });
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
        <button className={btnPrimary} disabled={busy !== null || !name.trim()} onClick={save}>{busy === "save" ? "Saving…" : "Save as template"}</button>
        {id && <button className={btnGhost} disabled={busy !== null} onClick={remove}>Delete</button>}
      </div>
      {notice && <p className="text-[13px] text-[#1a7f68]">{notice}</p>}
      {error && <p className="text-[13px] text-[#b83232]">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Builder */}
        <div className="space-y-3">
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
              {undo && <button className={btnGhost} onClick={() => { change(undo.blocks); setBrand(undo.brand); setUndo(null); setNotice("Back to your previous version."); }}>Undo redesign</button>}
            </div>
            <div className="flex gap-2">
              <input className={inputCls} placeholder="Optional: more elegant, more photos, bolder…" value={direction} onChange={(e) => setDirection(e.target.value)} />
              <button className={btnGhost} disabled={busy !== null || blocks.length === 0} onClick={() => redesign()}>{busy === "redesign" ? "Designing…" : "Redesign"}</button>
            </div>
            {alts && (
              <div className="grid gap-3 sm:grid-cols-3">
                {alts.map((a, k) => (
                  <div key={k} className="space-y-1">
                    <div className="h-56 overflow-hidden rounded border border-[#d9dde3] bg-white">
                      <iframe title={`Alternative ${a.name}`} sandbox="" srcDoc={renderHtml(a.design, { title: a.name })} className="origin-top-left pointer-events-none" style={{ width: 600, height: 900, transform: "scale(0.33)", transformOrigin: "top left" }} />
                    </div>
                    <div className="text-[12.5px] font-semibold text-[#323a46] truncate">{a.name}</div>
                    <div className="flex gap-1">
                      <button className={btnGhost} onClick={() => useAlt(a)}>Use this</button>
                      <button className={btnGhost} disabled={busy !== null} onClick={() => redesign(a.name)}>More like this</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11.5px] text-[#9ba6b7]">Claude keeps your facts and links and only uses pictures from your library. Read the result before you save.</p>
          </div>

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

        {/* Preview */}
        <div className="space-y-2 lg:sticky lg:top-4 self-start">
          <div className="flex items-center gap-2">
            <div className={lbl}>Preview</div>
            {(Object.keys(DEVICES) as Device[]).map((d) => (
              <button key={d} className={`${btnGhost} ${view === d ? "!border-[#1ab394] !text-[#1ab394]" : ""}`} onClick={() => setView(d)}>{DEVICES[d].label}</button>
            ))}
          </div>
          <p className="text-[12px] text-[#9ba6b7]">{DEVICES[view].label} screen, {DEVICES[view].width} px wide. Sending is off; this is a preview only.</p>
          <div ref={boxRef} className="rounded-lg border border-[#e7e9eb] bg-[#eef0f2] p-3 flex justify-center">
            <div style={{ width: DEVICES[view].width * scale, height: PREVIEW_H }} className={`overflow-hidden bg-white border border-[#d9dde3] ${view === "mobile" || view === "ipad" ? "rounded-[22px] border-[6px] !border-[#2b2f36]" : "rounded"}`}>
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={html}
                style={{ width: DEVICES[view].width, height: PREVIEW_H / scale, transform: `scale(${scale})`, transformOrigin: "top left", border: 0, background: "#fff" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
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

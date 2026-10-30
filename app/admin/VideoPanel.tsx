"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MAX_SCENES, VENUE_ADDRESS_LINE, applyVideoOps, emptyStoryboard, frameAt, musicGain, newScene, normalizeStoryboard, totalSeconds, videoIssues,
  type Scene, type Storyboard, type VOp,
} from "@/lib/video";

interface Photo { url: string; folder: string; name: string }
interface Checkpoint { id: string; title: string; at: string; storyboard: Storyboard }
interface Saved { id: string; name: string; seconds: number }
type Kind = "you" | "claude" | "done" | "skip";

const inputCls = "w-full rounded-md border border-line px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-accent";
const btnPrimary = "h-9 px-4 rounded-md bg-accent text-white text-[13px] font-semibold disabled:opacity-50";
const btnGhost = "h-8 px-3 rounded-md border border-line text-muted text-[12.5px] hover:border-accent/50 disabled:opacity-50";
const lbl = "text-[12px] font-semibold text-muted";
const W = 1280, H = 720;

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (res.status === 401) { window.location.assign("/admin/login"); throw new Error("Signed out"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const isVideoName = (n: string) => /\.(mp4|mov|webm|m4v)$/i.test(n);

// Pictures are drawn cover-style (filled, never stretched), with a slow push or pull and a soft fade at the edges.
function drawFrame(ctx: CanvasRenderingContext2D, sb: Storyboard, t: number, imgs: Map<string, HTMLImageElement>) {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
  const f = frameAt(sb, t);
  if (!f) return;
  const img = imgs.get(f.scene.url);
  ctx.globalAlpha = f.opacity;
  if (img && img.complete && img.naturalWidth) {
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight) * f.zoom;
    const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }
  const text = f.scene.caption.trim();
  if (text) {
    ctx.font = "600 40px -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const words = text.split(/\s+/); const lines: string[] = []; let cur = "";
    for (const w of words) { const next = cur ? `${cur} ${w}` : w; if (ctx.measureText(next).width > W - 200 && cur) { lines.push(cur); cur = w; } else cur = next; }
    if (cur) lines.push(cur);
    const lh = 54, boxH = lines.length * lh + 28;
    const cy = f.scene.captionPos === "center" ? H / 2 : H - 70 - (lines.length - 1) * lh / 2;
    const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(W / 2 - maxW / 2 - 28, cy - boxH / 2 + 14 - 14, maxW + 56, boxH);
    ctx.fillStyle = "#f6f1e9";
    lines.forEach((l, k) => ctx.fillText(l, W / 2, cy - ((lines.length - 1) * lh) / 2 + k * lh));
  }
  ctx.globalAlpha = 1;
}

export interface VideoPrefill { key: string; name: string; storyboard: Storyboard }

export default function VideoPanel({ prefill }: { prefill?: VideoPrefill | null } = {}) {
  const [sb, setSb] = useState<Storyboard>(emptyStoryboard());
  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState<Saved[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [cpTitle, setCpTitle] = useState("");
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [picking, setPicking] = useState<"add" | string | null>(null);
  const [tracks, setTracks] = useState<Photo[] | null>(null); // audio files in the library
  const [pickingMusic, setPickingMusic] = useState(false);
  const openMusic = () => {
    setPickingMusic((o) => !o);
    if (tracks === null) call("/api/admin/photos").then((d) => setTracks((d.photos || []).filter((p: Photo) => /\.(mp3|m4a|wav|ogg)$/i.test(p.name)))).catch((e) => { setTracks([]); setError(e.message); });
  };
  const [sel, setSel] = useState<string | null>(null);
  const [goal, setGoal] = useState("");
  const [cmd, setCmd] = useState("");
  const [log, setLog] = useState<{ id: number; text: string; kind: Kind }[]>([]);
  const [past, setPast] = useState<{ sb: Storyboard; label: string }[]>([]);
  const [future, setFuture] = useState<{ sb: Storyboard; label: string }[]>([]);
  const [aiCount, setAiCount] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [renderPct, setRenderPct] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgs = useRef<Map<string, HTMLImageElement>>(new Map());
  const timeRef = useRef(0);
  const total = totalSeconds(sb);
  const issues = useMemo(() => videoIssues(sb), [sb]);

  const refresh = () => call("/api/admin/video").then((d) => setSaved(d.videos)).catch(() => {});
  useEffect(() => { refresh(); }, []);

  // Keep every picture loaded for the preview.
  useEffect(() => {
    sb.scenes.forEach((s) => {
      if (imgs.current.has(s.url)) return;
      const im = new Image(); im.crossOrigin = "anonymous"; im.src = s.url;
      im.onload = () => draw(timeRef.current);
      imgs.current.set(s.url, im);
    });
    draw(timeRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb]);

  const draw = useCallback((t: number) => {
    const c = canvasRef.current; const ctx = c?.getContext("2d");
    if (c && ctx) drawFrame(ctx, sb, t, imgs.current);
  }, [sb]);

  // Playback loop.
  useEffect(() => {
    if (!playing) return;
    let raf = 0; let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000; last = now;
      timeRef.current = Math.min(total, timeRef.current + dt);
      setTime(timeRef.current); draw(timeRef.current);
      if (timeRef.current >= total) { setPlaying(false); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total, draw]);

  const seek = (t: number) => { timeRef.current = t; setTime(t); draw(t); };
  const play = () => { if (timeRef.current >= total) seek(0); setPlaying((p) => !p); };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setError(""); setNotice("");
    try { await fn(); } catch (e: any) { setError(e.message || "Something went wrong."); } finally { setBusy(null); }
  };
  const addLog = (entries: { text: string; kind: Kind }[]) => setLog((l) => [...l, ...entries.map((e, k) => ({ id: Date.now() + k + Math.random(), ...e }))].slice(-60));
  const edit = (next: Storyboard) => { setSb(next); setDirty(true); };
  // Every AI change goes through here so each one can be undone and redone.
  const record = (label: string, next: Storyboard) => { setPast((p) => [...p.slice(-29), { sb, label }]); setFuture([]); edit(next); };
  const undoStep = () => { const last = past[past.length - 1]; if (!last) return; setFuture((f) => [{ sb, label: last.label }, ...f]); setPast((p) => p.slice(0, -1)); edit(last.sb); addLog([{ text: `Undid: ${last.label}`, kind: "done" }]); };
  const redoStep = () => { const nx = future[0]; if (!nx) return; setPast((p) => [...p, { sb, label: nx.label }]); setFuture((f) => f.slice(1)); edit(nx.sb); addLog([{ text: `Redid: ${nx.label}`, kind: "done" }]); };
  const patchScene = (sid: string, p: Partial<Scene>) => edit({ ...sb, scenes: sb.scenes.map((s) => (s.id === sid ? { ...s, ...p } : s)) });
  const moveScene = (sid: string, dir: -1 | 1) => {
    const i = sb.scenes.findIndex((s) => s.id === sid); const j = i + dir;
    if (i < 0 || j < 0 || j >= sb.scenes.length) return;
    const next = sb.scenes.slice(); [next[i], next[j]] = [next[j], next[i]]; edit({ ...sb, scenes: next });
  };

  const loadPhotos = async () => {
    if (photos !== null) return photos;
    const list: Photo[] = await call("/api/admin/photos").then((d) => (d.photos || []).filter((p: Photo) => /\.(jpe?g|png|gif|webp)$/i.test(p.name))).catch((e) => { setError(e.message); return []; });
    setPhotos(list); return list;
  };
  const altFor = (p: Photo) => p.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  const openPicker = (mode: "add" | string) => { setPicking(mode); loadPhotos(); };
  const choose = (p: Photo) => {
    if (picking === "add") { if (sb.scenes.length >= MAX_SCENES) return; const s = newScene(p.url, altFor(p)); record("Added a scene", { ...sb, scenes: [...sb.scenes, s] }); setSel(s.id); }
    else if (picking) patchScene(picking, { url: p.url, alt: altFor(p) });
    setPicking(null);
  };

  const draftVideo = () => run("draft", async () => {
    if (sb.scenes.length && !confirm("This replaces the scenes you have now (you can undo it). Continue?")) return;
    const lib = await loadPhotos();
    const r = await call("/api/admin/video/ai", post({ action: "draft", goal, photos: lib.map((p) => ({ url: p.url, name: p.name })) }));
    const ok = new Set(lib.map((p) => p.url));
    const scenes = (r.scenes as Scene[]).filter((s) => ok.has(s.url)).map((s) => ({ ...newScene(s.url, s.alt), seconds: s.seconds, caption: s.caption, motion: s.motion }));
    const next = normalizeStoryboard({ ...sb, scenes });
    record("Claude's storyboard draft", next); setSel(next.scenes[0]?.id ?? null); seek(0); setAiCount((c) => c + 1);
    addLog([{ text: `Draft: ${goal}`, kind: "you" }, { text: `Planned ${next.scenes.length} scenes, ${fmt(totalSeconds(next))}. Read the captions and edit anything.`, kind: "claude" }]);
  });

  const runCommand = () => run("command", async () => {
    const text = cmd.trim(); if (!text) return;
    const lib = await loadPhotos();
    const r = await call("/api/admin/video/ai", post({ action: "command", instruction: text, storyboard: sb, photos: lib.map((p) => ({ url: p.url, name: p.name })) }));
    const allowed = new Set([...lib.map((p) => p.url), ...sb.scenes.map((s) => s.url)]);
    const res = applyVideoOps(sb, r.ops as VOp[], allowed);
    const entries: { text: string; kind: Kind }[] = [{ text, kind: "you" }];
    if (r.reply) entries.push({ text: r.reply, kind: "claude" });
    res.applied.forEach((t) => entries.push({ text: t, kind: "done" }));
    res.skipped.forEach((t) => entries.push({ text: t, kind: "skip" }));
    if (res.applied.length) record(text.slice(0, 60), res.storyboard);
    addLog(entries); setAiCount((c) => c + 1); setCmd("");
  });

  const save = (checkpointTitle?: string) => run("save", async () => {
    const r = await call("/api/admin/video", post({ id, name, storyboard: sb, checkpointTitle }));
    setId(r.id); setCheckpoints(r.checkpoints); setDirty(false); setCpTitle("");
    setNotice(checkpointTitle ? `Checkpoint “${checkpointTitle}” saved.` : "Saved. Nothing has been rendered or posted."); refresh();
  });
  const open = (vid: string) => run("open", async () => {
    if (dirty && !confirm("You have changes that aren't saved. Open another video anyway?")) return;
    const { video } = await call(`/api/admin/video?id=${encodeURIComponent(vid)}`);
    setId(video.id); setName(video.name); setSb(video.storyboard); setCheckpoints(video.checkpoints); setPast([]); setFuture([]); setLog([]); setDirty(false); setSel(video.storyboard.scenes[0]?.id ?? null); seek(0);
  });
  // Coming from the Examples library: load the storyboard as an unsaved video.
  useEffect(() => {
    if (!prefill) return;
    const nsb = normalizeStoryboard(prefill.storyboard);
    setId(null); setName(prefill.name); setSb(nsb); setCheckpoints([]); setPast([]); setFuture([]); setLog([]); setDirty(true); setSel(nsb.scenes[0]?.id ?? null); setError("");
    setNotice("Example loaded. Change the pictures or captions, then save it as your own.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill?.key]);
  const startNew = () => {
    if (dirty && !confirm("You have changes that aren't saved. Start a new video anyway?")) return;
    setId(null); setName(""); setSb(emptyStoryboard()); setCheckpoints([]); setPast([]); setFuture([]); setLog([]); setDirty(false); setSel(null); seek(0); setNotice(""); setError("");
  };
  const remove = () => run("delete", async () => {
    if (!id || !confirm(`Delete "${name}"? This can't be undone.`)) return;
    await call(`/api/admin/video?id=${encodeURIComponent(id)}`, { method: "DELETE" }); startNew(); refresh(); setNotice("Deleted.");
  });
  const restore = (cp: Checkpoint) => { if (!confirm(`Go back to “${cp.title}”? Your current draft is kept in undo.`)) return; record(`Restored “${cp.title}”`, cp.storyboard); addLog([{ text: `Restored checkpoint “${cp.title}”.`, kind: "done" }]); };

  // Render in the browser: draw each frame to a canvas and record it (with the music mixed in when it can be fetched).
  const renderVideo = () => run("render", async () => {
    const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("This browser can't render video.");
    if (typeof MediaRecorder === "undefined") throw new Error("This browser can't record video. Try Chrome.");
    await Promise.all(sb.scenes.map((s) => new Promise<void>((res) => { const im = imgs.current.get(s.url); if (!im || im.complete) res(); else { im.onload = () => res(); im.onerror = () => res(); } })));
    const stream = canvas.captureStream(sb.fps);
    let audioCtx: AudioContext | null = null; let musicNote = "";
    if (sb.music) {
      try {
        const buf = await (await fetch(sb.music.url, { mode: "cors" })).arrayBuffer();
        audioCtx = new AudioContext(); const decoded = await audioCtx.decodeAudioData(buf);
        const src = audioCtx.createBufferSource(); src.buffer = decoded; const gain = audioCtx.createGain(); const dest = audioCtx.createMediaStreamDestination();
        const t0 = audioCtx.currentTime; gain.gain.setValueAtTime(sb.music.volume, t0);
        if (sb.music.fadeOutSeconds > 0) { gain.gain.setValueAtTime(sb.music.volume, t0 + Math.max(0, total - sb.music.fadeOutSeconds)); gain.gain.linearRampToValueAtTime(0, t0 + total); }
        src.connect(gain); gain.connect(dest); src.start(t0); src.stop(t0 + total);
        dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
      } catch { musicNote = " The music link couldn't be mixed in (the file's host may block it), so this render is silent."; audioCtx = null; }
    }
    const chunks: Blob[] = [];
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise<void>((res) => { rec.onstop = () => res(); });
    rec.start(250);
    const start = performance.now(); setRenderPct(0);
    await new Promise<void>((res) => {
      const step = (now: number) => {
        const t = Math.min(total, (now - start) / 1000);
        drawFrame(ctx, sb, t, imgs.current); setRenderPct(Math.round((t / total) * 100));
        if (t >= total) res(); else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    rec.stop(); await done; audioCtx?.close(); setRenderPct(null);
    const blob = new Blob(chunks, { type: "video/webm" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${(name || "video").replace(/[^\w-]+/g, "-")}.webm`; a.click();
    setNotice(`Rendered ${fmt(total)} and saved to your Downloads as a .webm file. Nothing was uploaded or posted.${musicNote}`);
  });

  const selected = sb.scenes.find((s) => s.id === sel) || null;
  const cur = frameAt(sb, time);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${inputCls} !w-auto`} value={id ?? ""} onChange={(e) => (e.target.value ? open(e.target.value) : startNew())}>
          <option value="">New video</option>{saved.map((s) => <option key={s.id} value={s.id}>{s.name} ({fmt(s.seconds)})</option>)}
        </select>
        <input className={`${inputCls} !w-64`} placeholder="Name this video" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
      </div>
      {notice && <p className="text-[13px] text-success">{notice}</p>}
      {error && <p className="text-[13px] text-danger">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
        {/* Stage */}
        <div className="min-w-0 space-y-3">
          <div className="rounded-2xl bg-navy-deep p-4">
            <div className="mb-2 flex items-center justify-between text-[12px] text-subtle"><span>Preview · 16:9 · {fmt(total)}</span><span>Preview only. Nothing is posted.</span></div>
            <canvas ref={canvasRef} width={W} height={H} className="w-full rounded bg-black" aria-label="Video preview" />
            <div className="mt-3 flex items-center gap-3">
              <button className="h-9 w-9 rounded-full bg-accent text-white" onClick={play} disabled={!sb.scenes.length} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "▶"}</button>
              <input type="range" min={0} max={Math.max(total, 0.1)} step={0.05} value={time} onChange={(e) => { setPlaying(false); seek(Number(e.target.value)); }} className="flex-1" aria-label="Position in the video" />
              <span className="w-24 text-right text-[12px] tabular-nums text-subtle">{fmt(time)} / {fmt(total)}</span>
            </div>
            <div className="mt-3 space-y-2">
              {log.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-navy p-2 text-[12.5px]" aria-label="What the assistant did">
                  {log.map((e) => (<li key={e.id} className={e.kind === "you" ? "text-line" : e.kind === "claude" ? "text-success-tint" : e.kind === "done" ? "text-subtle" : "text-warn"}>{e.kind === "you" ? "You: " : e.kind === "claude" ? "Claude: " : e.kind === "done" ? "✓ " : "– "}{e.text}</li>))}
                </ul>
              )}
              <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); runCommand(); }}>
                <input className="h-10 flex-1 rounded-lg border border-navy-soft bg-navy px-3 text-[14px] text-line placeholder:text-muted focus:outline-none focus:border-accent" placeholder="Give me a command to edit the video (e.g. make scene 2 longer)" value={cmd} onChange={(e) => setCmd(e.target.value)} aria-label="Command for the assistant" />
                <button type="submit" disabled={busy !== null || !cmd.trim() || !sb.scenes.length} className="h-10 rounded-lg bg-accent px-4 text-[13px] font-semibold text-white disabled:opacity-50">{busy === "command" ? "Working…" : "Send"}</button>
                <button type="button" onClick={undoStep} disabled={past.length === 0} aria-label="Undo" title={past.length ? `Undo: ${past[past.length - 1].label}` : "Nothing to undo"} className="h-10 w-10 rounded-lg border border-navy-soft text-line disabled:opacity-40">↶</button>
                <button type="button" onClick={redoStep} disabled={future.length === 0} aria-label="Redo" title={future.length ? `Redo: ${future[0].label}` : "Nothing to redo"} className="h-10 w-10 rounded-lg border border-navy-soft text-line disabled:opacity-40">↷</button>
              </form>
              <div className="flex justify-between text-[11.5px] text-muted"><span>Each change can be undone. Claude only uses pictures from your Photo Library.</span><span>{aiCount} AI action{aiCount === 1 ? "" : "s"} this session</span></div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-3">
            <div className="mb-2 flex items-center justify-between"><div className="text-[14px] font-semibold text-ink">Storyboard <span className="ml-1 rounded-full bg-line px-2 text-[11.5px] font-normal text-muted">{sb.scenes.length}</span></div>
              <button className={btnGhost} onClick={() => openPicker("add")} disabled={sb.scenes.length >= MAX_SCENES}>+ Add picture</button></div>
            {sb.scenes.length === 0 ? <p className="text-[12.5px] text-subtle">No scenes yet. Add pictures from your Photo Library, or ask Claude for a storyboard draft.</p> : (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {sb.scenes.map((s, i) => (
                  <button key={s.id} onClick={() => { setSel(s.id); setPlaying(false); seek(sb.scenes.slice(0, i).reduce((t, x) => t + x.seconds, 0) + 0.6); }} className={`w-[190px] shrink-0 text-left ${sel === s.id ? "ring-2 ring-accent rounded-lg" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.url} alt={s.alt} className={`h-[107px] w-full rounded-lg object-cover ${cur?.sceneIndex === i ? "outline outline-2 outline-accent" : ""}`} />
                    <div className="mt-1 flex justify-between text-[11.5px] text-muted"><span>{i + 1}</span><span>{s.seconds}s</span></div>
                    <div className="truncate text-[12.5px] text-ink">{s.caption || <span className="text-subtle">No caption</span>}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white lg:sticky lg:top-4 lg:h-[calc(100vh-170px)] lg:min-h-[560px]">
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {picking && (
              <div className="rounded-lg border border-line p-2">
                <div className="mb-1 flex items-center justify-between"><span className={lbl}>{picking === "add" ? "Add a picture" : "Change the picture"}</span><button className={btnGhost} onClick={() => setPicking(null)}>Close</button></div>
                {photos === null ? <p className="text-[12px] text-subtle">Loading…</p> : photos.length === 0 ? <p className="text-[12px] text-subtle">No photos available (the photo store may not be connected yet).</p> : (
                  <div className="grid max-h-56 grid-cols-4 gap-2 overflow-auto">{photos.map((p) => (
                    <button key={p.url} onClick={() => choose(p)}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={p.url} alt={p.name} className="h-16 w-full rounded object-cover" /></button>))}</div>
                )}
              </div>
            )}

            {selected ? (
              <div className="space-y-2 rounded-lg bg-canvas p-3">
                <div className="flex items-center justify-between"><span className={lbl}>Scene {sb.scenes.findIndex((s) => s.id === selected.id) + 1}</span>
                  <div className="flex gap-1">
                    <button className={btnGhost} onClick={() => moveScene(selected.id, -1)} aria-label="Move earlier">←</button>
                    <button className={btnGhost} onClick={() => moveScene(selected.id, 1)} aria-label="Move later">→</button>
                    <button className={btnGhost} onClick={() => openPicker(selected.id)}>Picture</button>
                    <button className={btnGhost} onClick={() => { record("Removed a scene", { ...sb, scenes: sb.scenes.filter((s) => s.id !== selected.id) }); setSel(null); }}>Remove</button>
                  </div></div>
                <input className={inputCls} placeholder="Caption (optional)" value={selected.caption} maxLength={120} onChange={(e) => patchScene(selected.id, { caption: e.target.value })} />
                <div className="flex gap-2">
                  <button className={btnGhost} onClick={() => patchScene(selected.id, { caption: VENUE_ADDRESS_LINE })}>Use address</button>
                  <select className={inputCls} value={selected.captionPos} onChange={(e) => patchScene(selected.id, { captionPos: e.target.value === "center" ? "center" : "lower" })}><option value="lower">Caption: lower</option><option value="center">Caption: center</option></select>
                </div>
                <label className="block"><span className={lbl}>Length ({selected.seconds}s)</span><input type="range" min={1.5} max={12} step={0.5} value={selected.seconds} onChange={(e) => patchScene(selected.id, { seconds: Number(e.target.value) })} className="w-full" /></label>
                <select className={inputCls} value={selected.motion} onChange={(e) => patchScene(selected.id, { motion: e.target.value === "none" ? "none" : e.target.value === "pull" ? "pull" : "push" })}><option value="push">Slow push in</option><option value="pull">Slow pull out</option><option value="none">Still</option></select>
                <input className={inputCls} placeholder="Describe the picture (for people who can't see it)" value={selected.alt} onChange={(e) => patchScene(selected.id, { alt: e.target.value })} />
              </div>
            ) : <p className="rounded-lg bg-canvas p-3 text-[12.5px] text-subtle">Click a scene in the storyboard to edit its caption, length and camera move.</p>}

            <div className="space-y-2 rounded-lg bg-canvas p-3">
              <span className={lbl}>Music (optional)</span>
              <input className={inputCls} placeholder="Link to a music file you're licensed to use (https://…mp3)" value={sb.music?.url ?? ""} onChange={(e) => edit(normalizeStoryboard({ ...sb, music: e.target.value ? { url: e.target.value, name: sb.music?.name || "Music", volume: sb.music?.volume ?? 0.8, fadeOutSeconds: sb.music?.fadeOutSeconds ?? 3 } : null }))} />
              <button type="button" className={btnGhost} onClick={openMusic}>{pickingMusic ? "Close music library" : "Choose from the music library"}</button>
              {pickingMusic && (
                <div className="space-y-1.5">
                  {tracks === null && <p className="text-[12px] text-subtle">Loading…</p>}
                  {tracks?.length === 0 && <p className="text-[12px] text-subtle">No music yet. In Photo Library, open a "Music" folder and upload an MP3 you're licensed to use.</p>}
                  {tracks?.map((t) => (
                    <div key={t.url} className="rounded-md border border-line p-2 space-y-1">
                      <div className="text-[12.5px] text-ink truncate" title={t.name}>🎵 {t.name} <span className="text-subtle">· {t.folder}</span></div>
                      <audio src={t.url} controls preload="none" className="w-full" />
                      <button type="button" className={btnGhost} onClick={() => { edit(normalizeStoryboard({ ...sb, music: { url: t.url, name: t.name.replace(/\.[^.]+$/, ""), volume: sb.music?.volume ?? 0.8, fadeOutSeconds: sb.music?.fadeOutSeconds ?? 3 } })); setPickingMusic(false); }}>Use this track</button>
                    </div>
                  ))}
                </div>
              )}
              {sb.music && <>
                <label className="block"><span className={lbl}>Volume ({Math.round(sb.music.volume * 100)}%)</span><input type="range" min={0} max={1} step={0.05} value={sb.music.volume} onChange={(e) => edit({ ...sb, music: { ...sb.music!, volume: Number(e.target.value) } })} className="w-full" /></label>
                <label className="block"><span className={lbl}>Fade out ({sb.music.fadeOutSeconds}s)</span><input type="range" min={0} max={8} step={0.5} value={sb.music.fadeOutSeconds} onChange={(e) => edit({ ...sb, music: { ...sb.music!, fadeOutSeconds: Number(e.target.value) } })} className="w-full" /></label>
                <p className="text-[11.5px] text-subtle">Mix level at the end: {Math.round(musicGain(sb, total) * 100)}%. Only use music you have the right to use.</p></>}
            </div>

            <div className="space-y-2 rounded-lg bg-canvas p-3">
              <span className={lbl}>Checkpoints</span>
              <div className="flex gap-2"><input className={inputCls} placeholder="Name this version" value={cpTitle} onChange={(e) => setCpTitle(e.target.value)} /><button className={btnGhost} disabled={busy !== null || !cpTitle.trim() || !name.trim() || !sb.scenes.length} onClick={() => save(cpTitle.trim())}>Save</button></div>
              {checkpoints.length === 0 ? <p className="text-[12px] text-subtle">None yet. Save a checkpoint before a big change.</p> : (
                <ul className="space-y-1">{checkpoints.map((c) => (<li key={c.id} className="flex items-center justify-between text-[12.5px]"><span className="truncate text-ink">{c.title}</span><button className={btnGhost} onClick={() => restore(c)}>Restore</button></li>))}</ul>)}
            </div>

            {issues.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] text-warn">{issues.slice(0, 5).map((i, k) => <li key={k}>{i.message}</li>)}</ul>}
          </div>

          <div className="space-y-2 border-t border-line bg-canvas p-3">
            <div className="rounded-lg border border-line bg-white p-2 space-y-2">
              <div className={lbl}>Ask Devin for a storyboard</div>
              <div className="flex gap-2"><input className={inputCls} placeholder="e.g. A 30-second intro to the venue for Facebook" value={goal} onChange={(e) => setGoal(e.target.value)} /><button className={btnGhost} disabled={busy !== null || !goal.trim()} onClick={draftVideo}>{busy === "draft" ? "Planning…" : "Draft"}</button></div>
            </div>
            <div className="flex items-center gap-2">
              <button className={`${btnPrimary} flex-1`} disabled={busy !== null || !name.trim() || !sb.scenes.length} onClick={() => save()}>{busy === "save" ? "Saving…" : "Save draft"}</button>
              <button className={btnGhost} disabled={busy !== null || !sb.scenes.length} onClick={renderVideo}>{renderPct !== null ? `Rendering ${renderPct}%` : "Render .webm"}</button>
              {id && <button className={btnGhost} disabled={busy !== null} onClick={remove}>Delete</button>}
            </div>
            <p className="text-[11.5px] text-subtle">Rendering happens in your browser and saves a file to your Downloads. Nothing is uploaded or posted.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

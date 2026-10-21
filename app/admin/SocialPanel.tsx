"use client";

import React, { useEffect, useMemo, useState } from "react";
import { PLATFORMS, cleanTags, composePost, isClean, socialChecks, type Platform } from "@/lib/social";

interface Photo { url: string; folder: string; name: string }
interface Draft { id: string; title: string; caption: string; platform: Platform; hashtags: string[]; mediaUrl: string; imageAlt: string; videoUrl?: string; updatedAt: string }
interface Option { caption: string; hashtags: string[] }

const inputCls = "w-full rounded-md border border-[#e7e9eb] px-3 py-2 text-[14px] text-[#323a46] focus:outline-none focus:border-[#1ab394]";
const btnPrimary = "h-9 px-4 rounded-md bg-[#1ab394] text-white text-[13px] font-semibold disabled:opacity-50";
const btnGhost = "h-8 px-3 rounded-md border border-[#e7e9eb] text-[#6c757d] text-[12.5px] hover:border-[#1ab394]/50 disabled:opacity-50";
const lbl = "text-[12px] font-semibold text-[#6c757d]";

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (res.status === 401) { window.location.assign("/admin/login"); throw new Error("Signed out"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function SocialPanel() {
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [id, setId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [tagText, setTagText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videos, setVideos] = useState<Photo[] | null>(null);
  const [pickingVideo, setPickingVideo] = useState(false);
  const [goal, setGoal] = useState("");
  const [tone, setTone] = useState("");
  const [options, setOptions] = useState<Option[] | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  const p = PLATFORMS[platform];
  const tags = useMemo(() => cleanTags(tagText.split(/[\s,]+/)), [tagText]);
  const checks = useMemo(() => socialChecks(platform, caption, tags, { hasImage: Boolean(mediaUrl), imageAlt }), [platform, caption, tags, mediaUrl, imageAlt]);
  const problems = checks.filter((c) => !c.ok);
  const full = composePost(caption, tags);

  const refresh = () => call("/api/admin/social").then((d) => setDrafts(d.posts)).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key); setError(""); setNotice("");
    try { await fn(); } catch (e: any) { setError(e.message || "Something went wrong."); } finally { setBusy(null); }
  };

  const reset = () => {
    if (dirty && !confirm("You have changes that aren't saved. Start a new post anyway?")) return;
    setId(null); setTitle(""); setCaption(""); setTagText(""); setMediaUrl(""); setImageAlt(""); setOptions(null); setDirty(false); setNotice(""); setError("");
  };
  const openDraft = (d: Draft) => {
    if (dirty && !confirm("You have changes that aren't saved. Open another draft anyway?")) return;
    setId(d.id); setTitle(d.title); setCaption(d.caption); setPlatform(d.platform); setTagText(d.hashtags.join(" ")); setMediaUrl(d.mediaUrl); setImageAlt(d.imageAlt); setVideoUrl(d.videoUrl || ""); setOptions(null); setDirty(false); setNotice(""); setError("");
  };

  const photoNote = () => photos?.find((x) => x.url === mediaUrl)?.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") || imageAlt;
  const write = () => run("write", async () => { const r = await call("/api/admin/social/ai", post({ action: "write", platform, goal, tone, photoNote: photoNote() })); setOptions(r.options); });
  const rewrite = (instruction: string) => run("rewrite", async () => { const r = await call("/api/admin/social/ai", post({ action: "rewrite", platform, caption, instruction })); setOptions(r.options); });
  const use = (o: Option) => { setCaption(o.caption); setTagText(o.hashtags.join(" ")); setOptions(null); setDirty(true); };

  const save = () => run("save", async () => {
    const r = await call("/api/admin/social", post({ id, title, caption, platform, hashtags: tags, mediaUrl, imageAlt, videoUrl }));
    setId(r.id); setDirty(false); setNotice("Saved as a draft. Nothing has been posted."); refresh();
  });
  const remove = () => run("delete", async () => {
    if (!id || !confirm("Delete this draft? This can't be undone.")) return;
    await call(`/api/admin/social?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setId(null); setTitle(""); setCaption(""); setTagText(""); setMediaUrl(""); setImageAlt(""); setDirty(false); setNotice("Deleted."); refresh();
  });
  const copy = () => run("copy", async () => { await navigator.clipboard.writeText(full); setNotice("Copied. Paste it into the post on the platform yourself."); });

  const openVideoPicker = () => {
    setPickingVideo(true);
    if (videos === null) call("/api/admin/photos").then((d) => setVideos((d.photos || []).filter((x: Photo) => /\.(mp4|mov|webm|m4v)$/i.test(x.name)))).catch((e) => { setVideos([]); setError(e.message); });
  };

  const openPicker = () => {
    setPicking(true);
    if (photos === null) call("/api/admin/photos").then((d) => setPhotos((d.photos || []).filter((x: Photo) => !/\.(mp4|mov|webm|m4v)$/i.test(x.name)))).catch((e) => { setPhotos([]); setError(e.message); });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,1fr)]">
      {/* Preview and drafts */}
      <div className="min-w-0 space-y-3">
        <div className="rounded-2xl bg-[#14171a] p-4">
          <div className="mb-2 flex items-center justify-between text-[12px] text-[#8b95a1]">
            <span>{p.label} preview</span><span>Preview only. Nothing is posted.</span>
          </div>
          <div className="mx-auto max-w-[420px] overflow-hidden rounded-xl bg-white shadow">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8a5a2b] text-[13px] font-bold text-white">HB</div>
              <div><div className="text-[13.5px] font-semibold text-[#1c1e21]">Historic Broyhill</div><div className="text-[11.5px] text-[#65676b]">Just now · {p.label}</div></div>
            </div>
            {platform !== "instagram" && <div className="whitespace-pre-wrap px-3 pb-2 text-[14px] text-[#1c1e21]">{full || <span className="text-[#9ba6b7]">Your post appears here.</span>}</div>}
            {mediaUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl} alt={imageAlt} className="w-full object-cover" style={{ aspectRatio: p.ratio.replace(" / ", "/") }} />
            )}
            {platform === "instagram" && <div className="whitespace-pre-wrap px-3 py-2 text-[14px] text-[#1c1e21]"><strong>historicbroyhill </strong>{full || <span className="text-[#9ba6b7]">Your post appears here.</span>}</div>}
          </div>
        </div>

        <div className="rounded-2xl border border-[#e7e9eb] bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[14px] font-semibold text-[#323a46]">My drafts <span className="ml-1 rounded-full bg-[#eef0f2] px-2 text-[11.5px] font-normal text-[#6c757d]">{drafts.length}</span></div>
            <button className={btnGhost} onClick={reset}>New post</button>
          </div>
          {drafts.length === 0 ? <p className="text-[12.5px] text-[#9ba6b7]">No drafts yet. Write a post and press Save draft.</p> : (
            <ul className="divide-y divide-[#e7e9eb]">
              {drafts.map((d) => (
                <li key={d.id}>
                  <button className="flex w-full items-center gap-3 py-2 text-left" onClick={() => openDraft(d)}>
                    <span className="w-24 shrink-0 text-[11px] uppercase tracking-wider text-[#9ba6b7]">{PLATFORMS[d.platform].label}</span>
                    <span className={`flex-1 truncate text-[13.5px] ${d.id === id ? "font-semibold text-[#1ab394]" : "text-[#323a46]"}`}>{d.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3 rounded-2xl border border-[#e7e9eb] bg-white p-3 lg:sticky lg:top-4 lg:self-start">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(PLATFORMS) as Platform[]).map((k) => (
            <button key={k} aria-pressed={platform === k} onClick={() => { setPlatform(k); setOptions(null); }}
              className={`rounded-lg border py-2 text-[12px] font-semibold ${platform === k ? "border-[#1ab394] bg-white text-[#1ab394]" : "border-[#e7e9eb] text-[#6c757d] hover:border-[#1ab394]/50"}`}>{PLATFORMS[k].label}</button>
          ))}
        </div>

        <div className="space-y-2 rounded-lg bg-[#fafbfc] p-3">
          <div className={lbl}>Ask Claude to write it</div>
          <input className={inputCls} placeholder="What is the post about? e.g. Spring open house for wedding couples" value={goal} onChange={(e) => setGoal(e.target.value)} />
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Tone (optional): warm, festive, formal…" value={tone} onChange={(e) => setTone(e.target.value)} />
            <button className={btnGhost} disabled={busy !== null || !goal.trim()} onClick={write}>{busy === "write" ? "Writing…" : "Write 3"}</button>
          </div>
          {options && (
            <div className="space-y-2">
              {options.map((o, k) => (
                <div key={k} className="rounded-md bg-white p-2 text-[13px] text-[#323a46] border border-[#e7e9eb]">
                  <div className="whitespace-pre-wrap">{o.caption}</div>
                  {o.hashtags.length > 0 && <div className="mt-1 text-[#6c757d]">{o.hashtags.map((t) => `#${t}`).join(" ")}</div>}
                  <button className={`${btnGhost} mt-1`} onClick={() => use(o)}>Use this</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <label className="block"><span className={lbl}>Post</span>
          <textarea className={inputCls} rows={7} value={caption} onChange={(e) => { setCaption(e.target.value); setDirty(true); }} /></label>
        <div className="flex flex-wrap gap-2">
          {["Make it warmer", "Make it shorter", "Add a call to action"].map((ins) => (
            <button key={ins} className={btnGhost} disabled={busy !== null || !caption.trim()} onClick={() => rewrite(ins)}>{busy === "rewrite" ? "…" : ins}</button>
          ))}
        </div>
        {p.maxTags > 0 && (
          <label className="block"><span className={lbl}>Hashtags (separate with spaces)</span>
            <input className={inputCls} value={tagText} onChange={(e) => { setTagText(e.target.value); setDirty(true); }} /></label>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between"><span className={lbl}>{p.video ? "Cover picture (optional)" : "Picture"}</span>
            <div className="flex gap-2">
              <button className={btnGhost} onClick={openPicker}>From library</button>
              {mediaUrl && <button className={btnGhost} onClick={() => { setMediaUrl(""); setImageAlt(""); setDirty(true); }}>Remove</button>}
            </div></div>
          {picking && (
            <div className="rounded-md border border-[#e7e9eb] p-2">
              {photos === null ? <p className="text-[12px] text-[#9ba6b7]">Loading…</p> : photos.length === 0 ? <p className="text-[12px] text-[#9ba6b7]">No photos available (the photo store may not be connected yet).</p> : (
                <div className="grid max-h-48 grid-cols-4 gap-2 overflow-auto">
                  {photos.map((x) => (
                    <button key={x.url} onClick={() => { setMediaUrl(x.url); setImageAlt(imageAlt || x.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")); setPicking(false); setDirty(true); }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={x.url} alt={x.name} className="h-16 w-full rounded object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {mediaUrl && <input className={inputCls} placeholder="Describe the picture in a few words" value={imageAlt} onChange={(e) => { setImageAlt(e.target.value); setDirty(true); }} />}
        </div>

        {p.video && (
          <div className="space-y-2 rounded-lg bg-[#fafbfc] p-3">
            <div className="flex items-center justify-between"><span className={lbl}>Video from the library</span>
              <div className="flex gap-2">
                <button className={btnGhost} onClick={openVideoPicker}>Choose video</button>
                {videoUrl && <button className={btnGhost} onClick={() => { setVideoUrl(""); setDirty(true); }}>Remove</button>}
              </div></div>
            {pickingVideo && (
              <div className="rounded-md border border-[#e7e9eb] bg-white p-2">
                {videos === null ? <p className="text-[12px] text-[#9ba6b7]">Loading…</p> : videos.length === 0 ? <p className="text-[12px] text-[#9ba6b7]">No videos yet. Upload some in Photos (General-Videos).</p> : (
                  <ul className="max-h-40 space-y-1 overflow-auto">
                    {videos.map((x) => (
                      <li key={x.url}><button className="w-full truncate rounded px-2 py-1 text-left text-[12.5px] text-[#323a46] hover:bg-[#f3f4f6]" onClick={() => { setVideoUrl(x.url); setPickingVideo(false); setDirty(true); }}>{x.folder} · {x.name}</button></li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {videoUrl ? (
              <div className="space-y-1">
                <video src={videoUrl} controls preload="metadata" className="w-full rounded-md bg-black" style={{ aspectRatio: p.ratio.replace(" / ", "/") }} />
                <div className="flex gap-2">
                  <a className={btnGhost} href={videoUrl} download target="_blank" rel="noreferrer">Download video</a>
                  <button className={btnGhost} onClick={() => navigator.clipboard.writeText(videoUrl).then(() => setNotice("Video link copied."))}>Copy video link</button>
                </div>
              </div>
            ) : <p className="text-[12.5px] text-[#6c757d]">{p.label} is a video platform. This draft is the {platform === "youtube" ? "title and description" : "caption"}; pick the video here, download it, and upload it when you post.</p>}
          </div>
        )}
        <div className="rounded-lg border border-[#e7e9eb] p-3 text-[12.5px]">
          <div className="mb-1 flex items-center justify-between"><span className={lbl}>Check</span><span className="text-[#9ba6b7]">{full.length.toLocaleString()} / {p.maxChars.toLocaleString()} characters</span></div>
          {isClean(checks) ? <p className="text-[#1a7f68]">Looks good for {p.label}.</p> : <ul className="list-disc space-y-0.5 pl-5 text-[#b7791f]">{problems.map((c, k) => <li key={k}>{c.message}</li>)}</ul>}
        </div>

        <input className={inputCls} placeholder="Name this draft (optional)" value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
        {notice && <p className="text-[13px] text-[#1a7f68]">{notice}</p>}
        {error && <p className="text-[13px] text-[#b83232]">{error}</p>}
        <div className="flex items-center gap-2">
          <button className={`${btnPrimary} flex-1`} disabled={busy !== null || !caption.trim()} onClick={save}>{busy === "save" ? "Saving…" : "Save draft"}</button>
          <button className={btnGhost} disabled={busy !== null || !full} onClick={copy}>Copy</button>
          {id && <button className={btnGhost} disabled={busy !== null} onClick={remove}>Delete</button>}
        </div>
        <p className="text-[11.5px] text-[#9ba6b7]">Posting is off. Copy the text and post it yourself on {p.label} for now.</p>
      </div>
    </div>
  );
}

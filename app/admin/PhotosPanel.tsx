"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { upload as uploadToStorage } from "@vercel/blob/client";
import { MAX_VIDEO_BYTES, SUGGESTED_FOLDERS, cleanFileName, cleanFolder, contentTypeFor, isVideoName, photoPath } from "@/lib/photos";

interface Photo { url: string; folder: string; name: string; size: number; uploadedAt: string }
interface Folder { name: string; count: number }

const inputCls = "w-full rounded-md border border-[#e7e9eb] px-3 py-2 text-[14px] text-[#323a46] focus:outline-none focus:border-[#1ab394]";
const btnPrimary = "h-9 px-4 rounded-md bg-[#1ab394] text-white text-[13px] font-semibold disabled:opacity-50";
const btnGhost = "h-8 px-3 rounded-md border border-[#e7e9eb] text-[#6c757d] text-[12.5px] hover:border-[#1ab394]/50 disabled:opacity-50";
const ALL = "__all__";

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (res.status === 401) { window.location.assign("/admin/login"); throw new Error("Signed out"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e: any = new Error(data.error || "Something went wrong."); e.notConnected = data.notConnected; throw e; }
  return data;
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Big phone photos are shrunk in the browser before upload: about 1600 px on the long side keeps them sharp
// on screen and small enough for picture messages. GIFs and already-small files are sent as they are.
async function prepare(file: File): Promise<File> {
  if (file.type === "image/gif" || file.size < 900 * 1024 || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { return file; }
}

export default function PhotosPanel() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [current, setCurrent] = useState<string>(ALL);
  const [loaded, setLoaded] = useState(false);
  const [notConnected, setNotConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ url: string; name: string; folder: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const d = await call("/api/admin/photos");
      setFolders(d.folders); setPhotos(d.photos); setNotConnected(false); setError(null);
    } catch (e: any) { if (e.notConnected) setNotConnected(true); else setError(e.message); }
    finally { setLoaded(true); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (label: string, fn: () => Promise<string | void>) => {
    setBusy(label); setError(null); setNotice(null);
    try { const m = await fn(); if (m) setNotice(m); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(null); setProgress(null); }
  };

  const shown = useMemo(() => (current === ALL ? photos : photos.filter((p) => p.folder === current)), [photos, current]);
  const missingSuggestions = SUGGESTED_FOLDERS.filter((s) => !folders.some((f) => f.name.toLowerCase() === s.toLowerCase()));

  const addFolder = (name: string) => run("folder", async () => {
    await call("/api/admin/photos", json("POST", { action: "create-folder", name }));
    setNewFolder(""); setCurrent(name.trim()); return `Folder "${name.trim()}" is ready.`;
  });

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    if (current === ALL) { setError("Open a folder first, then upload into it."); return; }
    run("upload", async () => {
      let ok = 0;
      for (const f of Array.from(files)) {
        const clean = cleanFileName(f.name);
        if (!clean) throw new Error(`"${f.name}" isn't a picture or video type we accept.`);
        if (isVideoName(clean)) {
          // Videos go straight to storage in pieces; the server only issues the one-time permission.
          if (f.size > MAX_VIDEO_BYTES) throw new Error(`"${f.name}" is over ${MAX_VIDEO_BYTES / 1024 / 1024} MB.`);
          setProgress(`${clean}: 0%`);
          await uploadToStorage(photoPath(cleanFolder(current), clean), f, {
            access: "public", handleUploadUrl: "/api/admin/photos/upload", multipart: true,
            contentType: contentTypeFor(clean), onUploadProgress: (p) => setProgress(`${clean}: ${Math.round(p.percentage)}%`),
          });
          setProgress(null);
        } else {
          const small = await prepare(f);
          const fd = new FormData(); fd.append("folder", current); fd.append("file", small);
          await call("/api/admin/photos", { method: "POST", body: fd });
        }
        ok++;
      }
      if (fileRef.current) fileRef.current.value = "";
      return `Uploaded ${ok} file${ok === 1 ? "" : "s"} to "${current}".`;
    });
  };

  const copyLink = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setNotice("Link copied. Paste it into a picture message."); setError(null); }
    catch { setNotice(url); }
  };

  if (!loaded) return <p className="text-[13px] text-[#9ba6b7]">Loading…</p>;

  if (notConnected) return (
    <section className="ibox max-w-2xl"><div className="ibox-content space-y-3">
      <h3 className="text-sm font-semibold text-[#323a46]">Photo storage isn't connected yet</h3>
      <p className="text-[13px] text-[#6c757d] leading-relaxed">The library keeps pictures in a Vercel storage area. Once it exists, this page works with nothing else to do.</p>
      <ol className="text-[13px] text-[#323a46] list-decimal pl-5 space-y-1">
        <li>Open Vercel → your <b>historic-broyhill</b> project → <b>Storage</b>.</li>
        <li>Choose <b>Create Database</b> → <b>Blob</b>, name it <b>hb-photos</b>, and set access to <b>Public</b>.</li>
        <li>Connect it to the project, then redeploy (Vercel offers the button).</li>
      </ol>
      <button className={btnGhost} onClick={() => { setLoaded(false); load(); }}>Check again</button>
    </div></section>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5 max-w-5xl">
      <aside className="space-y-3">
        <section className="ibox"><div className="ibox-content p-2">
          <button onClick={() => setCurrent(ALL)} className={`w-full text-left px-3 py-2 rounded-md text-[13.5px] flex justify-between ${current === ALL ? "bg-[#1ab394]/12 text-[#1ab394] font-semibold" : "text-[#323a46] hover:bg-[#f1f2f7]"}`}>
            <span>All photos</span><span className="text-[12px] text-[#9ba6b7]">{photos.length}</span></button>
          {folders.map((f) => (
            <button key={f.name} onClick={() => setCurrent(f.name)} className={`w-full text-left px-3 py-2 rounded-md text-[13.5px] flex justify-between gap-2 ${current === f.name ? "bg-[#1ab394]/12 text-[#1ab394] font-semibold" : "text-[#323a46] hover:bg-[#f1f2f7]"}`}>
              <span className="truncate">📁 {f.name}</span><span className="text-[12px] text-[#9ba6b7]">{f.count}</span></button>
          ))}
          {folders.length === 0 && <p className="px-3 py-2 text-[12.5px] text-[#9ba6b7]">No folders yet.</p>}
        </div></section>

        <section className="ibox"><div className="ibox-content space-y-2">
          <div className="text-[12px] font-semibold text-[#6c757d]">Add folder</div>
          <form onSubmit={(e) => { e.preventDefault(); if (newFolder.trim()) addFolder(newFolder); }} className="flex gap-2">
            <input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} placeholder="Folder name" maxLength={60} className={inputCls} aria-label="New folder name" />
            <button type="submit" className={btnPrimary} disabled={!newFolder.trim() || busy !== null}>Add</button>
          </form>
          {missingSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {missingSuggestions.map((s) => <button key={s} onClick={() => addFolder(s)} disabled={busy !== null} className="text-[11.5px] px-2 py-1 rounded-full border border-[#e7e9eb] text-[#6c757d] hover:border-[#1ab394]/60">+ {s}</button>)}
            </div>
          )}
        </div></section>
      </aside>

      <div className="space-y-4 min-w-0">
        <section className="ibox"><div className="ibox-content space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-sm font-semibold text-[#323a46] flex-1">{current === ALL ? "All photos" : current}</h3>
            {current !== ALL && (<>
              <button className={btnGhost} disabled={busy !== null} onClick={() => {
                const to = window.prompt(`Rename the folder "${current}" to:`, current);
                if (to && to.trim() && to.trim() !== current) run("rename", async () => { await call("/api/admin/photos", json("PATCH", { action: "rename-folder", from: current, to })); setCurrent(to.trim()); return "Folder renamed."; });
              }}>Rename folder</button>
              <button className={btnGhost} disabled={busy !== null} onClick={() => {
                if (window.confirm(`Delete the folder "${current}" and all ${folders.find((f) => f.name === current)?.count ?? 0} photos in it? This can't be undone.`))
                  run("delete-folder", async () => { await call("/api/admin/photos", json("DELETE", { folder: current, confirm: true })); setCurrent(ALL); return "Folder deleted."; });
              }}>Delete folder</button>
            </>)}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v,.webm" multiple className="hidden" onChange={(e) => upload(e.target.files)} aria-label="Choose photos to upload" />
            <button className={btnPrimary} disabled={busy !== null} onClick={() => (current === ALL ? setError("Open a folder first, then upload into it.") : fileRef.current?.click())}>
              {busy === "upload" ? "Uploading…" : "Upload photos or videos"}</button>
          </div>
          {error && <p className="text-[13px] text-red-600" role="alert">{error}</p>}
          {progress && <p className="text-[13px] text-[#6c757d]">Uploading {progress}</p>}
          {notice && !error && <p className="text-[13px] text-[#1ab394]">{notice}</p>}
          <p className="text-[11.5px] text-[#9ba6b7]">Photos: JPG, PNG, GIF or WebP, up to 4 MB (larger ones are shrunk automatically). Videos: MP4, MOV or WebM, up to 200 MB. For picture messages, aim for under 1 MB; videos are for links and websites, not texts. Only upload your own real photos and videos.</p>
        </div></section>

        {shown.length === 0 && <p className="text-[13px] text-[#9ba6b7]">{current === ALL ? "No photos yet. Add a folder, open it, then upload." : "This folder is empty. Click Upload photos."}</p>}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map((p) => (
            <div key={p.url} className="ibox overflow-hidden">
              {isVideoName(p.name) ? (
                <video src={p.url} controls preload="metadata" playsInline className="w-full aspect-[4/3] object-cover bg-black" aria-label={p.name} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt={p.name} loading="lazy" className="w-full aspect-[4/3] object-cover bg-[#f1f2f7]" />
              )}
              <div className="p-3 space-y-2">
                {editing?.url === p.url ? (
                  <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); const ed = editing; run("edit", async () => { await call("/api/admin/photos", json("PATCH", { action: "edit-photo", url: ed.url, name: ed.name, folder: ed.folder })); setEditing(null); return "Saved."; }); }}>
                    <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inputCls} maxLength={80} aria-label="Photo name" />
                    <select value={editing.folder} onChange={(e) => setEditing({ ...editing, folder: e.target.value })} className={inputCls} aria-label="Move to folder">
                      {folders.map((f) => <option key={f.name}>{f.name}</option>)}</select>
                    <div className="flex gap-2"><button type="submit" className={btnPrimary} disabled={busy !== null}>Save</button><button type="button" className={btnGhost} onClick={() => setEditing(null)}>Cancel</button></div>
                  </form>
                ) : (<>
                  <div className="text-[12.5px] font-semibold text-[#323a46] truncate" title={p.name}>{p.name}</div>
                  <div className="text-[11.5px] text-[#9ba6b7]">{current === ALL ? `${p.folder} · ` : ""}{kb(p.size)}{p.size > 1024 * 1024 ? (isVideoName(p.name) ? " · video" : " · large for texts") : ""}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    <button className={btnGhost} onClick={() => copyLink(p.url)}>Copy link</button>
                    <button className={btnGhost} onClick={() => setEditing({ url: p.url, name: p.name.replace(/\.[^.]+$/, ""), folder: p.folder })}>Edit</button>
                    <button className={btnGhost} disabled={busy !== null} onClick={() => { if (window.confirm(`Delete "${p.name}"? This can't be undone.`)) run("delete", async () => { await call("/api/admin/photos", json("DELETE", { url: p.url })); return "Photo deleted."; }); }}>Delete</button>
                  </div>
                </>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

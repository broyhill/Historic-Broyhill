"use client";

import React, { useCallback, useEffect, useState } from "react";

interface Item { provider: string; kind: string; id: string; thumb: string; title: string; credit: string; creditUrl: string; pageUrl: string }
interface ProviderInfo { key: string; label: string; env: string; kinds: string[]; ready: boolean }
interface Folder { name: string; count: number }

const inputCls = "w-full rounded-md border border-[#e7e9eb] px-3 py-2 text-[14px] text-[#323a46] focus:outline-none focus:border-[#1ab394]";
const btnPrimary = "h-9 px-4 rounded-md bg-[#1ab394] text-white text-[13px] font-semibold disabled:opacity-50";
const btnGhost = "h-8 px-3 rounded-md border border-[#e7e9eb] text-[#6c757d] text-[12.5px] hover:border-[#1ab394]/50 disabled:opacity-50";

// Royalty-free media types, each with its own library folder so stock never mixes with real venue photos.
const KINDS: { key: string; label: string; folder: string; hint: string }[] = [
  { key: "photo", label: "Photos", folder: "Stock Photos", hint: "Backgrounds, textures, scenery, people" },
  { key: "video", label: "Videos", folder: "Stock Videos", hint: "Short clips and loops (MP4, up to 1080p)" },
  { key: "graphic", label: "Graphics & motifs", folder: "Stock Graphics", hint: "Illustrations, patterns, icons, ornaments" },
];

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (res.status === 401) { window.location.assign("/admin/login"); throw new Error("Signed out"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

// Free Media: search Pixabay (and Pexels when a key exists), tick what you want, and add it to the library.
// Each type lands in its own folder (Stock Photos / Stock Videos / Stock Graphics). Nothing is sent anywhere.
export default function StockSearch({ onOpenLibrary }: { onOpenLibrary?: () => void }) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [provider, setProvider] = useState("pixabay");
  const [kind, setKind] = useState("photo");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Item[]>([]);
  const [picked, setPicked] = useState<Record<string, Item>>({});
  const [folders, setFolders] = useState<Folder[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadFolders = useCallback(() => { call("/api/admin/photos").then((d) => setFolders(d.folders || [])).catch(() => {}); }, []);
  useEffect(() => { call("/api/admin/photos/stock?providers=1").then((d) => setProviders(d.providers)).catch((e) => setError(e.message)); loadFolders(); }, [loadFolders]);

  const current = providers.find((p) => p.key === provider);
  const kinds = KINDS.filter((k) => !current || current.kinds.includes(k.key));
  useEffect(() => { if (current && !current.kinds.includes(kind)) setKind(current.kinds[0]); }, [current, kind]);
  const kindInfo = KINDS.find((k) => k.key === kind) ?? KINDS[0];
  const keyOf = (it: Item) => `${it.provider}:${it.kind}:${it.id}`;
  const pickedList = Object.values(picked);

  const search = async (nextPage = 1) => {
    if (!q.trim()) return;
    setBusy("search"); setError(null); setNotice(null);
    try {
      const d = await call(`/api/admin/photos/stock?provider=${provider}&kind=${kind}&q=${encodeURIComponent(q.trim())}&page=${nextPage}`);
      setItems(d.items); setPage(nextPage);
      if (!d.items.length) setNotice("Nothing found. Try a simpler word.");
    } catch (er: any) { setError(er.message); setItems([]); } finally { setBusy(null); }
  };

  const toggle = (it: Item) => setPicked((s) => { const n = { ...s }; if (n[keyOf(it)]) delete n[keyOf(it)]; else n[keyOf(it)] = it; return n; });

  // One at a time so big videos don't compete; a failure is counted and the rest continue.
  const addPicked = async () => {
    const list = pickedList;
    if (!list.length) return;
    setBusy("add"); setError(null); setNotice(null);
    let ok = 0, already = 0; const failed: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      const folder = KINDS.find((k) => k.key === it.kind)!.folder;
      setProgress(`Adding ${i + 1} of ${list.length}…`);
      try {
        const d = await call("/api/admin/photos/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: it.provider, kind: it.kind, id: it.id, folder }) });
        if (d.already) already++; else ok++;
      } catch (e: any) { failed.push(e.message); }
    }
    setPicked({}); setProgress(null); setBusy(null); loadFolders();
    const bits = [`Added ${ok} to your library.`];
    if (already) bits.push(`${already} were already there.`);
    if (failed.length) bits.push(`${failed.length} failed: ${failed[0]}`);
    (failed.length ? setError : setNotice)(bits.join(" "));
  };

  const count = (name: string) => folders.find((f) => f.name === name)?.count ?? 0;

  return (
    <div className="space-y-4 max-w-5xl">
      <section className="ibox"><div className="ibox-content space-y-3">
        <h3 className="text-sm font-semibold text-[#323a46]">Where free media goes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {KINDS.map((k) => (
            <div key={k.key} className="rounded-md border border-[#e7e9eb] p-3">
              <div className="text-[13px] font-semibold text-[#323a46]">📁 {k.folder}</div>
              <div className="text-[12px] text-[#9ba6b7]">{k.hint}</div>
              <div className="text-[12.5px] text-[#6c757d] mt-1">{count(k.folder)} item{count(k.folder) === 1 ? "" : "s"}</div>
            </div>
          ))}
        </div>
        {onOpenLibrary && <button className={btnGhost} onClick={onOpenLibrary}>Open the Photo Library</button>}
      </div></section>

      <section className="ibox"><div className="ibox-content space-y-3">
        <h3 className="text-sm font-semibold text-[#323a46]">Find royalty-free media</h3>
        <div className="flex gap-2 flex-wrap" role="tablist">
          {kinds.map((k) => (
            <button key={k.key} role="tab" aria-selected={kind === k.key} onClick={() => { setKind(k.key); setItems([]); }}
              className={`px-3 py-1.5 rounded-md text-[13px] font-semibold border ${kind === k.key ? "bg-[#1ab394] text-white border-[#1ab394]" : "border-[#e7e9eb] text-[#6c757d] hover:border-[#1ab394]/50"}`}>{k.label}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); search(1); }} className="flex gap-2 flex-wrap items-center">
          <select value={provider} onChange={(e) => { setProvider(e.target.value); setItems([]); }} className={`${inputCls} !w-auto`} aria-label="Source">
            {(providers.length ? providers : [{ key: "pixabay", label: "Pixabay" }] as ProviderInfo[]).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. brick building, wedding table, autumn leaves, gold flourish" maxLength={100} className={`${inputCls} flex-1 min-w-[200px]`} aria-label="Search" />
          <button type="submit" className={btnPrimary} disabled={busy !== null || !q.trim()}>{busy === "search" ? "Searching…" : "Search"}</button>
        </form>
        {current && !current.ready && <p className="text-[12.5px] text-[#b7791f]">{current.label.split(" (")[0]} isn't switched on yet. Add the key <b>{current.env}</b> in Vercel and redeploy.</p>}
        {error && <p className="text-[13px] text-red-600" role="alert">{error}</p>}
        {progress && <p className="text-[13px] text-[#6c757d]">{progress}</p>}
        {notice && !error && <p className="text-[13px] text-[#1ab394]">{notice}</p>}

        {pickedList.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-[12.5px] text-[#6c757d]">
            <span className="font-semibold text-[#323a46]">{pickedList.length} selected</span>
            <button className={btnPrimary} disabled={busy !== null} onClick={addPicked}>{busy === "add" ? "Adding…" : `Add ${pickedList.length} to library`}</button>
            <button className={btnGhost} disabled={busy !== null} onClick={() => setPicked({})}>Clear</button>
            <span>→ goes to “{kindInfo.folder}” (by type)</span>
          </div>
        )}

        {items.length > 0 && (<>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((it) => {
              const on = Boolean(picked[keyOf(it)]);
              return (
                <div key={keyOf(it)} className={`relative rounded-md border overflow-hidden ${on ? "border-[#1ab394] ring-2 ring-[#1ab394]" : "border-[#e7e9eb]"}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(it)} className="absolute top-2 left-2 z-10 h-5 w-5 accent-[#1ab394]" aria-label={`Select ${it.title}`} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.thumb} alt={it.title} loading="lazy" className="w-full aspect-[4/3] object-cover bg-[#f1f2f7]" />
                  <div className="p-2 text-[11.5px] text-[#9ba6b7] truncate" title={it.title}>
                    {it.credit ? <a href={it.creditUrl} target="_blank" rel="noreferrer" className="underline">{it.credit}</a> : "—"}{kind === "video" ? " · video" : ""}</div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button className={btnGhost} disabled={busy !== null || page <= 1} onClick={() => search(page - 1)}>Previous</button>
            <span className="text-[12px] text-[#9ba6b7] self-center">Page {page}</span>
            <button className={btnGhost} disabled={busy !== null} onClick={() => search(page + 1)}>More</button>
          </div>
        </>)}
        <p className="text-[11.5px] text-[#9ba6b7]">Pixabay and Pexels content is free to use commercially and credit isn't required. Selected items are copied into our own storage. Keep stock separate from real photos of the venue: don't use a stock picture to suggest it shows our rooms, or that the people in it endorse us.</p>
      </div></section>
    </div>
  );
}

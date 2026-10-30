"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CHANNELS, examples, type Example, type ExampleChannel } from "@/lib/examples";
import { PLATFORMS } from "@/lib/social";
import { renderHtml, type Design } from "@/lib/studio";
import { starterById } from "@/lib/studio-starters";
import { totalSeconds } from "@/lib/video";
import { defaultSettings, type TemplateSettings } from "@/lib/template-categories";
import { useBrand } from "@/lib/use-brand";
import type { BrandKit } from "@/lib/brand";

const btnPrimary = "min-h-[44px] sm:min-h-[40px] px-4 rounded-md bg-accent-deep text-white text-[13px] font-semibold hover:bg-navy disabled:opacity-50";
const btnGhost = "min-h-[44px] sm:min-h-[40px] px-3 rounded-md border border-line text-muted text-[13px] hover:border-accent/50 hover:text-ink disabled:opacity-50";

export default function ExamplesPanel({ onUse, initialChannel }: { onUse: (ex: Example) => void; initialChannel?: ExampleChannel | null }) {
  const [channel, setChannel] = useState<ExampleChannel | "">(initialChannel ?? "");
  const [category, setCategory] = useState("");
  const [settings, setSettings] = useState<TemplateSettings>(defaultSettings());
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/admin/template-settings").then((r) => (r.ok ? r.json() : null)).then((d) => d?.settings && setSettings(d.settings)).catch(() => {});
  }, []);
  const kit = useBrand();
  const all = useMemo(() => examples(kit), [kit]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of all) if (!channel || e.channel === channel) c[e.category] = (c[e.category] || 0) + 1;
    return c;
  }, [all, channel]);
  const shown = all.filter((e) => (!channel || e.channel === channel) && (!category || e.category === category));
  const categories = Array.from(new Set([...settings.categories, ...all.map((e) => e.category)]));

  const copy = async (ex: Example, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(ex.id); setTimeout(() => setCopied(null), 1600); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-muted max-w-3xl">Finished pieces for every channel, filed by who they are for. Pick one and it opens in the right tool with everything filled in — change the words, keep the look. Nothing is sent or posted from here.</p>

      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Channel">
        {[{ key: "" as const, label: "All" }, ...CHANNELS].map((c) => {
          const n = c.key ? all.filter((e) => e.channel === c.key).length : all.length;
          return (
            <button key={c.key || "all"} role="tab" aria-selected={channel === c.key} onClick={() => setChannel(c.key)}
              className={`min-h-[40px] px-4 rounded-md text-[13px] font-semibold border ${channel === c.key ? "bg-accent text-white border-accent" : "border-line text-muted hover:border-accent/50"}`}>
              {c.label} <span className={channel === c.key ? "text-white/80 font-normal" : "text-subtle font-normal"}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter by audience">
        {["", ...categories].map((c) => {
          const n = c ? counts[c] || 0 : shown.length && !category ? shown.length : Object.values(counts).reduce((a, b) => a + b, 0);
          if (c && n === 0) return null;
          return (
            <button key={c || "all"} onClick={() => setCategory(c)} aria-pressed={category === c}
              className={`min-h-[36px] px-3 rounded-full text-[12px] border ${category === c ? "bg-ink text-white border-ink" : "border-line text-muted hover:border-accent/50"}`}>
              {c || "Everyone"} <span className={category === c ? "text-white/70" : "text-subtle"}>{n}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 && <p className="text-[13px] text-subtle">Nothing here yet for that mix.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {shown.map((ex) => (
          <article key={ex.id} className="rounded-lg border border-line bg-white overflow-hidden flex flex-col hover:border-accent transition-colors motion-reduce:transition-none">
            <Preview ex={ex} kit={kit} />
            <div className="p-3 flex-1 flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-subtle">{CHANNELS.find((c) => c.key === ex.channel)?.label} · {ex.category} · {ex.kind}</span>
              <span className="text-[14px] font-semibold text-ink leading-tight">{ex.title}</span>
              <span className="text-[12.5px] text-muted">{ex.description}</span>
              <div className="mt-auto pt-2 flex items-center gap-2">
                <button type="button" className={btnPrimary} onClick={() => onUse(ex)}>
                  {ex.channel === "photo" ? "Use in a post" : `Open in ${CHANNELS.find((c) => c.key === ex.channel)?.tool}`}
                </button>
                {(ex.channel === "sms" || ex.channel === "mms" || ex.channel === "social" || ex.channel === "photo") && (
                  <button type="button" className={btnGhost} onClick={() => copy(ex, ex.channel === "photo" ? ex.photo.url : ex.channel === "social" ? `${ex.social.caption}\n\n${ex.social.hashtags.map((t) => `#${t}`).join(" ")}` : ex.text.body)}>
                    {copied === ex.id ? "Copied" : ex.channel === "photo" ? "Copy link" : "Copy text"}
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Preview({ ex, kit }: { ex: Example; kit: BrandKit }) {
  switch (ex.channel) {
    case "email": {
      const st = starterById(ex.starterId, kit);
      return st ? <EmailThumb design={st.design} title={ex.title} /> : <div className="h-56 bg-canvas" />;
    }
    case "social": {
      const p = PLATFORMS[ex.social.platform];
      return (
        <div className="bg-navy-deep p-3">
          <div className="mx-auto max-w-[340px] overflow-hidden rounded-xl bg-white shadow text-left">
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white">HB</div>
              <div><div className="text-[12.5px] font-semibold text-ink leading-tight">Historic Broyhill</div><div className="text-[11px] text-muted">{p.label}</div></div>
            </div>
            {ex.social.platform !== "instagram" && <p className="px-3 pb-2 text-[12.5px] text-ink line-clamp-3">{ex.social.caption}</p>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ex.social.photo} alt={ex.social.imageAlt} className="w-full object-cover" style={{ aspectRatio: p.ratio.replace(" / ", "/") }} loading="lazy" />
            {ex.social.platform === "instagram" && <p className="px-3 py-2 text-[12.5px] text-ink line-clamp-2"><strong>historicbroyhill </strong>{ex.social.caption}</p>}
          </div>
        </div>
      );
    }
    case "sms":
    case "mms":
      return (
        <div className="bg-canvas p-4 h-56 flex items-end">
          <div className="max-w-[88%] space-y-1">
            {ex.channel === "mms" && ex.text.mediaUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ex.text.mediaUrl} alt="" className="rounded-2xl rounded-bl-md w-48 aspect-[4/3] object-cover" loading="lazy" />
            )}
            <div className="rounded-2xl rounded-bl-md bg-line/70 px-3 py-2 text-[13px] text-ink leading-snug line-clamp-5">{ex.text.body}</div>
            <div className="text-[11px] text-muted pl-1">{ex.channel.toUpperCase()} · {ex.text.body.length} characters</div>
          </div>
        </div>
      );
    case "photo":
      return (
        <div className="h-56 bg-canvas">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ex.photo.url} alt={ex.photo.alt} className="h-full w-full object-cover" loading="lazy" />
        </div>
      );
    case "video": {
      const sb = ex.video.storyboard;
      return (
        <div className="bg-navy-deep p-3 h-56 flex flex-col gap-2">
          <div className="grid grid-cols-3 grid-rows-2 gap-1.5 flex-1 min-h-0 overflow-hidden">
            {sb.scenes.filter((s) => s.kind === "photo").slice(0, 6).map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={s.id} src={s.url} alt={s.alt} className="h-full w-full min-h-0 object-cover rounded" loading="lazy" />
            ))}
          </div>
          <div className="flex items-center justify-between text-[11.5px] text-white/80">
            <span>{sb.scenes.length} scenes · {Math.round(totalSeconds(sb))} s · 1280×720</span>
            <span className="truncate pl-2">“{sb.scenes[0]?.caption}”</span>
          </div>
        </div>
      );
    }
  }
}

function EmailThumb({ design, title }: { design: Design; title: string }) {
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

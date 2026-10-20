// Video Studio: a storyboard of scenes (a picture, how long, a caption, a gentle camera move) plus an
// optional music track. The same data drives the in-browser preview and the render, so what you see is
// what you get. Pure functions only (no network, no database) so they can be tested on their own.
import { safeUrl } from "./studio";

export const MAX_SCENES = 24;
export const MIN_SECONDS = 1.5;
export const MAX_SECONDS = 12;
export const MAX_CAPTION = 120;
export const FADE_SECONDS = 0.5;
export const VENUE_ADDRESS_LINE = "3540 Clemmons Road · Clemmons, NC";

export type Motion = "none" | "push" | "pull";
export type CaptionPos = "lower" | "center";

export interface Scene {
  id: string;
  kind: "photo" | "endcard";
  url: string;         // picture (photo) or logo (endcard)
  alt: string;
  seconds: number;
  caption: string;
  captionPos: CaptionPos;
  motion: Motion;
}
export interface Music { url: string; name: string; volume: number; fadeOutSeconds: number }
export interface Storyboard { scenes: Scene[]; music: Music | null; width: number; height: number; fps: number }

export const emptyStoryboard = (): Storyboard => ({ scenes: [], music: null, width: 1280, height: 720, fps: 30 });

let counter = 0;
export const newSceneId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;
const clampNum = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");

export function newScene(url: string, alt = ""): Scene {
  return { id: newSceneId(), kind: "photo", url: safeUrl(url), alt: alt.slice(0, 200), seconds: 4, caption: "", captionPos: "lower", motion: "push" };
}

export function normalizeStoryboard(raw: unknown): Storyboard {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const scenes: Scene[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(r.scenes) ? r.scenes.slice(0, MAX_SCENES) : []) {
    if (!item || typeof item !== "object") continue;
    const x = item as Record<string, unknown>;
    let id = clip(x.id, 40).replace(/[^\w-]/g, "") || newSceneId();
    if (seen.has(id)) id = newSceneId();
    seen.add(id);
    const url = safeUrl(x.url);
    if (!url) continue; // a scene with no valid picture can't be shown
    scenes.push({
      id, kind: x.kind === "endcard" ? "endcard" : "photo", url, alt: clip(x.alt, 200),
      seconds: clampNum(x.seconds, MIN_SECONDS, MAX_SECONDS, 4),
      caption: clip(x.caption, MAX_CAPTION),
      captionPos: x.captionPos === "center" ? "center" : "lower",
      motion: x.motion === "none" || x.motion === "pull" ? x.motion : "push",
    });
  }
  let music: Music | null = null;
  const m = r.music && typeof r.music === "object" ? (r.music as Record<string, unknown>) : null;
  if (m && safeUrl(m.url)) music = { url: safeUrl(m.url), name: clip(m.name, 120), volume: clampNum(m.volume, 0, 1, 0.8), fadeOutSeconds: clampNum(m.fadeOutSeconds, 0, 8, 3) };
  return { scenes, music, width: 1280, height: 720, fps: 30 };
}

export const totalSeconds = (s: Storyboard) => s.scenes.reduce((t, sc) => t + sc.seconds, 0);

export interface Frame { sceneIndex: number; scene: Scene; local: number; progress: number; opacity: number; zoom: number }

// What to draw at a moment in time: which scene, how far into it, how opaque (soft fade at the edges), how zoomed.
export function frameAt(s: Storyboard, t: number): Frame | null {
  if (!s.scenes.length) return null;
  let start = 0;
  for (let i = 0; i < s.scenes.length; i++) {
    const sc = s.scenes[i];
    if (t < start + sc.seconds || i === s.scenes.length - 1) {
      const local = Math.min(Math.max(t - start, 0), sc.seconds);
      const progress = sc.seconds > 0 ? local / sc.seconds : 0;
      const fade = Math.min(FADE_SECONDS, sc.seconds / 3);
      const opacity = Math.min(1, local / fade, (sc.seconds - local) / fade);
      const zoom = sc.motion === "push" ? 1 + 0.06 * progress : sc.motion === "pull" ? 1.06 - 0.06 * progress : 1;
      return { sceneIndex: i, scene: sc, local, progress, opacity: Math.max(0, Math.min(1, opacity)), zoom };
    }
    start += sc.seconds;
  }
  return null;
}

export const musicGain = (s: Storyboard, t: number) => {
  if (!s.music) return 0;
  const total = totalSeconds(s);
  const f = s.music.fadeOutSeconds;
  const left = total - t;
  return s.music.volume * (f > 0 && left < f ? Math.max(0, left / f) : 1);
};

// ---- Commands: Claude proposes small edits; this checks and applies them. ----
export interface VOp {
  op: string; sceneId: string; afterId: string;
  url: string; alt: string; caption: string; captionPos: string; motion: string; seconds: number; volume: number; fadeOutSeconds: number;
}
export const blankVOp = (): VOp => ({ op: "", sceneId: "", afterId: "", url: "", alt: "", caption: "", captionPos: "", motion: "", seconds: 0, volume: 0, fadeOutSeconds: 0 });
export interface VApply { storyboard: Storyboard; applied: string[]; skipped: string[] }

const label = (sc: Scene, i: number) => `scene ${i + 1}${sc.caption ? ` “${sc.caption.slice(0, 28)}”` : ""}`;

export function applyVideoOps(input: Storyboard, ops: VOp[], allowedImages: Set<string>): VApply {
  let sb = normalizeStoryboard(input);
  const applied: string[] = [];
  const skipped: string[] = [];
  const idx = (id: string) => sb.scenes.findIndex((x) => x.id === id);
  const upd = (i: number, patch: Partial<Scene>) => { sb = { ...sb, scenes: sb.scenes.map((x, k) => (k === i ? { ...x, ...patch } : x)) }; };

  for (const o of ops.slice(0, 15)) {
    const i = idx(o.sceneId);
    const sc = i >= 0 ? sb.scenes[i] : undefined;
    switch (o.op) {
      case "set_caption": {
        if (!sc) { skipped.push("Couldn't find the scene to caption."); break; }
        upd(i, { caption: o.caption.slice(0, MAX_CAPTION) });
        applied.push(o.caption.trim() ? `Set the caption of ${label(sc, i)}` : `Cleared the caption of ${label(sc, i)}`);
        break;
      }
      case "set_seconds": {
        if (!sc) { skipped.push("Couldn't find the scene to retime."); break; }
        const s = clampNum(o.seconds, MIN_SECONDS, MAX_SECONDS, sc.seconds);
        upd(i, { seconds: s }); applied.push(`Set ${label(sc, i)} to ${s}s`); break;
      }
      case "set_motion": {
        if (!sc || !(o.motion === "none" || o.motion === "push" || o.motion === "pull")) { skipped.push("Couldn't change that camera move."); break; }
        upd(i, { motion: o.motion }); applied.push(`Camera move for ${label(sc, i)}: ${o.motion}`); break;
      }
      case "set_caption_position": {
        if (!sc || !(o.captionPos === "lower" || o.captionPos === "center")) { skipped.push("Couldn't move that caption."); break; }
        upd(i, { captionPos: o.captionPos }); applied.push(`Moved the caption of ${label(sc, i)} to the ${o.captionPos}`); break;
      }
      case "set_picture": {
        const u = safeUrl(o.url);
        if (!sc || sc.kind !== "photo") { skipped.push("Couldn't find the scene to change."); break; }
        if (!u || !allowedImages.has(u)) { skipped.push("Left the picture alone: it isn't in your Photo Library."); break; }
        upd(i, { url: u, alt: o.alt.trim() ? o.alt.trim().slice(0, 200) : sc.alt }); applied.push(`Changed the picture in ${label(sc, i)}`); break;
      }
      case "add_scene": {
        const u = safeUrl(o.url);
        if (sb.scenes.length >= MAX_SCENES) { skipped.push("The video already has the most scenes allowed."); break; }
        if (!u || !allowedImages.has(u)) { skipped.push("Skipped adding a scene: that picture isn't in your Photo Library."); break; }
        const ns = { ...newScene(u, o.alt), caption: o.caption.slice(0, MAX_CAPTION), seconds: clampNum(o.seconds, MIN_SECONDS, MAX_SECONDS, 4) };
        const at = o.afterId === "START" ? 0 : o.afterId && idx(o.afterId) >= 0 ? idx(o.afterId) + 1 : sb.scenes.length;
        const next = sb.scenes.slice(); next.splice(at, 0, ns); sb = { ...sb, scenes: next };
        applied.push(`Added a scene at position ${at + 1}`); break;
      }
      case "remove_scene": {
        if (!sc) { skipped.push("Couldn't find the scene to remove."); break; }
        sb = { ...sb, scenes: sb.scenes.filter((x) => x.id !== sc.id) }; applied.push(`Removed ${label(sc, i)}`); break;
      }
      case "move_scene": {
        if (!sc) { skipped.push("Couldn't find the scene to move."); break; }
        const rest = sb.scenes.filter((x) => x.id !== sc.id);
        const at = o.afterId === "START" ? 0 : o.afterId && rest.findIndex((x) => x.id === o.afterId) >= 0 ? rest.findIndex((x) => x.id === o.afterId) + 1 : rest.length;
        rest.splice(at, 0, sc); sb = { ...sb, scenes: rest }; applied.push(`Moved ${label(sc, i)}`); break;
      }
      case "set_music": {
        if (!sb.music) { skipped.push("There's no music on this video yet. Add a track first."); break; }
        sb = { ...sb, music: { ...sb.music, volume: o.volume > 0 || o.volume === 0 ? clampNum(o.volume, 0, 1, sb.music.volume) : sb.music.volume, fadeOutSeconds: o.fadeOutSeconds >= 0 ? clampNum(o.fadeOutSeconds, 0, 8, sb.music.fadeOutSeconds) : sb.music.fadeOutSeconds } };
        applied.push("Adjusted the music"); break;
      }
      default: skipped.push("Skipped something I didn't understand.");
    }
  }
  return { storyboard: sb, applied, skipped };
}

export function withShortSceneIds(sb: Storyboard) {
  const toReal = new Map<string, string>();
  const toShort = new Map<string, string>();
  sb.scenes.forEach((s, i) => { toReal.set(`s${i + 1}`, s.id); toShort.set(s.id, `s${i + 1}`); });
  return { toReal, toShort };
}

export interface VideoIssue { sceneId?: string; message: string }
export function videoIssues(sb: Storyboard): VideoIssue[] {
  const out: VideoIssue[] = [];
  if (!sb.scenes.length) out.push({ message: "Add at least one picture." });
  for (const s of sb.scenes) if (s.kind === "photo" && !s.alt.trim()) out.push({ sceneId: s.id, message: "Describe this picture in a few words (for people who can't see it)." });
  if (totalSeconds(sb) > 90) out.push({ message: "Over 90 seconds: short videos are watched more." });
  return out;
}

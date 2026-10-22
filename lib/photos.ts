// Photo library helpers. Photos live in Vercel Blob under photos/<folder>/<file>, one folder level
// (categories), so there is no database table: a folder exists because a ".keep" marker or a photo is in it.

export const PHOTO_ROOT = "photos/";
export const KEEP_FILE = ".keep";
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // serverless request bodies are capped around 4.5 MB
export const ALLOWED_EXT = ["jpg", "jpeg", "png", "gif", "webp"] as const;
// Videos are too big for a normal request, so the browser uploads them straight to storage
// (see app/api/admin/photos/upload/route.ts).
export const VIDEO_EXT = ["mp4", "mov", "m4v", "webm"] as const;
// Music and sound effects (royalty-free tracks you are licensed to use) also live in the library, e.g. in a "Music" folder.
export const AUDIO_EXT = ["mp3", "m4a", "wav", "ogg"] as const;
export const AUDIO_TYPES = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/wav", "audio/x-wav", "audio/wave", "audio/ogg"];
export const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
export const VIDEO_TYPES =["video/mp4", "video/quicktime", "video/x-m4v", "video/webm"];
export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024; // 1 GB: finished videos from InVideo etc. run to hundreds of MB
// Pictures also go straight to storage now, so originals are kept at full size.
export const MAX_PHOTO_BYTES = 40 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
export const SUGGESTED_FOLDERS = ["General", "General-Videos", "Music", "Sound Effects","Building & grounds", "Magnolia Room", "The Boardrooms", "The Dock", "The Loft", "Events", "Videos", "Logos"];

export const extOf = (file: string) => (file.includes(".") ? file.split(".").pop()!.toLowerCase() : "");
export const isVideoName = (file: string) => (VIDEO_EXT as readonly string[]).includes(extOf(file));
export const isAudioName = (file: string) => (AUDIO_EXT as readonly string[]).includes(extOf(file));
export const isImageName = (file: string) => (ALLOWED_EXT as readonly string[]).includes(extOf(file));

// Letters, digits, spaces and a few safe symbols only; no slashes or dots that could escape the folder.
export function cleanFolder(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  return s.normalize("NFKC").replace(/[^A-Za-z0-9 &'_-]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
}

// Keeps the extension, cleans the rest. Returns "" if the extension is not an allowed image type.
export function cleanFileName(raw: unknown): string {
  const s = (typeof raw === "string" ? raw : "").normalize("NFKC").split(/[\\/]/).pop() || "";
  const dot = s.lastIndexOf(".");
  const ext = dot > -1 ? s.slice(dot + 1).toLowerCase() : "";
  if (!(ALLOWED_EXT as readonly string[]).includes(ext) && !(VIDEO_EXT as readonly string[]).includes(ext) && !(AUDIO_EXT as readonly string[]).includes(ext)) return "";
  const base = s.slice(0, dot).replace(/[^A-Za-z0-9 _-]/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "photo";
  return `${base}.${ext}`;
}

export const photoPath = (folder: string, file: string) => `${PHOTO_ROOT}${folder}/${file}`;

export function contentTypeFor(file: string): string {
  const ext = extOf(file);
  if (ext === "mp4") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  if (ext === "m4v") return "video/x-m4v";
  if (ext === "webm") return "video/webm";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "m4a") return "audio/mp4";
  if (ext === "wav") return "audio/wav";
  if (ext === "ogg") return "audio/ogg";
  return ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
}

export interface ParsedPath { folder: string; name: string }

// "photos/The Dock/band.jpg" -> { folder: "The Dock", name: "band.jpg" }. Null for anything outside photos/<folder>/<file>.
export function parsePath(pathname: string): ParsedPath | null {
  if (!pathname.startsWith(PHOTO_ROOT)) return null;
  const parts = pathname.slice(PHOTO_ROOT.length).split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { folder: parts[0], name: parts[1] };
}

// A link may only be edited or deleted if it points into our own store under photos/.
export function pathFromStoreUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || !u.hostname.endsWith(".blob.vercel-storage.com")) return null;
    const pathname = decodeURIComponent(u.pathname.replace(/^\//, ""));
    return pathname.startsWith(PHOTO_ROOT) && !pathname.includes("..") ? pathname : null;
  } catch { return null; }
}

// Browser-side video shrinking (ffmpeg.wasm, single thread, no special server headers needed).
// Makes a smaller "web copy" of a big video; the original is always uploaded first and never replaced.
// Everything here is best effort: any failure returns null and the caller carries on.
export const COMPRESS_MIN_BYTES = 50 * 1024 * 1024;   // smaller videos are left alone
export const COMPRESS_MAX_BYTES = 300 * 1024 * 1024;  // bigger ones don't fit in browser memory
const CORE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

export const shouldCompress = (size: number) => size >= COMPRESS_MIN_BYTES && size <= COMPRESS_MAX_BYTES;
export const webCopyName = (name: string) => name.replace(/\.[^.]+$/, "") + "-web.mp4";

export async function compressVideo(file: File, onProgress?: (pct: number) => void): Promise<File | null> {
  try {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { fetchFile, toBlobURL } = await import("@ffmpeg/util");
    const ff = new FFmpeg();
    ff.on("progress", ({ progress }) => onProgress?.(Math.max(0, Math.min(100, Math.round(progress * 100)))));
    await ff.load({
      coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    const input = "in" + (file.name.match(/\.[^.]+$/)?.[0] || ".mp4");
    await ff.writeFile(input, await fetchFile(file));
    // 1080p at most, H.264 + AAC, fast-start so it plays while loading.
    const code = await ff.exec(["-i", input, "-vf", "scale='min(1920,iw)':-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "out.mp4"]);
    if (code !== 0) return null;
    const data = await ff.readFile("out.mp4");
    ff.terminate();
    if (typeof data === "string" || data.byteLength === 0 || data.byteLength >= file.size) return null; // not smaller: keep the original only
    return new File([data as BlobPart], webCopyName(file.name), { type: "video/mp4" });
  } catch {
    return null;
  }
}

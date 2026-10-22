import { NextResponse } from "next/server";
import { copy, del, list, put } from "@vercel/blob";
import {
  ALLOWED_EXT, KEEP_FILE, MAX_UPLOAD_BYTES, PHOTO_ROOT, cleanFileName, cleanFolder, contentTypeFor, isVideoName, parsePath, pathFromStoreUrl, photoPath,
} from "@/lib/photos";

export const maxDuration = 60;

const notConnected = () =>
  NextResponse.json({ error: "Photo storage isn't connected yet. Create the hb-photos Blob store in Vercel and connect it to this project.", notConnected: true }, { status: 503 });
const connected = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

async function listAll() {
  const out: Awaited<ReturnType<typeof list>>["blobs"] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 10; i++) {
    const page = await list({ prefix: PHOTO_ROOT, limit: 1000, cursor });
    out.push(...page.blobs);
    if (!page.hasMore || !page.cursor) break;
    cursor = page.cursor;
  }
  return out;
}

// Library contents: every folder with its photo count, and every photo. Auth via /api/admin middleware.
export async function GET() {
  if (!connected()) return notConnected();
  try {
    const blobs = await listAll();
    const counts = new Map<string, number>();
    const photos: { url: string; folder: string; name: string; size: number; uploadedAt: string }[] = [];
    for (const b of blobs) {
      const p = parsePath(b.pathname);
      if (!p) continue;
      if (!counts.has(p.folder)) counts.set(p.folder, 0);
      if (p.name === KEEP_FILE) continue;
      counts.set(p.folder, (counts.get(p.folder) || 0) + 1);
      photos.push({ url: b.url, folder: p.folder, name: p.name, size: b.size, uploadedAt: new Date(b.uploadedAt).toISOString() });
    }
    const folders = Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
    photos.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    return NextResponse.json({ success: true, folders, photos });
  } catch (error: any) {
    console.error("photos list failed", error);
    return bad("Could not load the photo library.", 500);
  }
}

// Upload (multipart: folder + file) or create a folder (JSON: { action: "create-folder", name }).
export async function POST(request: Request) {
  if (!connected()) return notConnected();
  try {
    if ((request.headers.get("content-type") || "").includes("application/json")) {
      const b = await request.json().catch(() => ({}));
      if (b.action !== "create-folder") return bad("Unknown action.");
      const folder = cleanFolder(b.name);
      if (!folder) return bad("Give the folder a name (letters and numbers).");
      await put(photoPath(folder, KEEP_FILE), "", { access: "public", allowOverwrite: true, addRandomSuffix: false, contentType: "text/plain" });
      return NextResponse.json({ success: true, folder });
    }

    const form = await request.formData();
    const folder = cleanFolder(form.get("folder"));
    const file = form.get("file");
    if (!folder) return bad("Choose a folder first.");
    if (!(file instanceof File)) return bad("No photo was sent.");
    const name = cleanFileName(file.name);
    if (!name) return bad(`Only ${ALLOWED_EXT.join(", ")} pictures and mp4, mov or webm videos can be uploaded.`);
    if (isVideoName(name)) return bad("Videos upload directly from the page; this route is for pictures.");
    if (file.size > MAX_UPLOAD_BYTES) return bad("That picture is over 4 MB. Make it smaller and try again.", 413);

    const blob = await put(photoPath(folder, name), file, { access: "public", addRandomSuffix: true, contentType: contentTypeFor(name) });
    return NextResponse.json({ success: true, url: blob.url });
  } catch (error: any) {
    console.error("photo upload failed", error);
    return bad("Could not upload that photo.", 500);
  }
}

// Edit: rename or move one photo, or rename a folder.
export async function PATCH(request: Request) {
  if (!connected()) return notConnected();
  try {
    const b = await request.json().catch(() => ({}));

    if (b.action === "edit-photo") {
      const oldPath = pathFromStoreUrl(b.url);
      const from = oldPath ? parsePath(oldPath) : null;
      if (!oldPath || !from) return bad("That photo isn't in the library.");
      const folder = cleanFolder(b.folder) || from.folder;
      const name = b.name ? cleanFileName(`${String(b.name).replace(/\.[A-Za-z0-9]+$/, "")}.${from.name.split(".").pop()}`) : from.name;
      if (!name) return bad("Give the photo a name.");
      if (folder === from.folder && name === from.name) return NextResponse.json({ success: true, url: b.url });
      const moved = await copy(b.url, photoPath(folder, name), { access: "public", addRandomSuffix: true });
      await del(b.url);
      return NextResponse.json({ success: true, url: moved.url });
    }

    // Move many photos to one folder, keeping each file's name. { urls: string[] (max 50), folder }.
    // Copies first, deletes the original only after its copy succeeded, so a failure never loses a photo.
    if (b.action === "move-many") {
      const folder = cleanFolder(b.folder);
      if (!folder) return bad("Pick a folder to move them to.");
      if (!Array.isArray(b.urls) || !b.urls.length || b.urls.length > 50) return bad("Send between 1 and 50 photos at a time.");
      const known = await listAll();
      if (!known.some((x) => parsePath(x.pathname)?.folder === folder)) return bad("That folder doesn't exist.", 404);
      let moved = 0, skipped = 0, failed = 0;
      for (const url of b.urls) {
        const oldPath = pathFromStoreUrl(url);
        const from = oldPath ? parsePath(oldPath) : null;
        if (!oldPath || !from) { failed++; continue; }
        if (from.folder === folder) { skipped++; continue; }
        try {
          await copy(url, photoPath(folder, from.name), { access: "public", addRandomSuffix: false });
          await del(url);
          moved++;
        } catch { failed++; }
      }
      return NextResponse.json({ success: true, moved, skipped, failed });
    }

    if (b.action === "rename-folder") {
      const from = cleanFolder(b.from);
      const to = cleanFolder(b.to);
      if (!from || !to) return bad("Both folder names are needed.");
      if (from === to) return NextResponse.json({ success: true });
      const blobs = (await listAll()).filter((x) => parsePath(x.pathname)?.folder === from);
      if (!blobs.length) return bad("That folder doesn't exist.", 404);
      const all = await listAll();
      if (all.some((x) => parsePath(x.pathname)?.folder === to)) return bad(`A folder named "${to}" already exists.`, 409);
      for (const blob of blobs) {
        await copy(blob.url, photoPath(to, parsePath(blob.pathname)!.name), { access: "public", addRandomSuffix: false });
      }
      await del(blobs.map((x) => x.url));
      return NextResponse.json({ success: true });
    }
    return bad("Unknown action.");
  } catch (error: any) {
    console.error("photo edit failed", error);
    return bad("Could not save that change.", 500);
  }
}

// Delete one photo ({ url }) or a whole folder ({ folder, confirm: true }).
export async function DELETE(request: Request) {
  if (!connected()) return notConnected();
  try {
    const b = await request.json().catch(() => ({}));
    if (b.url) {
      if (!pathFromStoreUrl(b.url)) return bad("That photo isn't in the library.");
      await del(b.url);
      return NextResponse.json({ success: true });
    }
    const folder = cleanFolder(b.folder);
    if (!folder || b.confirm !== true) return bad("Say which folder to delete.");
    const blobs = (await listAll()).filter((x) => parsePath(x.pathname)?.folder === folder);
    if (blobs.length) await del(blobs.map((x) => x.url));
    return NextResponse.json({ success: true, deleted: blobs.length });
  } catch (error: any) {
    console.error("photo delete failed", error);
    return bad("Could not delete that.", 500);
  }
}

import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { MAX_VIDEO_BYTES, VIDEO_TYPES, isVideoName, parsePath } from "@/lib/photos";

// Hands the browser a one-time upload token so large videos go straight to storage.
// Only an admin can reach this (/api/admin middleware), and the token is limited to
// photos/<folder>/<file> paths, video types only, and a maximum size.
// (Vercel also calls this URL when an upload finishes; middleware turns that away, which is harmless
// because nothing here needs the callback.)
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Photo storage isn't connected yet.", notConnected: true }, { status: 503 });
  }
  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const p = parsePath(pathname);
        if (!p || !isVideoName(p.name)) throw new Error("Only videos in a library folder can be uploaded this way.");
        return { allowedContentTypes: VIDEO_TYPES, maximumSizeInBytes: MAX_VIDEO_BYTES, addRandomSuffix: true };
      },
    });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Could not start the upload." }, { status: 400 });
  }
}

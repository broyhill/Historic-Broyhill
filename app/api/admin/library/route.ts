import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// The knowledge base the wizard brain reads from — editable folders of
// competitors, benchmarks, ad snapshots, microsegments, venue facts, memory.
// GET ?folder= → rows; POST { folder, title, data, note? } → add.
export async function GET(req: NextRequest) {
  const folder = req.nextUrl.searchParams.get("folder");
  const where = folder ? { folder } : {};
  const entries = await prisma.knowledgeEntry.findMany({
    where,
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.folder || !body?.title || body?.data === undefined) {
    return NextResponse.json({ error: "folder, title and data are required" }, { status: 400 });
  }
  const entry = await prisma.knowledgeEntry.create({
    data: {
      folder: String(body.folder),
      title: String(body.title),
      data: body.data,
      note: body.note ? String(body.note) : null,
    },
  });
  return NextResponse.json({ entry }, { status: 201 });
}

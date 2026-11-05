import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH { title?, data?, note?, enabled? } → edit a knowledge entry.
// DELETE → remove it.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "body required" }, { status: 400 });
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = String(body.title);
  if (body.data !== undefined) data.data = body.data;
  if (body.note !== undefined) data.note = body.note ? String(body.note) : null;
  if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
  const entry = await prisma.knowledgeEntry.update({ where: { id }, data }).catch(() => null);
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ entry });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.knowledgeEntry.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

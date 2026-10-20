import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureCampaignTable } from "@/lib/campaigns-db";
import { loadSettings, saveSettings } from "@/lib/template-settings";
import { applyOp, type ListName, type Op } from "@/lib/template-categories";

const list = (v: unknown): ListName | null => (v === "categories" || v === "kinds" ? v : null);
const text = (v: unknown) => (typeof v === "string" ? v : "");

// Read the category/type lists, or change them: add, rename, delete, hide a starter, restore starters.
// Renaming or deleting also relabels saved templates; deleting never deletes a template, it just
// clears its label. Auth via /api/admin middleware.
export async function GET() {
  try {
    return NextResponse.json({ success: true, settings: await loadSettings() });
  } catch (error: any) {
    console.error("template settings failed", error);
    return NextResponse.json({ error: "Could not load the category lists." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const b = await request.json().catch(() => ({}));
    const l = list(b.list);
    let op: Op | null = null;
    if (b.action === "add" && l) op = { action: "add", list: l, name: text(b.name) };
    else if (b.action === "rename" && l) op = { action: "rename", list: l, from: text(b.from), to: text(b.to) };
    else if (b.action === "delete" && l) op = { action: "delete", list: l, name: text(b.name) };
    else if (b.action === "hide") op = { action: "hide", id: text(b.id).slice(0, 80) };
    else if (b.action === "restore") op = { action: "restore" };
    if (!op) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

    const current = await loadSettings();
    const result = applyOp(current, op);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

    let relabeled = 0;
    if (result.relabel) {
      // Saved templates keep their labels inside aiBrief, so walk them and rewrite the matching ones.
      await ensureCampaignTable();
      const key = result.relabel.list === "categories" ? "category" : "kind";
      const rows = await prisma.emailCampaign.findMany({ where: { status: "TEMPLATE" }, select: { id: true, aiBrief: true } });
      for (const row of rows) {
        const brief = row.aiBrief && typeof row.aiBrief === "object" && !Array.isArray(row.aiBrief) ? (row.aiBrief as Record<string, unknown>) : null;
        if (!brief || brief[key] !== result.relabel.from) continue;
        await prisma.emailCampaign.update({ where: { id: row.id }, data: { aiBrief: { ...brief, [key]: result.relabel.to } as Prisma.InputJsonObject } });
        relabeled++;
      }
    }

    await saveSettings(result.settings);
    return NextResponse.json({ success: true, settings: result.settings, relabeled });
  } catch (error: any) {
    console.error("template settings update failed", error);
    return NextResponse.json({ error: "Could not save that change." }, { status: 500 });
  }
}

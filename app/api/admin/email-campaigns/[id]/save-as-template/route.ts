import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureCampaignTable } from "@/lib/campaigns-db";

type Ctx = { params: Promise<{ id: string }> };

// "Save as template": copies the email's content into a new TEMPLATE row. Using a template later
// copies it back into a campaign, so edits to a campaign never change the saved template.
// Recipients, test-send history and the send state are deliberately not copied.
export async function POST(request: Request, { params }: Ctx) {
  try {
    await ensureCampaignTable();
    const { id } = await params;
    const source = await prisma.emailCampaign.findUnique({ where: { id } });
    if (!source) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    if (!source.body.trim()) return NextResponse.json({ error: "Write the email first, then save it as a template." }, { status: 400 });

    const b = await request.json().catch(() => ({}));
    const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
    if (!name) return NextResponse.json({ error: "Give the template a name." }, { status: 400 });

    const template = await prisma.emailCampaign.create({
      data: {
        name, status: "TEMPLATE", subject: source.subject, previewText: source.previewText,
        fromName: source.fromName, fromEmail: source.fromEmail, replyTo: source.replyTo,
        designType: source.designType, body: source.body,
      },
      select: { id: true, name: true },
    });
    return NextResponse.json({ success: true, template });
  } catch (error: any) {
    console.error("save template failed", error);
    return NextResponse.json({ error: "Could not save the template." }, { status: 500 });
  }
}

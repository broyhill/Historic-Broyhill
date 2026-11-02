import { prisma } from "@/lib/prisma";

// Public landing-page host: /p/<id> serves a composed page once an admin has
// published it (channel LANDING_PAGE, status APPROVED). Unpublished or pending
// drafts are invisible — no listing, no guessing URLs.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = await prisma.aiContentPipeline.findFirst({
    where: { id, channel: "LANDING_PAGE", status: "APPROVED" },
    select: { suggestedDraft: true },
  });
  if (!draft?.suggestedDraft) {
    return new Response("Page not found.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response(draft.suggestedDraft, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" },
  });
}

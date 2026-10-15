import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const queue = await prisma.aiContentPipeline.findMany({
      where: { status: 'PENDING_REVIEW' },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(queue);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { pipelineId, updatedDraft } = await request.json();
    const updated = await prisma.aiContentPipeline.update({
      where: { id: pipelineId },
      data: {
        status: 'PUBLISHED',
        suggestedDraft: updatedDraft || undefined,
        publishedAt: new Date()
      },
    });
    return NextResponse.json({ status: 'PUBLISHED', id: updated.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

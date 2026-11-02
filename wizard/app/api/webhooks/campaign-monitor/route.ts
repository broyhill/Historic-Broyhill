// CM inbound webhook: consent sync. Auth = per-silo URL secret (?tenantId&token) verified
// against CandidateSilo before any write — CM webhooks don't natively sign, so the secret
// IS the auth. Consent flips write SubscriberActivity provenance + update our system of
// record with the origin event pinned.
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeEmail } from '@/lib/identity';

interface CmWebhookEvent {
  Type: 'Subscribe' | 'Deactivate' | 'Update';
  Date: string;
  EmailAddress: string;
  SignupMethod?: string;
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const token = searchParams.get('token');
    if (!tenantId || !token) {
      return NextResponse.json({ error: 'missing verification context' }, { status: 401 });
    }

    const silo = await prisma.candidateSilo.findUnique({ where: { id: tenantId } });
    if (!silo || silo.cmWebhookSecret !== token) {
      console.warn(`[cm-webhook] rejected bad token for tenant ${tenantId}`);
      return NextResponse.json({ error: 'authentication failed' }, { status: 401 });
    }

    const body = await req.json();
    const events: CmWebhookEvent[] = body?.Events ?? [];
    if (!events.length) return NextResponse.json({ ok: true });

    await prisma.$transaction(async (tx) => {
      for (const event of events) {
        const email = normalizeEmail(event.EmailAddress);
        const occurredAt = new Date(event.Date);
        const type =
          event.Type === 'Deactivate' ? 'UNSUBSCRIBED'
          : event.Type === 'Subscribe' ? 'CAPTURED'
          : 'DELIVERED'; // Update — recorded, not a consent transition

        const activity = await tx.subscriberActivity.create({
          data: {
            candidateId: silo.id,
            email,
            type,
            occurredAt,
            payload: event as object,
          },
        });

        if (event.Type === 'Deactivate' || event.Type === 'Subscribe') {
          const optIn = event.Type === 'Subscribe';
          await tx.subscriber.updateMany({
            where: { candidateId: silo.id, email },
            data: {
              systemOptIn: optIn,
              optInUpdatedAt: occurredAt,
              consentChannel: 'WEBHOOK_SYNC',
              consentSource: `cm-webhook:${event.Type.toLowerCase()}${event.SignupMethod ? `:${event.SignupMethod}` : ''}`,
              originEventId: activity.id,
            },
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[cm-webhook] fatal:', err);
    return NextResponse.json({ error: 'ingestion failure' }, { status: 500 });
  }
}

import { errorResponse, json } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { applyResendEvent } from '@/lib/services/telemetry';
import { verifySvix, type ResendEvent } from '@/lib/webhooks/resend';

// Real-time telemetry gateway: delivered, opened, clicked, bounced, complained. Signature is
// verified over the raw body before anything is parsed or written. Fails closed with no secret.
export async function POST(request: Request) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) return json({ error: 'Webhook not configured' }, 503);
    const raw = await request.text();
    const headers = {
      id: request.headers.get('svix-id'),
      timestamp: request.headers.get('svix-timestamp'),
      signature: request.headers.get('svix-signature'),
    };
    if (!(await verifySvix(headers, raw, secret))) return json({ error: 'Invalid signature' }, 401);
    const event = JSON.parse(raw) as ResendEvent;
    const applied = await applyResendEvent(prisma, headers.id!, event);
    return json({ ok: true, type: event.type, applied });
  } catch (error) {
    return errorResponse(error);
  }
}

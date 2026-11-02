import { safeEqual } from '@/wizard/lib/auth/crypto';
import { errorResponse, json } from '@/wizard/lib/api';
import { composerFromEnv } from '@/wizard/lib/orchestration/forge';
import { prisma } from '@/wizard/lib/prisma';
import { parseCaptureInput, processCapture } from '@/wizard/lib/services/capture';

// Webhook capture gateway (Weapons 1–3). Devices (NFC tap, kiosks) and server integrations send
// x-capture-secret and may set a VIP score; public QR/web-form posts may not. Pattern reused from
// the prior capture webhook (README §Provenance): constant-time secret compare, fail closed.
export async function POST(request: Request) {
  try {
    const secret = process.env.CAPTURE_WEBHOOK_SECRET;
    const provided = request.headers.get('x-capture-secret');
    if (provided !== null && (!secret || !safeEqual(provided, secret))) return json({ error: 'Unauthorized' }, 401);
    const trusted = provided !== null; // reached only when the secret matched
    const input = parseCaptureInput(await request.json(), trusted);
    const result = await processCapture(prisma, input, composerFromEnv());
    return json({ ok: true, ...result }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

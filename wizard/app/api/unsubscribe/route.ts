import { NextResponse } from 'next/server';
import { errorResponse, json } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { applyUnsubscribe } from '@/lib/services/telemetry';

// RFC 8058 one-click endpoint (List-Unsubscribe-Post) and the target of the confirm form on
// /unsubscribe. Silo-scoped, bulk-only suppression. Tokens carry ids, never email addresses.
export async function POST(request: Request) {
  try {
    const secret = process.env.WIZARD_UNSUBSCRIBE_SECRET;
    if (!secret) return json({ error: 'Unsubscribe is not configured' }, 503);
    const url = new URL(request.url);
    let token = url.searchParams.get('token');
    let silo = url.searchParams.get('silo');
    const type = request.headers.get('content-type') ?? '';
    if ((!token || !silo) && type.includes('application/x-www-form-urlencoded')) {
      const form = new URLSearchParams(await request.text());
      token = token ?? form.get('token');
      silo = silo ?? form.get('silo');
    }
    if (!token) return json({ error: 'Missing token' }, 400);
    const result = await applyUnsubscribe(prisma, token, silo, secret);
    if (!result.ok) return json({ error: result.reason }, 400);
    const accept = request.headers.get('accept') ?? '';
    if (accept.includes('text/html')) {
      return new NextResponse(
        `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title><body style="font-family:Georgia,serif;max-width:32rem;margin:4rem auto;padding:0 1rem"><h1>You're unsubscribed</h1><p>You will no longer receive bulk email from ${escapeHtml(result.candidateName)}.</p></body>`,
        { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
      );
    }
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

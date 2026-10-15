import { NextResponse } from 'next/server';
import { safeEqual } from '@/lib/admin-auth';
import { processCapture } from '@/lib/capture';

export async function POST(request: Request) {
  const secret = process.env.CAPTURE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('CAPTURE_WEBHOOK_SECRET is not set; rejecting capture webhook');
    return NextResponse.json({ error: 'Capture webhook is not configured' }, { status: 500 });
  }

  const providedSecret = request.headers.get('x-capture-secret');
  if (!providedSecret || !safeEqual(providedSecret, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  return processCapture(body);
}

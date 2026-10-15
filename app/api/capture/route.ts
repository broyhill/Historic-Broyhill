import { NextResponse } from 'next/server';
import { processCapture } from '@/lib/capture';

// Public form endpoint. Processes the capture in-process rather than calling the webhook over HTTP,
// so CAPTURE_WEBHOOK_SECRET never leaves the server.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  return processCapture(body);
}

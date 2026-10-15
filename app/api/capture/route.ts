import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const secret = process.env.CAPTURE_WEBHOOK_SECRET || 'nexus_secure_capture_token_2026';
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';

    const response = await fetch(`${protocol}://${host}/api/webhooks/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-nexus-webhook-secret': secret,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

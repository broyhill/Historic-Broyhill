// Email transports. The courier only ever calls a transport for a LIVE send, which requires every
// gate in lib/dispatch/gates.ts. The Resend transport is what the build spec asks for; Ed's
// 2026-08-01/10-06 rulings name SendGrid for W01 (Conflict C9), so a SendGrid adapter belongs in
// E30 and this transport stays unbound until Ed rules.

export interface OutboundEmail {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
  idempotencyKey: string;
}

export interface EmailTransport {
  readonly name: string;
  send(message: OutboundEmail): Promise<{ providerMessageId: string }>;
}

export class TransportUnavailableError extends Error {
  constructor(reason: string) {
    super(`No live email transport: ${reason}`);
    this.name = 'TransportUnavailableError';
  }
}

// Resend SDK, loaded lazily so it is never imported on the dry-run path.
export function createResendTransport(apiKey: string): EmailTransport {
  return {
    name: 'resend',
    async send(message) {
      const { Resend } = await import('resend');
      const client = new Resend(apiKey);
      const { data, error } = await client.emails.send(
        {
          from: message.from,
          to: message.to,
          ...(message.replyTo ? { replyTo: message.replyTo } : {}),
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: message.headers,
        },
        { idempotencyKey: message.idempotencyKey },
      );
      // Never report success without a provider receipt (Eight Houses, House 6 rule 3).
      if (error || !data?.id) throw new Error(`Resend rejected the message: ${error?.message ?? 'no message id returned'}`);
      return { providerMessageId: data.id };
    },
  };
}

export function transportFromEnv(env: Record<string, string | undefined> = process.env): EmailTransport | null {
  const key = env.RESEND_API_KEY;
  return key ? createResendTransport(key) : null;
}

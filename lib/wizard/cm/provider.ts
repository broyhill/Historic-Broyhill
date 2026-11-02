// Campaign Monitor agency rail (api.createsend.com v3.3). Thin fetch adapter — no SDK dep.
// Doctrine: CM is a dumb pipe. Consent lives in our system of record (Subscriber.systemOptIn +
// provenance fields); CM state follows it, never the reverse. Resubscribe is driven by our
// consent record, never defaulted true. CM also returns HTTP 200 with success:false bodies —
// every call parses the body, not the status code.

export interface CmClientConfig {
  apiKey: string;
  baseUrl?: string; // default https://api.createsend.com/api/v3.3
  fetchImpl?: typeof fetch; // injectable for tests
}

export interface CmStatsSummary {
  Sent: number;
  Opens: number;
  Clicks: number;
  Bounces: number;
  Unsubscribes: number;
}

export class CampaignMonitorProvider {
  private base: string;
  private auth: string;
  private doFetch: typeof fetch;

  constructor(config: CmClientConfig) {
    this.base = (config.baseUrl ?? 'https://api.createsend.com/api/v3.3').replace(/\/$/, '');
    this.auth = 'Basic ' + Buffer.from(`${config.apiKey}:`).toString('base64');
    this.doFetch = config.fetchImpl ?? fetch;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.doFetch(`${this.base}${path}`, {
      method,
      headers: { Authorization: this.auth, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: any = undefined;
    try { parsed = text ? JSON.parse(text) : undefined; } catch { /* CM sometimes returns bare strings */ }
    // success:false-in-200 trap: a body error beats the status line
    if (parsed && (parsed.success === false || parsed.Code !== undefined || parsed.Message)) {
      throw new Error(`CM ${method} ${path} failed: ${parsed.Message ?? parsed.Code ?? text}`);
    }
    if (!res.ok) throw new Error(`CM ${method} ${path} HTTP ${res.status}: ${text.slice(0, 200)}`);
    return (parsed ?? text) as T;
  }

  // ── Provisioning verbs (agency scope) ──────────────────────────────────────────
  createClient(companyName: string): Promise<string> {
    return this.call('POST', '/clients.json', { CompanyName: companyName });
  }
  createList(clientId: string, title: string): Promise<string> {
    return this.call('POST', `/lists/${clientId}.json`, { Title: title, UnsubscribePage: '', ConfirmedOptIn: false });
  }
  createWebhook(listId: string, url: string, events: string[] = ['Subscribe', 'Deactivate', 'Update']): Promise<string> {
    return this.call('POST', `/lists/${listId}/webhooks.json`, { Events: events, Url: url, PayloadFormat: 'json' });
  }
  deleteWebhook(listId: string, webhookId: string): Promise<void> {
    return this.call('DELETE', `/lists/${listId}/webhooks/${webhookId}.json`);
  }

  // ── Contact sync: Resubscribe comes from OUR consent record, never a default ──
  upsertSubscriber(listId: string, input: { email: string; name?: string; systemOptIn: boolean }): Promise<void> {
    return this.call('PUT', `/subscribers/${listId}.json?email=${encodeURIComponent(input.email)}`, {
      EmailAddress: input.email,
      Name: input.name ?? '',
      Resubscribe: input.systemOptIn,
      RestartSubscriptionBasedAutoresponders: false, // our funnels own re-entry, not CM
    });
  }
  unsubscribe(listId: string, email: string): Promise<void> {
    return this.call('POST', `/subscribers/${listId}/unsubscribe.json`, { EmailAddress: email });
  }

  // ── Stage / fire: two gates, two verbs ─────────────────────────────────────────
  // stage = approve-time draft create. fire = send-time call. Never one call.
  createDraft(clientId: string, input: { subject: string; name: string; fromName: string; fromEmail: string; htmlUrl: string; listIds: string[] }): Promise<string> {
    return this.call('POST', `/campaigns/${clientId}.json`, {
      Subject: input.subject,
      Name: input.name,
      FromName: input.fromName,
      FromEmail: input.fromEmail,
      ReplyTo: input.fromEmail,
      HtmlUrl: input.htmlUrl,
      ListIDs: input.listIds,
      SegmentIDs: [],
    });
  }
  sendCampaign(cmCampaignId: string, confirmationEmail: string): Promise<void> {
    return this.call('POST', `/campaigns/${cmCampaignId}/send.json`, { ConfirmationEmail: confirmationEmail, SendDate: 'Immediately' });
  }
  readStats(cmCampaignId: string): Promise<CmStatsSummary> {
    return this.call('GET', `/campaigns/${cmCampaignId}/summary.json`);
  }

  // ── Transactional (receipt rail — separate surface from bulk) ──────────────────
  sendTransactional(smartEmailId: string, email: string, data: Record<string, unknown>): Promise<void> {
    return this.call('POST', `/transactional/smartEmail/${smartEmailId}/send`, { To: email, Data: data });
  }
}

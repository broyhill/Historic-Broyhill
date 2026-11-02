// AI drafting (Weapon 4) as a hook into the platform's Forge chain
// (E89 position → E47 write → E48 sign → E80 compose → E23 format → E08 stage → cannon).
// This package does not own composition. ForgeComposer is the seam where an E80 adapter binds;
// until then the default composer is deterministic (no model, no paid call). An OpenAI composer
// exists because the build spec names it, and it only runs with WIZARD_PAID_CALLS_AUTHORIZED=true.
//
// Every draft passes the guards ported from commit 6d03eb3 (README §Provenance) (no tag leakage, no
// placeholders, no internal vocabulary, no invented venue facts) plus the E68 attribution guard:
// a first-person claim is flagged for approved-language review, never silently shipped.

export interface ForgeRequest {
  purpose: 'WELCOME' | 'FOLLOW_UP';
  channel: 'EMAIL' | 'SMS';
  silo: { candidateName: string | null; officeSought: string | null; fromName: string };
  recipient: { firstName: string | null; venueInterest: string | null };
}

export interface ForgeDraft {
  subject: string | null;
  body: string;
  provider: string;
  flags: string[];
}

export interface ForgeComposer {
  readonly name: string;
  compose(request: ForgeRequest): Promise<Omit<ForgeDraft, 'flags'>>;
}

const INTERNAL_TERMS = /\b(vip|high net worth|lead score|nfc|tap(?:ped)?|webhook|track(?:s|ing)?|crm|tag(?:s|ged)?|segment(?:s|ed)?|silo)\b/i;
const PLACEHOLDER = /\[[^\]]{1,40}\]/;
const MERGE_LEFTOVER = /\{\{|\}\}/;
const FIRST_PERSON_CLAIM = /\b(I believe|I will|I voted|I support|I oppose|my position|as your [a-z ]+ I)\b/i;
const INVENTED_VENUE_FACT = /\b(capacity|seats?\s+\d+|\d+\s*(?:guests|people|sq\.?\s*ft|square feet))\b/i;

export function guardDraft(text: string): string[] {
  const flags: string[] = [];
  if (MERGE_LEFTOVER.test(text)) flags.push('MERGE_TAG_LEAKAGE');
  if (PLACEHOLDER.test(text)) flags.push('TEMPLATE_PLACEHOLDER');
  if (INTERNAL_TERMS.test(text)) flags.push('INTERNAL_VOCABULARY');
  if (INVENTED_VENUE_FACT.test(text)) flags.push('UNVERIFIED_VENUE_FACT');
  if (FIRST_PERSON_CLAIM.test(text)) flags.push('FIRST_PERSON_CLAIM_REQUIRES_APPROVED_LANGUAGE');
  return flags;
}

export const deterministicComposer: ForgeComposer = {
  name: 'deterministic (E80 adapter not bound)',
  async compose(request) {
    const who = request.silo.candidateName ?? request.silo.fromName;
    const first = request.recipient.firstName?.trim() || 'Friend';
    const venue = request.recipient.venueInterest?.trim();
    if (request.channel === 'SMS') {
      return {
        subject: null,
        body: `Hi ${first}, thanks again for stopping by${venue ? ` ${venue}` : ''}. ${who}'s team would love to stay in touch. Reply STOP to opt out.`,
        provider: this.name,
      };
    }
    return {
      subject: `Thank you, ${first}`,
      body: [
        `Dear ${first},`,
        `Thank you for taking a moment to connect with ${who}${venue ? ` at ${venue}` : ''}.`,
        `Our team will follow up with details soon.`,
        `With appreciation,\n${who}`,
      ].join('\n\n'),
      provider: this.name,
    };
  },
};

export function openAiComposer(apiKey: string, model = 'gpt-4o'): ForgeComposer {
  return {
    name: `openai:${model}`,
    async compose(request) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          temperature: 0.4,
          messages: [
            {
              role: 'system',
              content: [
                `You draft a short ${request.channel === 'SMS' ? 'text message (under 300 characters, ending "Reply STOP to opt out.")' : 'email'} from ${request.silo.candidateName ?? request.silo.fromName}${request.silo.officeSought ? `, candidate for ${request.silo.officeSought}` : ''}.`,
                'Use only facts given here. Never state policy positions or first-person commitments. Never mention internal data, scores, tags, segments, or how contact was captured.',
                'No brackets, no placeholders, no template tags. Return JSON {"subject": string|null, "body": string}.',
              ].join(' '),
            },
            { role: 'user', content: JSON.stringify({ purpose: request.purpose, firstName: request.recipient.firstName, interest: request.recipient.venueInterest }) },
          ],
        }),
      });
      if (!response.ok) throw new Error(`OpenAI returned ${response.status}`);
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as { subject?: string | null; body?: string };
      if (!parsed.body) throw new Error('OpenAI returned no body');
      return { subject: parsed.subject ?? null, body: parsed.body, provider: this.name };
    },
  };
}

export function composerFromEnv(env: Record<string, string | undefined> = process.env): ForgeComposer {
  if (env.WIZARD_FORGE_PROVIDER === 'openai' && env.OPENAI_API_KEY && env.WIZARD_PAID_CALLS_AUTHORIZED === 'true') {
    return openAiComposer(env.OPENAI_API_KEY);
  }
  return deterministicComposer;
}

// Runs the composer and the guards. A composer failure falls back to the deterministic draft;
// guard flags never block staging — they travel with the draft into human review.
export async function forgeDraft(composer: ForgeComposer, request: ForgeRequest): Promise<ForgeDraft> {
  let draft: Omit<ForgeDraft, 'flags'>;
  try {
    draft = await composer.compose(request);
  } catch (error) {
    draft = await deterministicComposer.compose(request);
    draft.provider = `${draft.provider} (fallback after ${composer.name} failed: ${error instanceof Error ? error.message : String(error)})`;
  }
  const flags = guardDraft(`${draft.subject ?? ''}\n${draft.body}`);
  return { ...draft, flags };
}

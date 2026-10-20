// Campaign checklist rules, taken from Campaign Monitor's "Create an email" journey
// (subject-line recommendations, preheader text, link review). Pure functions so the
// admin page and the API apply exactly the same rules.

export const VENUE_ADDRESS = "Historic Broyhill, 3540 Clemmons Road, Suite 111, Clemmons, NC 27012";
export const MAX_SUBJECT_CHARS = 60;
export const MAX_SUBJECT_WORDS = 9;
export const MAX_PREVIEW_CHARS = 150;
export const MAX_TEST_ADDRESSES = 5;

export interface Check { ok: boolean; label: string }

export function subjectChecks(subject: string): Check[] {
  const s = subject.trim();
  const words = s ? s.split(/\s+/).length : 0;
  const marks = (s.match(/[!?]/g) || []).length;
  const emoji = (s.match(/\p{Extended_Pictographic}/gu) || []).length;
  const letters = s.replace(/[^A-Za-z]/g, "");
  const allCaps = letters.length >= 4 && letters === letters.toUpperCase();
  return [
    { ok: s.length > 0, label: "Has a subject" },
    { ok: s.length <= MAX_SUBJECT_CHARS && words <= MAX_SUBJECT_WORDS, label: `${MAX_SUBJECT_WORDS} words / ${MAX_SUBJECT_CHARS} characters or fewer (now ${words} / ${s.length})` },
    { ok: marks <= 3, label: "At most 3 ! or ? marks" },
    { ok: emoji <= 1, label: "At most 1 emoji" },
    { ok: !allCaps, label: "Not all caps" },
  ];
}

export function previewChecks(preview: string): Check[] {
  const p = preview.trim();
  return [{ ok: p.length <= MAX_PREVIEW_CHARS, label: `Preview text ${MAX_PREVIEW_CHARS} characters or fewer (now ${p.length}); inboxes may show as few as 35` }];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (v: string) => EMAIL_RE.test(v.trim());

export function extractLinks(body: string): string[] {
  return Array.from(new Set(body.match(/https?:\/\/[^\s<>"')]+|www\.[^\s<>"')]+/gi) || []));
}

export interface LinkIssue { url: string; problem: string }

// Format-only review (no network calls): flags insecure, malformed and bare "www" links.
export function reviewLinks(body: string): { links: string[]; issues: LinkIssue[] } {
  const links = extractLinks(body);
  const issues: LinkIssue[] = [];
  for (const url of links) {
    if (/^www\./i.test(url)) { issues.push({ url, problem: "Missing https://" }); continue; }
    try {
      const u = new URL(url);
      if (u.protocol !== "https:") issues.push({ url, problem: "Not secure (http)" });
    } catch {
      issues.push({ url, problem: "Malformed link" });
    }
  }
  return { links, issues };
}

// Merge tags. {{firstName}} is filled per recipient; any other {{tag}} is a blank staff must fill in.
export const PERSONAL_TAG = "firstName";
const TAG_RE = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g;

export function unresolvedTags(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(TAG_RE)) if (m[1] !== PERSONAL_TAG) found.add(m[1]);
  return Array.from(found);
}

export function fillFirstName(text: string, firstName: string | null | undefined): string {
  return text.replace(TAG_RE, (whole, tag) => (tag === PERSONAL_TAG ? (firstName?.trim() || "there") : whole));
}

export interface CampaignLike {
  subject: string;
  previewText: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string | null;
  recipientCount: number;
  body: string;
}

export interface Completeness {
  subject: boolean;
  sender: boolean;
  recipients: boolean;
  design: boolean;
  review: boolean;
}

// Each checklist section is independent and has its own "complete" state.
export function completeness(c: CampaignLike): Completeness {
  const subject = subjectChecks(c.subject).every((k) => k.ok) && previewChecks(c.previewText).every((k) => k.ok);
  const sender = c.fromName.trim().length > 0 && isEmail(c.fromEmail) && (!c.replyTo || isEmail(c.replyTo));
  const recipients = c.recipientCount > 0;
  const design = c.body.trim().length > 0;
  const review = design
    && reviewLinks(c.body).issues.length === 0
    && unresolvedTags(`${c.subject}\n${c.previewText}\n${c.body}`).length === 0;
  return { subject, sender, recipients, design, review };
}

export const isReady = (c: Completeness) => Object.values(c).every(Boolean);

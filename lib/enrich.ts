import { z } from "zod";
import { claudeEnabled, claudeJson } from "@/lib/ai";

// Company enrichment from an email domain.
// Uses Claude when ANTHROPIC_API_KEY is set (else OpenAI when OPENAI_API_KEY is set) (fills company name, company LinkedIn,
// HQ city/state with a confidence flag), and falls back to a plain
// domain-derived company name otherwise. It never invents a street address,
// and it leaves fields blank rather than guessing when confidence is low.

export interface Enrichment {
  company: string | null;
  companyLinkedin: string | null;
  city: string | null;
  state: string | null;
  confidence: "high" | "medium" | "low";
}

// Consumer / free mailbox providers — these can't be tied to a company.
export const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com", "outlook.com",
  "live.com", "msn.com", "aol.com", "icloud.com", "me.com", "mac.com", "comcast.net",
  "att.net", "bellsouth.net", "verizon.net", "sbcglobal.net", "charter.net", "cox.net",
  "earthlink.net", "mindspring.net", "roadrunner.com", "windstream.net", "frontier.com",
  "protonmail.com", "proton.me", "mail.com", "rocketmail.com", "juno.com", "triad.rr.com",
]);

export function domainOf(email: string): string {
  return (email.split("@")[1] || "").trim().toLowerCase();
}

export function isFreeDomain(domain: string): boolean {
  return FREE_EMAIL_DOMAINS.has(domain);
}

// Rough company name from a domain when we have no better source:
// "foothillsbrewing.com" -> "Foothillsbrewing". Used only as a fallback.
export function companyFromDomain(domain: string): string {
  const core = domain.replace(/\.(com|org|net|edu|gov|us|co|io|biz|info)(\.[a-z]{2})?$/i, "").split(".").pop() || domain;
  return core.charAt(0).toUpperCase() + core.slice(1);
}

const SYSTEM = `You identify US companies and institutions from their email domain. For each domain, return what you reliably know — do NOT guess a street address, and do NOT invent data. If you are not confident a domain maps to a specific real organization, return low confidence with nulls.

Return STRICT JSON: {"results":[{"domain":"...","company":"<official name or null>","companyLinkedin":"<https://www.linkedin.com/company/... or null>","city":"<HQ city or null>","state":"<2-letter state or null>","confidence":"high|medium|low"}]}

Rules:
- company: the organization's real, properly formatted name (e.g. "wellsfargo.com" -> "Wells Fargo", "wakehealth.edu" -> "Atrium Health Wake Forest Baptist"). Null if unknown.
- companyLinkedin: only a LinkedIn company URL you are confident is correct; otherwise null.
- city/state: the organization's headquarters, only if you know it; otherwise null. Never fabricate.
- confidence: high only for well-known organizations you are certain about.`;

// Enrich a batch of domains in one model call. Returns a map keyed by domain.
export async function enrichDomains(domains: string[]): Promise<Map<string, Enrichment>> {
  const out = new Map<string, Enrichment>();
  const unique = Array.from(new Set(domains.map((d) => d.toLowerCase()))).filter((d) => d && !isFreeDomain(d));
  if (unique.length === 0) return out;

  const key = process.env.OPENAI_API_KEY;
  const haveOpenAI = key && !key.includes("your-openai-api-key");
  const useClaude = claudeEnabled();

  if (useClaude) {
    try {
      const parsed = await claudeJson({
        system: SYSTEM,
        user: `Domains:\n${unique.join("\n")}`,
        schema: z.object({
          results: z.array(z.object({
            domain: z.string(),
            company: z.string().nullable(),
            companyLinkedin: z.string().nullable(),
            city: z.string().nullable(),
            state: z.string().nullable(),
            confidence: z.string(),
          })),
        }),
        maxTokens: 4000,
      });
      for (const r of parsed?.results ?? []) {
        const d = String(r.domain || "").toLowerCase();
        if (!d) continue;
        out.set(d, {
          company: r.company || null,
          companyLinkedin: r.companyLinkedin || null,
          city: r.city || null,
          state: r.state ? String(r.state).toUpperCase().slice(0, 2) : null,
          confidence: ["high", "medium", "low"].includes(r.confidence) ? (r.confidence as Enrichment["confidence"]) : "low",
        });
      }
    } catch (e) {
      console.warn("enrichDomains Claude call failed:", (e as Error).message);
    }
  } else if (haveOpenAI) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          temperature: 0.1,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: `Domains:\n${unique.join("\n")}` },
          ],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
        for (const r of parsed.results ?? []) {
          const d = String(r.domain || "").toLowerCase();
          if (!d) continue;
          out.set(d, {
            company: r.company || null,
            companyLinkedin: r.companyLinkedin || null,
            city: r.city || null,
            state: r.state ? String(r.state).toUpperCase().slice(0, 2) : null,
            confidence: ["high", "medium", "low"].includes(r.confidence) ? r.confidence : "low",
          });
        }
      }
    } catch (e) {
      console.warn("enrichDomains AI call failed:", (e as Error).message);
    }
  }

  // Fallback for anything the model didn't return (or when AI is unavailable):
  // a plain domain-derived company name, low confidence, no location.
  for (const d of unique) {
    if (!out.has(d)) {
      out.set(d, { company: companyFromDomain(d), companyLinkedin: null, city: null, state: null, confidence: "low" });
    }
  }
  return out;
}

// Pull a human name out of an email local part when it clearly encodes one:
// "jane.caldwell@acme.com" -> "Jane Caldwell". Returns null for role addresses
// (info@, sales@) or anything that doesn't look like a person's name.
const ROLE_LOCALS = new Set(["info", "contact", "sales", "admin", "office", "events", "hello", "team", "support", "mail", "marketing", "help", "service", "no-reply", "noreply"]);
export function nameFromEmail(email: string): string | null {
  const local = (email.split("@")[0] || "").toLowerCase();
  if (!local || ROLE_LOCALS.has(local)) return null;
  const parts = local.split(/[._-]+/).filter((p) => /^[a-z]{2,}$/.test(p));
  if (parts.length < 2) return null; // need at least first + last
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

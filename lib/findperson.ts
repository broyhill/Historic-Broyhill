import { claudeEnabled, claudeWebSearch } from "@/lib/ai";

// Person lookup from a work email, using Claude's web search (OpenAI's as a fallback).
// For each email it searches the live web to identify the individual and
// returns their name, title, and personal LinkedIn with a source + confidence.
// It is instructed never to guess — low confidence + nulls when unsure.

export interface PersonResult {
  name: string | null;
  title: string | null;
  linkedin: string | null;
  confidence: "high" | "medium" | "low";
  source: string | null;
  error?: string;
}

const SYSTEM = `You identify the specific person behind a work email address by searching the web. You are given an email and sometimes the company name.

Return ONLY a JSON object: {"name":"<full name or null>","title":"<current job title or null>","linkedin":"<the person's personal LinkedIn profile URL (linkedin.com/in/...) or null>","confidence":"high|medium|low","source":"<the URL that supports this or null>"}

Rules:
- Match the PERSON who uses this exact email, using the domain/local-part and corroborating pages (company staff pages, LinkedIn, news).
- confidence "high" only when a specific, named individual clearly matches (e.g. a staff page or LinkedIn tied to this domain/name). "medium" for a probable match. "low" when you cannot identify a specific person — then return nulls for name/linkedin.
- linkedin must be an individual profile (/in/), never a company page. Null if not confidently found.
- Never invent a name, title, or URL. If unsure, low confidence with nulls.`;

function parseJson(text: string): any {
  const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return {};
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return {}; }
}

// Pull the assistant text and the first supporting URL out of a Responses API
// result (output[].content[] of type output_text, with url_citation annotations).
function extractFromResponses(data: any): { text: string; citation: string | null } {
  let text = "";
  let citation: string | null = null;
  for (const item of data.output ?? []) {
    if (item.type === "message" && Array.isArray(item.content)) {
      for (const c of item.content) {
        if ((c.type === "output_text" || typeof c.text === "string") && typeof c.text === "string") {
          text += c.text;
          for (const a of c.annotations ?? []) {
            const url = a?.url_citation?.url || (a?.type === "url_citation" ? a?.url : null) || a?.url;
            if (!citation && typeof url === "string" && url.startsWith("http")) citation = url;
          }
        }
      }
    }
  }
  if (!text && typeof data.output_text === "string") text = data.output_text;
  return { text, citation };
}

function toResult(parsed: any, citation: string | null): PersonResult {
  const conf = ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low";
  const linkedin = typeof parsed.linkedin === "string" && /linkedin\.com\/in\//i.test(parsed.linkedin) ? parsed.linkedin : null;
  return {
    name: parsed.name || null,
    title: parsed.title || null,
    linkedin,
    confidence: conf,
    source: (typeof parsed.source === "string" && parsed.source.startsWith("http") ? parsed.source : null) || citation,
  };
}

export async function findPerson(email: string, companyHint: string | null): Promise<PersonResult> {
  // Claude with its server-side web search tool (preferred when ANTHROPIC_API_KEY is set)
  if (claudeEnabled()) {
    try {
      const { text, citation } = await claudeWebSearch({
        system: SYSTEM,
        user: `Email: ${email}${companyHint ? `\nCompany: ${companyHint}` : ""}\nIdentify this person. Respond ONLY with the JSON object.`,
      });
      return toResult(parseJson(text || "{}"), citation);
    } catch (e) {
      return { name: null, title: null, linkedin: null, confidence: "low", source: null, error: (e as Error).message };
    }
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key || key.includes("your-openai-api-key")) {
    return { name: null, title: null, linkedin: null, confidence: "low", source: null, error: "no_openai_key" };
  }
  // Overridable in case the account needs a different search-capable model.
  const model = process.env.OPENAI_SEARCH_MODEL || "gpt-4o-mini";

  try {
    // Responses API with the web_search tool (the search-preview chat models
    // were shut down mid-2026).
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        tools: [{ type: "web_search" }],
        instructions: SYSTEM,
        input: `Email: ${email}${companyHint ? `\nCompany: ${companyHint}` : ""}\nIdentify this person. Respond ONLY with the JSON object.`,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { name: null, title: null, linkedin: null, confidence: "low", source: null, error: `api_${res.status}: ${body.slice(0, 200)}` };
    }

    const data = await res.json();
    const { text, citation } = extractFromResponses(data);
    const parsed = parseJson(text || "{}");
    const conf = ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low";
    const linkedin = typeof parsed.linkedin === "string" && /linkedin\.com\/in\//i.test(parsed.linkedin) ? parsed.linkedin : null;

    return {
      name: parsed.name || null,
      title: parsed.title || null,
      linkedin,
      confidence: conf,
      source: (typeof parsed.source === "string" && parsed.source.startsWith("http") ? parsed.source : null) || citation,
    };
  } catch (e) {
    return { name: null, title: null, linkedin: null, confidence: "low", source: null, error: (e as Error).message };
  }
}

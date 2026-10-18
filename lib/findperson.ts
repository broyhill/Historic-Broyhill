// Person lookup from a work email, using OpenAI's web-search models.
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

// Pull the first supporting URL out of the model's web-search annotations.
function firstCitation(message: any): string | null {
  const ann = message?.annotations;
  if (Array.isArray(ann)) {
    for (const a of ann) {
      const url = a?.url_citation?.url || a?.url;
      if (typeof url === "string" && url.startsWith("http")) return url;
    }
  }
  return null;
}

function parseJson(text: string): any {
  const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return {};
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return {}; }
}

export async function findPerson(email: string, companyHint: string | null): Promise<PersonResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.includes("your-openai-api-key")) {
    return { name: null, title: null, linkedin: null, confidence: "low", source: null, error: "no_openai_key" };
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Search-preview models run a live web search as part of the completion.
        model: "gpt-4o-mini-search-preview",
        web_search_options: {},
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Email: ${email}${companyHint ? `\nCompany: ${companyHint}` : ""}\nIdentify this person.` },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { name: null, title: null, linkedin: null, confidence: "low", source: null, error: `api_${res.status}: ${body.slice(0, 160)}` };
    }

    const data = await res.json();
    const message = data.choices?.[0]?.message;
    const parsed = parseJson(message?.content || "{}");
    const conf = ["high", "medium", "low"].includes(parsed.confidence) ? parsed.confidence : "low";
    const linkedin = typeof parsed.linkedin === "string" && /linkedin\.com\/in\//i.test(parsed.linkedin) ? parsed.linkedin : null;

    return {
      name: parsed.name || null,
      title: parsed.title || null,
      linkedin,
      confidence: conf,
      source: (typeof parsed.source === "string" && parsed.source.startsWith("http") ? parsed.source : null) || firstCitation(message),
    };
  } catch (e) {
    return { name: null, title: null, linkedin: null, confidence: "low", source: null, error: (e as Error).message };
  }
}

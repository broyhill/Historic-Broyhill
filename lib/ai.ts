import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// Two providers, same call sites:
//   Anthropic (Claude) when ANTHROPIC_API_KEY is set — preferred.
//   Groq (free tier, OpenAI-compatible) when GROQ_API_KEY is set — used when
//   Claude is not configured or a Claude call fails (e.g. the account is out of credits).
export const anthropicEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);
export const groqEnabled = () => Boolean(process.env.GROQ_API_KEY);
// Kept for existing callers: "some model is available".
export const claudeEnabled = () => anthropicEnabled() || groqEnabled();
export const NOT_CONFIGURED = "No AI provider is configured (set ANTHROPIC_API_KEY or GROQ_API_KEY).";

// Overridable without a deploy: ANTHROPIC_MODEL=claude-haiku-5-5 (cheaper) or claude-opus-5-5 (strongest)
export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
// Groq's strongest free model with tool calling. Override with GROQ_MODEL.
export const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
// Overridable so a local mock can stand in for Groq in tests.
const GROQ_URL = process.env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions";

let client: Anthropic | null = null;
export function getClient() {
  if (!client) client = new Anthropic({ timeout: 60_000, maxRetries: 2 });
  return client;
}

// Turns a provider error into one plain sentence staff can act on.
export function aiErrorMessage(error: unknown): string {
  const e = error as any;
  const raw = String(e?.error?.error?.message ?? e?.error?.message ?? e?.message ?? "");
  const status = Number(e?.status ?? e?.statusCode ?? 0);
  if (/credit balance|purchase credits|insufficient_quota|billing/i.test(raw)) return "The AI account is out of credits. Add credits at the provider (Anthropic Plans & Billing or Groq) and try again.";
  if (status === 401 || /invalid x-api-key|invalid api key|authentication/i.test(raw)) return "The AI key was rejected. Check ANTHROPIC_API_KEY / GROQ_API_KEY in Vercel.";
  if (status === 429 || /rate limit/i.test(raw)) return "The AI provider is rate-limiting us. Wait a minute and try again.";
  if (status === 404 || /model.*not found|does not exist/i.test(raw)) return "The configured AI model name is not available. Check ANTHROPIC_MODEL / GROQ_MODEL.";
  return raw ? `The AI request failed: ${raw.slice(0, 200)}` : "Something went wrong reaching the AI. Try again in a moment.";
}

// ---------- Groq (OpenAI-compatible chat completions) ----------

export type GroqMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: GroqToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface GroqToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface GroqTool {
  type: "function";
  function: { name: string; description?: string; parameters: Record<string, unknown> };
}

export async function groqChat(body: {
  messages: GroqMessage[];
  tools?: GroqTool[];
  max_tokens?: number;
  response_format?: { type: "json_object" };
  temperature?: number;
}): Promise<{ content: string; tool_calls: GroqToolCall[]; finish_reason: string }> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: GROQ_MODEL, temperature: 0.3, ...body }),
    signal: AbortSignal.timeout(60_000),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data?.error?.message || `Groq request failed (${res.status})`);
    err.status = res.status;
    err.provider = "groq";
    throw err;
  }
  const msg = data?.choices?.[0]?.message ?? {};
  return {
    content: typeof msg.content === "string" ? msg.content : "",
    tool_calls: Array.isArray(msg.tool_calls) ? msg.tool_calls : [],
    finish_reason: String(data?.choices?.[0]?.finish_reason ?? ""),
  };
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Model did not return JSON");
    return JSON.parse(m[0]);
  }
}

async function groqJson<T extends z.ZodTypeAny>(opts: { system: string; user: string; schema: T; maxTokens?: number }): Promise<z.infer<T> | null> {
  const schemaText = JSON.stringify(z.toJSONSchema(opts.schema));
  const system = `${opts.system}\n\nRespond with a single JSON object and nothing else. It must match this JSON Schema exactly:\n${schemaText}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const out = await groqChat({
      messages: [{ role: "system", content: system }, { role: "user", content: opts.user }],
      max_tokens: opts.maxTokens ?? 2000,
      response_format: { type: "json_object" },
    });
    const parsed = opts.schema.safeParse(extractJson(out.content));
    if (parsed.success) return parsed.data;
    console.warn("groq json did not match schema", parsed.error.issues.slice(0, 3));
  }
  return null;
}

// ---------- Public helpers used by routes and libs ----------

// One request that must come back as JSON matching `schema`. Returns null on refusal or parse failure.
// Uses Claude when configured; falls back to Groq when Claude is unavailable or the call fails.
export async function claudeJson<T extends z.ZodTypeAny>(opts: {
  system: string;
  user: string;
  schema: T;
  maxTokens?: number;
}): Promise<z.infer<T> | null> {
  if (anthropicEnabled()) {
    try {
      const response = await getClient().messages.parse({
        model: CLAUDE_MODEL,
        max_tokens: opts.maxTokens ?? 2000,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
        output_config: { effort: "low", format: zodOutputFormat(opts.schema) },
      });
      if (response.stop_reason === "refusal") return null;
      return (response.parsed_output as z.infer<T> | null) ?? null;
    } catch (e) {
      if (!groqEnabled()) throw e;
      console.warn("Claude failed, falling back to Groq:", aiErrorMessage(e));
    }
  }
  if (groqEnabled()) return groqJson(opts);
  throw new Error(NOT_CONFIGURED);
}

// Web-search request. Anthropic only (uses its server-side web_search tool).
// Returns the model's final text and the first cited URL.
// The server runs the search loop; if it pauses (pause_turn) we resume up to a few times.
export async function claudeWebSearch(opts: {
  system: string;
  user: string;
  maxUses?: number;
}): Promise<{ text: string; citation: string | null }> {
  if (!anthropicEnabled()) throw new Error("Web search needs ANTHROPIC_API_KEY.");
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.user }];
  let text = "";
  let citation: string | null = null;

  for (let turn = 0; turn < 4; turn++) {
    const response = await getClient().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: opts.system,
      messages,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: opts.maxUses ?? 3 }],
      output_config: { effort: "low" },
    });

    text = "";
    for (const block of response.content) {
      if (block.type !== "text") continue;
      text += block.text;
      for (const c of block.citations ?? []) {
        if (!citation && c.type === "web_search_result_location" && c.url.startsWith("http")) citation = c.url;
      }
    }
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
  }
  return { text, citation };
}

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// Three providers, same call sites:
//   Anthropic (Claude) when ANTHROPIC_API_KEY is set — preferred.
//   Groq (free tier, OpenAI-compatible) when GROQ_API_KEY is set.
//   Gemini (free tier, OpenAI-compatible) when GEMINI_API_KEY is set.
//   The free providers are used when Claude is not configured or a Claude call
//   fails (e.g. the account is out of credits).
export const anthropicEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);
export const groqEnabled = () => Boolean(process.env.GROQ_API_KEY);
export const geminiEnabled = () => Boolean(process.env.GEMINI_API_KEY);
// First configured free fallback, in preference order.
export type FreeProvider = "groq" | "gemini";
export const freeProvider = (): FreeProvider | null => (groqEnabled() ? "groq" : geminiEnabled() ? "gemini" : null);
export const freeEnabled = () => freeProvider() !== null;
// Kept for existing callers: "some model is available".
export const claudeEnabled = () => anthropicEnabled() || freeEnabled();
export const NOT_CONFIGURED = "No AI provider is configured (set ANTHROPIC_API_KEY, GROQ_API_KEY or GEMINI_API_KEY).";

// Overridable without a deploy: ANTHROPIC_MODEL=claude-haiku-5-5 (cheaper) or claude-opus-5-5 (strongest)
export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
// Groq's strongest free model with tool calling. Override with GROQ_MODEL.
export const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
// Overridable so a local mock can stand in for Groq in tests.
const GROQ_URL = process.env.GROQ_API_URL || "https://api.groq.com/openai/v1/chat/completions";
// Free-tier Gemini via its OpenAI-compatible endpoint. Override with GEMINI_MODEL.
// Verified against the key's model list 2026-11: the -latest alias tracks the
// current lite model; plain versioned names (gemini-2.5-flash) 404 for this key.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const GEMINI_URL = process.env.GEMINI_API_URL || "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

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
  if (status === 401 || /invalid x-api-key|invalid api key|authentication|api key not valid/i.test(raw)) return "The AI key was rejected. Check ANTHROPIC_API_KEY / GROQ_API_KEY / GEMINI_API_KEY in Vercel.";
  if (status === 429 || /rate limit/i.test(raw)) return "The AI provider is rate-limiting us. Wait a minute and try again.";
  if (status === 404 || /model.*not found|does not exist/i.test(raw)) return "The configured AI model name is not available. Check ANTHROPIC_MODEL / GROQ_MODEL / GEMINI_MODEL.";
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

type CompatConfig = { url: string; key: string | undefined; model: string };
const compatConfig = (provider: FreeProvider): CompatConfig =>
  provider === "gemini"
    ? { url: GEMINI_URL, key: process.env.GEMINI_API_KEY, model: GEMINI_MODEL }
    : { url: GROQ_URL, key: process.env.GROQ_API_KEY, model: GROQ_MODEL };

async function compatChat(provider: FreeProvider, body: {
  messages: GroqMessage[];
  tools?: GroqTool[];
  max_tokens?: number;
  response_format?: { type: "json_object" };
  temperature?: number;
}): Promise<{ content: string; tool_calls: GroqToolCall[]; finish_reason: string }> {
  const cfg = compatConfig(provider);
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: cfg.model, temperature: 0.3, ...body }),
    signal: AbortSignal.timeout(60_000),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data?.error?.message || `${provider} request failed (${res.status})`);
    err.status = res.status;
    err.provider = provider;
    throw err;
  }
  const msg = data?.choices?.[0]?.message ?? {};
  return {
    content: typeof msg.content === "string" ? msg.content : "",
    tool_calls: Array.isArray(msg.tool_calls) ? msg.tool_calls : [],
    finish_reason: String(data?.choices?.[0]?.finish_reason ?? ""),
  };
}

// Configured free providers in preference order.
export const freeProviders = (): FreeProvider[] =>
  ["groq", "gemini"].filter((p) => (p === "groq" ? groqEnabled() : geminiEnabled())) as FreeProvider[];

// OpenAI-compatible chat against whichever free provider is configured.
// `provider` pins one; omitted, providers are tried in order until one answers.
export async function groqChat(body: {
  messages: GroqMessage[];
  tools?: GroqTool[];
  max_tokens?: number;
  response_format?: { type: "json_object" };
  temperature?: number;
}, provider?: FreeProvider): Promise<{ content: string; tool_calls: GroqToolCall[]; finish_reason: string }> {
  if (provider) return compatChat(provider, body);
  const providers = freeProviders();
  let lastErr: unknown = new Error(NOT_CONFIGURED);
  for (const p of providers) {
    try {
      return await compatChat(p, body);
    } catch (e) {
      lastErr = e;
      console.warn(`${p} chat failed, trying next provider:`, aiErrorMessage(e));
    }
  }
  throw lastErr;
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

async function freeJson<T extends z.ZodTypeAny>(opts: { system: string; user: string; schema: T; maxTokens?: number }): Promise<z.infer<T> | null> {
  const schemaText = JSON.stringify(z.toJSONSchema(opts.schema));
  const system = `${opts.system}\n\nRespond with a single JSON object and nothing else. It must match this JSON Schema exactly:\n${schemaText}`;
  let lastErr: unknown = null;
  for (const provider of freeProviders()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let out;
      try {
        out = await compatChat(provider, {
          messages: [{ role: "system", content: system }, { role: "user", content: opts.user }],
          max_tokens: opts.maxTokens ?? 2000,
          response_format: { type: "json_object" },
        });
      } catch (e) {
        lastErr = e;
        console.warn(`${provider} json call failed:`, aiErrorMessage(e));
        break; // move to the next free provider
      }
      try {
        const parsed = opts.schema.safeParse(extractJson(out.content));
        if (parsed.success) return parsed.data;
        console.warn(`${provider} json did not match schema`, parsed.error.issues.slice(0, 3));
      } catch {
        console.warn(`${provider} returned unparseable output`);
      }
    }
  }
  // Surface the real provider failure (bad key, quota, rate limit) to callers;
  // null is reserved for valid responses that failed schema validation.
  if (lastErr) throw lastErr;
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
      if (!freeEnabled()) throw e;
      console.warn("Claude failed, falling back to a free provider:", aiErrorMessage(e));
    }
  }
  if (freeEnabled()) return freeJson(opts);
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

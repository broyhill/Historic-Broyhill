import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

// Claude is used whenever ANTHROPIC_API_KEY is set; otherwise callers fall back to their OpenAI path.
export const claudeEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

// Overridable without a deploy: ANTHROPIC_MODEL=claude-haiku-5-5 (cheaper) or claude-opus-5-5 (strongest)
export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

let client: Anthropic | null = null;
export function getClient() {
  if (!client) client = new Anthropic({ timeout: 60_000, maxRetries: 2 });
  return client;
}

// One request that must come back as JSON matching `schema`. Returns null on refusal or parse failure.
export async function claudeJson<T extends z.ZodTypeAny>(opts: {
  system: string;
  user: string;
  schema: T;
  maxTokens?: number;
}): Promise<z.infer<T> | null> {
  const response = await getClient().messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: opts.maxTokens ?? 2000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    output_config: { effort: "low", format: zodOutputFormat(opts.schema) },
  });
  if (response.stop_reason === "refusal") return null;
  return (response.parsed_output as z.infer<T> | null) ?? null;
}

// Web-search request. Returns the model's final text and the first cited URL.
// The server runs the search loop; if it pauses (pause_turn) we resume up to a few times.
export async function claudeWebSearch(opts: {
  system: string;
  user: string;
  maxUses?: number;
}): Promise<{ text: string; citation: string | null }> {
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

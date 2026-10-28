import { Agent } from "@cursor/sdk";
import type { z } from "zod";

// Devin/Codex is used whenever CURSOR_API_KEY is set.
export const devinEnabled = () => Boolean(process.env.CURSOR_API_KEY);

// Model selection - uses the Cursor agent runtime (model is configured in Cursor settings)
export const DEVIN_MODEL = process.env.CURSOR_MODEL || "composer-2.5";

// Check if local runtime is enabled (default true for on-prem)
export const DEVIN_LOCAL = process.env.CURSOR_LOCAL !== "false";

// One request that must come back as text. Returns null on failure.
export async function devinText(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string | null> {
  try {
    const result = await Agent.prompt(
      `${opts.system}\n\n${opts.user}`,
      {
        apiKey: process.env.CURSOR_API_KEY!,
        model: { id: DEVIN_MODEL },
        local: DEVIN_LOCAL ? { cwd: process.cwd() } : undefined,
      }
    );

    if (result.status === "error") {
      console.error("Devin returned error:", result.error);
      return null;
    }

    return result.result || null;
  } catch (error) {
    console.error("Devin request failed:", error);
    return null;
  }
}

// One request that must come back as JSON matching a schema. Returns null on failure.
// Note: Cursor SDK doesn't have built-in schema validation like Anthropic's zodOutputFormat,
// so we ask the model to return JSON and parse it with Zod.
export async function devinJson<T extends z.ZodTypeAny>(opts: {
  system: string;
  user: string;
  schema: T;
  maxTokens?: number;
}): Promise<z.infer<T> | null> {
  try {
    const prompt = `${opts.system}\n\n${opts.user}\n\nIMPORTANT: Return your response as valid JSON only, no other text.`;

    const result = await Agent.prompt(prompt, {
      apiKey: process.env.CURSOR_API_KEY!,
      model: { id: DEVIN_MODEL },
      local: DEVIN_LOCAL ? { cwd: process.cwd() } : undefined,
    });

    if (result.status === "error") {
      console.error("Devin returned error:", result.error);
      return null;
    }

    if (!result.result) return null;

    // Parse the JSON response
    const jsonMatch = result.result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Devin did not return valid JSON");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return opts.schema.parse(parsed);
  } catch (error) {
    console.error("Devin JSON request failed:", error);
    return null;
  }
}

// Create a durable agent for multi-turn conversations (like the assistant panel)
export async function createDevinAgent() {
  if (!devinEnabled()) {
    throw new Error("Devin is not configured (CURSOR_API_KEY is not set).");
  }

  return await Agent.create({
    apiKey: process.env.CURSOR_API_KEY!,
    model: { id: DEVIN_MODEL },
    local: DEVIN_LOCAL ? { cwd: process.cwd() } : undefined,
  });
}

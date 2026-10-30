import { brandFacts } from "@/lib/brand";
import { loadBrand } from "@/lib/brand-settings";

// Plain-word facts about the business for the AI system prompts, from the confirmed brand kit only.
// Never throws: with no kit (or no database) the prompts simply carry the built-in venue facts.
export async function brandContext(): Promise<string> {
  try {
    const b = await loadBrand();
    if (!b.confirmedAt) return "";
    const facts = brandFacts(b);
    return facts ? `Confirmed business details (use these for name, address, phone, email, website and social links): ${facts}` : "";
  } catch { return ""; }
}

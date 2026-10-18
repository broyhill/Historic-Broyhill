// Normalize whatever was typed into a LinkedIn field into a usable profile URL.
// Shared by the console's review queue and the lead directory.
export function linkedinHref(v: string): string {
  const t = v.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (/^(www\.)?linkedin\.com/i.test(t)) return `https://${t}`;
  const handle = t.replace(/^@/, "").replace(/^\/?in\//i, "");
  return `https://www.linkedin.com/in/${handle}`;
}

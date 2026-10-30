// Designed starters for the Templates gallery and the Studio: every email starter from
// campaign-templates.ts laid out as a finished Historic Broyhill email (photo, headline, copy,
// button, locked footer) so staff pick a look first and change the words second.
// Pure data + pure functions; the HTML always comes from renderHtml().
import { CAMPAIGN_TEMPLATES, type CampaignTemplate } from "./campaign-templates";
import { newId, type Block, type Brand, type Design } from "./studio";

// Photos ship with the public site, so the email can reference them by absolute URL.
export const PHOTO_BASE = "https://historic-broyhill.vercel.app/photos";
export const BOOKING_URL = "https://broyhill.skedda.com"; // owner-published booking site

const PHOTO_BY_CATEGORY: Record<string, { file: string; alt: string }> = {
  "Weddings": { file: "magnolia-ceremony.jpg", alt: "A wedding ceremony in the Magnolia Room" },
  "Previous clients": { file: "magnolia-reception.jpg", alt: "A reception in the Magnolia Room" },
  "New inquiry": { file: "exterior-day.jpg", alt: "Historic Broyhill, the 1920s schoolhouse in Clemmons" },
  "Newsletter": { file: "exterior-dusk.jpg", alt: "Historic Broyhill at dusk" },
  "Chamber": { file: "the-loft.jpg", alt: "The Loft set for a meeting" },
  "Civic": { file: "the-dock-wide.jpg", alt: "The Dock, the covered outdoor stage" },
  "Charities": { file: "magnolia.jpg", alt: "The Magnolia Room" },
  "Corporate": { file: "office-lobby.jpg", alt: "The office lobby" },
  "Office suites": { file: "office-suite.jpg", alt: "A Class A office suite" },
  "Seasonal holidays": { file: "heritage-hall.jpg", alt: "The heritage hall" },
  "Clemmons-Advance": { file: "the-dock-patio.jpg", alt: "The Dock patio" },
  "Winston-Salem": { file: "exterior.jpg", alt: "Historic Broyhill from Clemmons Road" },
  "Novant Health": { file: "office-lounge.jpg", alt: "The office lounge" },
  "Atrium Wake Forest": { file: "the-loft.jpg", alt: "The Loft" },
  "General": { file: "exterior.jpg", alt: "Historic Broyhill" },
};

// Three looks, rotated across the gallery so it reads as a set, not twelve copies of one card.
export const LOOKS: { name: string; brand: Brand }[] = [
  { name: "Navy & gold", brand: { accent: "#a8853f", background: "#f3f0e8", font: "serif" } },
  { name: "Ivory", brand: { accent: "#182c3e", background: "#faf7f1", font: "serif" } },
  { name: "Modern", brand: { accent: "#182c3e", background: "#eef1f4", font: "sans" } },
];

const BUTTON_BY_KIND: Record<string, string> = {
  "Invitation": "Book a visit",
  "Follow-up": "Pick a time to visit",
  "Thank you": "Plan your next event",
  "Re-engage": "Take another look",
  "Reminder": "See the details",
  "Update": "Visit Historic Broyhill",
};

export interface StarterDesign {
  id: string; name: string; category: string; kind: string; description: string;
  subject: string; previewText: string; look: string; design: Design;
}

const stripHtml = (s: string) => s.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<\/(p|div|h\d|li|tr|br)>/gi, "\n\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ");

// The plain-text body becomes blocks: greeting + paragraphs as text, the booking line becomes the
// button, the sign-off stays as the last text block.
export function designFromTemplate(t: CampaignTemplate, brand: Brand): Design {
  const raw = /<[a-z][\s\S]*>/i.test(t.body) ? stripHtml(t.body) : t.body;
  const paras = raw.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    .filter((p) => !/\{\{bookingLink\}\}/.test(p) || p.split(/\s+/).length > 12)
    .map((p) => p.replace(/\s*\{\{bookingLink\}\}\s*/g, " ").replace(/:\s*$/, ".").trim());
  const photo = PHOTO_BY_CATEGORY[t.category] ?? PHOTO_BY_CATEGORY.General;
  const blocks: Block[] = [
    { id: newId(), type: "image", url: `${PHOTO_BASE}/${photo.file}`, alt: photo.alt, link: BOOKING_URL },
    { id: newId(), type: "heading", text: t.subject, align: "left" },
    ...paras.map((p): Block => ({ id: newId(), type: "text", text: p, align: "left" })),
  ];
  // Button goes before the sign-off so the ask sits with the message.
  const signOffAt = blocks.findIndex((b) => b.type === "text" && /^warm regards/i.test(b.text));
  const button: Block = { id: newId(), type: "button", label: BUTTON_BY_KIND[t.kind] ?? "Book a visit", link: BOOKING_URL, align: "left" };
  const divider: Block = { id: newId(), type: "divider" };
  if (signOffAt > 0) blocks.splice(signOffAt, 0, button, divider);
  else blocks.push(button);
  return { blocks, brand };
}

let cache: StarterDesign[] | null = null;
export function starterDesigns(): StarterDesign[] {
  if (!cache) {
    cache = CAMPAIGN_TEMPLATES.map((t, i) => {
      const look = LOOKS[i % LOOKS.length];
      return { id: t.id, name: t.name, category: t.category, kind: t.kind, description: t.description, subject: t.subject, previewText: t.previewText, look: look.name, design: designFromTemplate(t, look.brand) };
    });
  }
  return cache;
}
export const starterById = (id: string) => starterDesigns().find((s) => s.id === id) ?? null;

// Examples library: finished pieces for every channel we deploy (email, social post, SMS, MMS, photo,
// video), filed under the same audience categories as the templates. Staff pick one and open it in the
// matching tool. Only the verified venue facts from campaign-templates.ts are used: a 1920s school
// building in Clemmons, NC, converted to offices and event space around 2006; the Magnolia Room (stage
// hall), The Boardrooms, The Dock (covered outdoor stage, seating lot, live music, food trucks), The Loft
// (meetings, trainings), Class A office suites, a virtual office program and a podcast studio. No
// capacities, sizes, prices, dates or availability. {{blanks}} are for staff to fill in.
import { TEXT_TEMPLATES } from "./campaign-templates";
import type { Platform } from "./social";
import { BOOKING_URL, PHOTO_BASE, starterDesigns } from "./studio-starters";
import { newSceneId, type Storyboard } from "./video";

export type ExampleChannel = "email" | "social" | "sms" | "mms" | "photo" | "video";
export const CHANNELS: { key: ExampleChannel; label: string; tool: string }[] = [
  { key: "email", label: "Email", tool: "Email studio" },
  { key: "social", label: "Social post", tool: "Social posts" },
  { key: "sms", label: "SMS", tool: "Templates" },
  { key: "mms", label: "MMS", tool: "Templates" },
  { key: "photo", label: "Photo", tool: "Photo library" },
  { key: "video", label: "Video", tool: "Video" },
];

export interface SocialExample { platform: Platform; caption: string; hashtags: string[]; photo: string; imageAlt: string }
export interface TextExample { body: string; mediaUrl?: string }
export interface PhotoExample { url: string; space: string; alt: string }
export interface VideoExample { storyboard: Storyboard; script: string[] }

export type Example =
  | { id: string; channel: "email"; category: string; kind: string; title: string; description: string; starterId: string }
  | { id: string; channel: "social"; category: string; kind: string; title: string; description: string; social: SocialExample }
  | { id: string; channel: "sms" | "mms"; category: string; kind: string; title: string; description: string; text: TextExample }
  | { id: string; channel: "photo"; category: string; kind: string; title: string; description: string; photo: PhotoExample }
  | { id: string; channel: "video"; category: string; kind: string; title: string; description: string; video: VideoExample };

const photo = (file: string) => `${PHOTO_BASE}/${file}`;
const STOP = "Reply STOP to opt out.";

// --- Photos: what ships with the public site, by space ---------------------------------------------
export const PHOTOS: PhotoExample[] = [
  { url: photo("exterior-day.jpg"), space: "The building", alt: "Historic Broyhill from the lawn, daytime" },
  { url: photo("exterior-dusk.jpg"), space: "The building", alt: "Historic Broyhill at dusk" },
  { url: photo("exterior.jpg"), space: "The building", alt: "Historic Broyhill from Clemmons Road" },
  { url: photo("magnolia.jpg"), space: "Magnolia Room", alt: "The Magnolia Room, the stage hall" },
  { url: photo("magnolia-ceremony.jpg"), space: "Magnolia Room", alt: "A ceremony set in the Magnolia Room" },
  { url: photo("magnolia-reception.jpg"), space: "Magnolia Room", alt: "A reception set in the Magnolia Room" },
  { url: photo("the-dock.jpg"), space: "The Dock", alt: "The Dock, the covered outdoor stage" },
  { url: photo("the-dock-2.jpg"), space: "The Dock", alt: "The Dock stage" },
  { url: photo("the-dock-wide.jpg"), space: "The Dock", alt: "The Dock and its seating lot" },
  { url: photo("the-dock-patio.jpg"), space: "The Dock", alt: "The Dock patio" },
  { url: photo("the-loft.jpg"), space: "The Loft", alt: "The Loft, set for a meeting" },
  { url: photo("office-lobby.jpg"), space: "Offices", alt: "The office lobby" },
  { url: photo("office-lounge.jpg"), space: "Offices", alt: "The office lounge" },
  { url: photo("office-suite.jpg"), space: "Offices", alt: "A Class A office suite" },
  { url: photo("office-desk.jpg"), space: "Offices", alt: "A desk in an office suite" },
  { url: photo("podcast-studio.jpg"), space: "Podcast studio", alt: "The HB Podcast Studio" },
  { url: photo("heritage-hall.jpg"), space: "Heritage", alt: "The school hall, then" },
  { url: photo("heritage-music.jpg"), space: "Heritage", alt: "Music at the school, then" },
  { url: photo("heritage-then.jpg"), space: "Heritage", alt: "The schoolhouse, then" },
];
const SPACE_CATEGORY: Record<string, string> = { "The building": "General", "Magnolia Room": "Weddings", "The Dock": "Civic", "The Loft": "Corporate", "Offices": "Office suites", "Podcast studio": "General", "Heritage": "Newsletter" };

// --- Social posts ------------------------------------------------------------------------------------
const SOCIAL: (Omit<Extract<Example, { channel: "social" }>, "channel" | "id"> & { id: string })[] = [
  { id: "soc-wedding-magnolia", category: "Weddings", kind: "Invitation", title: "Say it in the Magnolia Room", description: "Instagram, ceremony photo.",
    social: { platform: "instagram", photo: photo("magnolia-ceremony.jpg"), imageAlt: "A ceremony set in the Magnolia Room", hashtags: ["ClemmonsNC", "NCWedding", "HistoricVenue", "WinstonSalemWeddings"],
      caption: "A 1920s schoolhouse, a stage hall with real history, and your people in the seats. The Magnolia Room is where the ceremony happens. Tour it in person — link in bio." } },
  { id: "soc-wedding-reception", category: "Weddings", kind: "Invitation", title: "Reception in the Magnolia Room", description: "Facebook, reception photo.",
    social: { platform: "facebook", photo: photo("magnolia-reception.jpg"), imageAlt: "A reception set in the Magnolia Room", hashtags: ["HistoricBroyhill", "ClemmonsNC"],
      caption: `Dinner, toasts and a dance floor under the lights of the Magnolia Room. Historic Broyhill has hosted gatherings in Clemmons since the building became an event space in 2006. Book a visit: ${BOOKING_URL}` } },
  { id: "soc-corporate-loft", category: "Corporate", kind: "Invitation", title: "Offsite in The Loft", description: "LinkedIn, Loft photo.",
    social: { platform: "linkedin", photo: photo("the-loft.jpg"), imageAlt: "The Loft, set for a meeting", hashtags: ["Offsite", "ClemmonsNC", "WinstonSalem"],
      caption: `Your next planning day doesn't have to be in the same conference room. The Loft at Historic Broyhill is built for meetings and trainings, minutes from Winston-Salem, inside a 1920s schoolhouse. Tell us what you're planning: ${BOOKING_URL}` } },
  { id: "soc-corporate-boardrooms", category: "Corporate", kind: "Update", title: "The Boardrooms, by the day", description: "LinkedIn, lobby photo.",
    social: { platform: "linkedin", photo: photo("office-lobby.jpg"), imageAlt: "The office lobby", hashtags: ["Meetings", "ClemmonsNC"],
      caption: "Board meeting, client pitch, interview day. The Boardrooms at Historic Broyhill are available by the day or half day, with the lobby and lounge right outside the door. Ask us for a date." } },
  { id: "soc-chamber", category: "Chamber", kind: "Invitation", title: "Chamber after-hours at The Dock", description: "Facebook, Dock photo.",
    social: { platform: "facebook", photo: photo("the-dock-wide.jpg"), imageAlt: "The Dock and its seating lot", hashtags: ["ChamberEvent", "ClemmonsNC", "LocalBusiness"],
      caption: "Chamber members: The Dock is a covered outdoor stage with its own seating lot — room for live music, food trucks and a crowd of neighbors. Historic Broyhill would love to host your next after-hours. {{eventDate}}: save the date." } },
  { id: "soc-civic", category: "Civic", kind: "Invitation", title: "A stage for the community", description: "Facebook, Dock stage photo.",
    social: { platform: "facebook", photo: photo("the-dock.jpg"), imageAlt: "The Dock, the covered outdoor stage", hashtags: ["Clemmons", "CommunityEvent", "LiveMusic"],
      caption: "Concerts, markets, town gatherings. The Dock at Historic Broyhill is a covered outdoor stage made for the whole neighborhood, food trucks included. Planning something for Clemmons? Message us." } },
  { id: "soc-charity", category: "Charities", kind: "Invitation", title: "Fundraiser in a landmark", description: "Instagram, Magnolia Room photo.",
    social: { platform: "instagram", photo: photo("magnolia.jpg"), imageAlt: "The Magnolia Room, the stage hall", hashtags: ["Fundraiser", "Nonprofit", "ClemmonsNC", "GiveLocal"],
      caption: "Galas, auctions and donor dinners feel different in a 1920s schoolhouse. The Magnolia Room gives your cause a stage. Ask us about hosting your next fundraiser — link in bio." } },
  { id: "soc-offices", category: "Office suites", kind: "Update", title: "Class A offices in Clemmons", description: "LinkedIn, suite photo.",
    social: { platform: "linkedin", photo: photo("office-suite.jpg"), imageAlt: "A Class A office suite", hashtags: ["OfficeSpace", "ClemmonsNC", "SmallBusiness"],
      caption: "Class A office suites inside Historic Broyhill, a 1920s school building in Clemmons, with event space downstairs and a podcast studio down the hall. A Virtual Office Program is available too. Email Kristin@Broyhill.net to see a suite." } },
  { id: "soc-podcast", category: "General", kind: "Update", title: "The HB Podcast Studio", description: "X, studio photo.",
    social: { platform: "x", photo: photo("podcast-studio.jpg"), imageAlt: "The HB Podcast Studio", hashtags: ["Podcast", "ClemmonsNC"],
      caption: "Record where the acoustics were built for a school. The HB Podcast Studio at Historic Broyhill is open to book. DM us for a session." } },
  { id: "soc-holiday", category: "Seasonal holidays", kind: "Invitation", title: "Celebrate the season", description: "Facebook, dusk photo.",
    social: { platform: "facebook", photo: photo("exterior-dusk.jpg"), imageAlt: "Historic Broyhill at dusk", hashtags: ["HolidayParty", "ClemmonsNC", "HistoricBroyhill"],
      caption: `Company party, family gathering, {{holidayEvent}} — the Magnolia Room and The Loft are taking holiday dates. Come see the building lit up at dusk: ${BOOKING_URL}` } },
  { id: "soc-heritage", category: "Newsletter", kind: "Update", title: "Then and now", description: "Instagram, heritage photo.",
    social: { platform: "instagram", photo: photo("heritage-then.jpg"), imageAlt: "The schoolhouse, then", hashtags: ["ThrowbackThursday", "ClemmonsHistory", "HistoricBroyhill"],
      caption: "Then: a 1920s school for Clemmons. Now: offices, events and music under the same roof since 2006. Same bricks, new stories. #tbt" } },
  { id: "soc-tour", category: "New inquiry", kind: "Invitation", title: "Come see it in person", description: "Facebook, exterior photo.",
    social: { platform: "facebook", photo: photo("exterior-day.jpg"), imageAlt: "Historic Broyhill from the lawn, daytime", hashtags: ["ClemmonsNC", "EventVenue"],
      caption: `Pictures only go so far. Walk the Magnolia Room, The Boardrooms, The Dock and The Loft with us and tell us what you're planning. Book a visit: ${BOOKING_URL}` } },
];

// --- Texts: the starters plus a few finished ones per audience ---------------------------------------
const EXTRA_TEXTS: { id: string; channel: "sms" | "mms"; category: string; kind: string; title: string; description: string; text: TextExample }[] = [
  { id: "sms-wedding-tour", channel: "sms", category: "Weddings", kind: "Invitation", title: "Wedding tour", description: "After a wedding inquiry.",
    text: { body: `Hi {{firstName}}, it's Historic Broyhill. Congratulations! Want to walk the Magnolia Room together? Pick a time: ${BOOKING_URL} ${STOP}` } },
  { id: "sms-corporate-hold", channel: "sms", category: "Corporate", kind: "Follow-up", title: "Meeting space follow-up", description: "After a corporate inquiry.",
    text: { body: `Hi {{firstName}}, Historic Broyhill here. The Loft and The Boardrooms are good fits for {{eventName}}. Want to see them? ${BOOKING_URL} ${STOP}` } },
  { id: "sms-offices", channel: "sms", category: "Office suites", kind: "Invitation", title: "Office suite showing", description: "After an office inquiry.",
    text: { body: `Hi {{firstName}}, it's Kristin at Historic Broyhill. A Class A suite is available to view. Reply with a day that works, or email Kristin@Broyhill.net. ${STOP}` } },
  { id: "sms-holiday", channel: "sms", category: "Seasonal holidays", kind: "Invitation", title: "Holiday dates", description: "Seasonal nudge to past clients.",
    text: { body: `Hi {{firstName}}, Historic Broyhill is taking holiday party dates for the Magnolia Room and The Loft. Want yours? ${BOOKING_URL} ${STOP}` } },
  { id: "mms-magnolia", channel: "mms", category: "Weddings", kind: "Invitation", title: "Magnolia Room picture", description: "Ceremony photo with an invitation to tour.",
    text: { body: `Hi {{firstName}}, this is the Magnolia Room at Historic Broyhill. Come see it in person: ${BOOKING_URL} ${STOP}`, mediaUrl: photo("magnolia-ceremony.jpg") } },
  { id: "mms-dock", channel: "mms", category: "Civic", kind: "Invitation", title: "The Dock picture", description: "Outdoor stage photo for community groups.",
    text: { body: `Hi {{firstName}}, here's The Dock at Historic Broyhill — covered stage, seating lot, room for food trucks. Let's talk about {{eventName}}: ${BOOKING_URL} ${STOP}`, mediaUrl: photo("the-dock-wide.jpg") } },
  { id: "mms-loft", channel: "mms", category: "Corporate", kind: "Invitation", title: "The Loft picture", description: "Meeting room photo for teams.",
    text: { body: `Hi {{firstName}}, The Loft at Historic Broyhill, set for a meeting. Want it for {{eventName}}? ${BOOKING_URL} ${STOP}`, mediaUrl: photo("the-loft.jpg") } },
];

// --- Videos: storyboards from the real photos, ready to open in the Video tool -------------------------
const scene = (file: string, alt: string, caption: string, seconds = 4, motion: "push" | "pull" | "none" = "push") =>
  ({ id: newSceneId(), kind: "photo" as const, url: photo(file), alt, seconds, caption, captionPos: "lower" as const, motion });
const endcard = () => ({ id: newSceneId(), kind: "endcard" as const, url: photo("logo-cream.png"), alt: "Historic Broyhill", seconds: 3, caption: "Historic Broyhill · Clemmons, NC", captionPos: "center" as const, motion: "none" as const });
const board = (scenes: Storyboard["scenes"]): Storyboard => ({ scenes, music: null, width: 1280, height: 720, fps: 30 });

const VIDEOS: { id: string; category: string; kind: string; title: string; description: string; video: VideoExample }[] = [
  { id: "vid-tour", category: "New inquiry", kind: "Invitation", title: "The tour in 23 seconds", description: "Five spaces, one building.",
    video: { script: ["Open on the schoolhouse from the lawn.", "Magnolia Room, the stage hall.", "The Dock, covered outdoor stage.", "The Loft for meetings.", "Class A suites upstairs.", "End card with the address."],
      storyboard: board([
        scene("exterior-day.jpg", "Historic Broyhill from the lawn", "A 1920s schoolhouse in Clemmons"),
        scene("magnolia.jpg", "The Magnolia Room", "The Magnolia Room — the stage hall"),
        scene("the-dock-wide.jpg", "The Dock", "The Dock — covered outdoor stage"),
        scene("the-loft.jpg", "The Loft", "The Loft — meetings and trainings"),
        scene("office-suite.jpg", "An office suite", "Class A office suites", 4, "pull"),
        endcard(),
      ]) } },
  { id: "vid-wedding", category: "Weddings", kind: "Invitation", title: "Your wedding, in the Magnolia Room", description: "Ceremony to reception.",
    video: { script: ["Arrive at dusk.", "Ceremony in the Magnolia Room.", "Reception under the lights.", "The Dock for the after-party.", "End card."],
      storyboard: board([
        scene("exterior-dusk.jpg", "Historic Broyhill at dusk", "Historic Broyhill, Clemmons", 4, "pull"),
        scene("magnolia-ceremony.jpg", "A ceremony in the Magnolia Room", "Say it in the Magnolia Room", 5),
        scene("magnolia-reception.jpg", "A reception in the Magnolia Room", "Dinner, toasts, dancing", 5),
        scene("the-dock-patio.jpg", "The Dock patio", "Step outside to The Dock", 4),
        endcard(),
      ]) } },
  { id: "vid-offices", category: "Office suites", kind: "Update", title: "Work from a landmark", description: "Suites, lobby, lounge, podcast studio.",
    video: { script: ["The building.", "Lobby.", "A suite.", "The lounge.", "Podcast studio.", "End card with Kristin's email."],
      storyboard: board([
        scene("exterior.jpg", "Historic Broyhill from Clemmons Road", "Class A offices in Clemmons"),
        scene("office-lobby.jpg", "The office lobby", "A lobby that greets your clients"),
        scene("office-suite.jpg", "An office suite", "Suites ready to move in", 4, "pull"),
        scene("office-lounge.jpg", "The office lounge", "Room to think"),
        scene("podcast-studio.jpg", "The HB Podcast Studio", "The HB Podcast Studio down the hall"),
        { ...endcard(), caption: "Kristin@Broyhill.net · 336-793-1191" },
      ]) } },
  { id: "vid-dock", category: "Civic", kind: "Invitation", title: "The Dock: music, food trucks, neighbors", description: "Outdoor stage for the community.",
    video: { script: ["Wide on The Dock.", "The stage.", "The patio.", "The building behind it.", "End card."],
      storyboard: board([
        scene("the-dock-wide.jpg", "The Dock and its seating lot", "The Dock — a covered outdoor stage", 5, "pull"),
        scene("the-dock-2.jpg", "The Dock stage", "Live music"),
        scene("the-dock-patio.jpg", "The Dock patio", "Food trucks and friends"),
        scene("exterior-day.jpg", "Historic Broyhill", "All at Historic Broyhill, Clemmons"),
        endcard(),
      ]) } },
];

let cache: Example[] | null = null;
export function examples(): Example[] {
  if (cache) return cache;
  const out: Example[] = [];
  for (const s of starterDesigns()) out.push({ id: `ex-${s.id}`, channel: "email", category: s.category, kind: s.kind, title: s.name, description: `${s.description} ${s.look} look.`, starterId: s.id });
  for (const s of SOCIAL) out.push({ ...s, id: `ex-${s.id}`, channel: "social" });
  for (const t of TEXT_TEMPLATES) out.push({ id: `ex-${t.id}`, channel: t.channel, category: t.category, kind: t.kind, title: t.name, description: t.description, text: { body: t.body, mediaUrl: t.mediaUrl && !t.mediaUrl.includes("{{") ? t.mediaUrl : (t.channel === "mms" ? photo("exterior-day.jpg") : undefined) } });
  for (const t of EXTRA_TEXTS) out.push({ ...t, id: `ex-${t.id}` });
  for (const p of PHOTOS) out.push({ id: `ex-photo-${p.url.split("/").pop()!.replace(/\.\w+$/, "")}`, channel: "photo", category: SPACE_CATEGORY[p.space] ?? "General", kind: p.space, title: p.alt, description: p.space, photo: p });
  for (const v of VIDEOS) out.push({ ...v, id: `ex-${v.id}`, channel: "video" });
  cache = out;
  return out;
}

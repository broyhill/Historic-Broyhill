// Starter templates for the Campaigns and Templates pages (email, SMS and MMS).
//
// Two labels on every template:
//  - category: who it is for (audience / segment)
//  - kind: what it does (invitation, follow-up, ...)
//
// Merge tags:
//  - {{firstName}} is filled per recipient (falls back to "there"). The only tag that may stay in the text.
//  - Any other {{tag}} is a blank for staff to fill in (event, date, link...). Review & test blocks the
//    campaign until none remain.
//
// Venue facts used here are the only verified ones: a 1920s school building in Clemmons, NC,
// converted to offices and event space around 2006; the Magnolia Room (stage hall), The Boardrooms,
// The Dock (covered outdoor stage, seating lot, live music, food trucks), The Loft (meetings, trainings),
// Class A office suites, a virtual office program and a podcast studio. No capacities, sizes, prices,
// dates or availability are stated.

// Audience and segment categories. "General" catches anything that fits none of the others.
export const CATEGORIES = [
  "Newsletter",
  "New inquiry",
  "Previous clients",
  "Weddings",
  "Chamber",
  "Civic",
  "Charities",
  "Corporate",
  "Office suites",
  "Seasonal holidays",
  "Clemmons-Advance",
  "Winston-Salem",
  "Novant Health",
  "Atrium Wake Forest",
  "General",
] as const;
export type Category = (typeof CATEGORIES)[number];
export const isCategory = (v: unknown): v is Category => typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);

export const KINDS = ["Invitation", "Follow-up", "Thank you", "Re-engage", "Reminder", "Update"] as const;
export type Kind = (typeof KINDS)[number];
export const isKind = (v: unknown): v is Kind => typeof v === "string" && (KINDS as readonly string[]).includes(v);

export interface CampaignTemplate {
  id: string;
  name: string;
  category: Category;
  kind: Kind;
  description: string;
  subject: string;
  previewText: string;
  body: string;
}

const SIGN_OFF = "Warm regards,\nThe Historic Broyhill team";

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "tour-invite",
    name: "Tour invitation",
    category: "New inquiry",
    kind: "Invitation",
    description: "Invite someone to see the building in person.",
    subject: "Come see Historic Broyhill",
    previewText: "A 1920s schoolhouse in Clemmons, made for gatherings.",
    body: `Hi {{firstName}},

Historic Broyhill is a 1920s school building in Clemmons that we converted into offices and event space. Pictures only go so far, so we'd love to show you around.

Our spaces include the Magnolia Room, The Boardrooms, The Dock and The Loft. If you tell us what you're planning, we'll point you to the ones worth seeing.

Book a visit here: {{bookingLink}}

${SIGN_OFF}`,
  },
  {
    id: "inquiry-follow-up",
    name: "Inquiry follow-up",
    category: "New inquiry",
    kind: "Follow-up",
    description: "Reply to someone who asked about the venue.",
    subject: "Thanks for asking about Historic Broyhill",
    previewText: "We'd like to help with your plans.",
    body: `Hi {{firstName}},

Thank you for reaching out to Historic Broyhill. We received your inquiry about {{inquiryTopic}} and one of our team will follow up with the specifics.

In the meantime, the best way to get a feel for the place is to visit. Let us know a time that suits you and we'll arrange it.

${SIGN_OFF}`,
  },
  {
    id: "event-thank-you",
    name: "Thank you after an event",
    category: "Previous clients",
    kind: "Thank you",
    description: "Thank guests after an event at the venue.",
    subject: "Thank you for joining us",
    previewText: "It was good to have you at Historic Broyhill.",
    body: `Hi {{firstName}},

Thank you for being part of {{eventName}} at Historic Broyhill. It meant a lot to have you with us.

If you're thinking about hosting something of your own, we'd be glad to talk it through. Just reply to this email.

${SIGN_OFF}`,
  },
  {
    id: "reengage",
    name: "Checking back in",
    category: "New inquiry",
    kind: "Re-engage",
    description: "A light touch for someone who has gone quiet.",
    subject: "Still thinking about your event?",
    previewText: "We're here when you're ready.",
    body: `Hi {{firstName}},

It's been a little while since we last spoke about {{inquiryTopic}}. If your plans are still in motion, we'd be happy to pick the conversation back up.

If the timing isn't right, no problem at all. Reply with a quick note and we'll check in later instead.

${SIGN_OFF}`,
  },
  {
    id: "newsletter-monthly",
    name: "Monthly newsletter",
    category: "Newsletter",
    kind: "Update",
    description: "A short update on news, events and a tour invitation.",
    subject: "What's happening at Historic Broyhill",
    previewText: "News, upcoming events and a look inside.",
    body: `Hi {{firstName}},

Here's what's happening at Historic Broyhill this {{month}}.

{{headline}}

Coming up: {{upcomingEvents}}

If you'd like to see the spaces in person, we'd be glad to show you around. Book a visit here: {{bookingLink}}

${SIGN_OFF}`,
  },
  {
    id: "previous-clients-welcome-back",
    name: "Welcome back",
    category: "Previous clients",
    kind: "Re-engage",
    description: "Thank a past client and invite them to plan something new.",
    subject: "Welcome back to Historic Broyhill",
    previewText: "We'd love to host you again.",
    body: `Hi {{firstName}},

Thank you for choosing Historic Broyhill for {{pastEvent}}. It was a pleasure to host you.

If you're planning something new, we'd be glad to help again. Just reply to this email, or book a visit here: {{bookingLink}}

${SIGN_OFF}`,
  },
  {
    id: "weddings-invite",
    name: "Your wedding at Historic Broyhill",
    category: "Weddings",
    kind: "Invitation",
    description: "Invite a couple to tour for a ceremony or reception.",
    subject: "Your wedding at Historic Broyhill",
    previewText: "Ceremonies, receptions and rehearsal dinners.",
    body: `Hi {{firstName}},

Thank you for thinking of Historic Broyhill for your wedding. Our stage hall is made for ceremonies, receptions and rehearsal dinners, and The Dock offers outdoor space nearby.

We'd love to show you around and talk through your day. Book a visit here: {{bookingLink}}

${SIGN_OFF}`,
  },
  {
    id: "chamber-invite",
    name: "Host your next chamber event",
    category: "Chamber",
    kind: "Invitation",
    description: "Invite a chamber of commerce to hold luncheons or meetings.",
    subject: "Host your next chamber event",
    previewText: "Luncheons, mixers and member meetings.",
    body: `Hi {{firstName}},

We welcome chamber of commerce gatherings at Historic Broyhill, whether it's a luncheon, a mixer or a member meeting. Our stage hall comfortably holds larger groups, and smaller rooms are available for committees.

Tell us what you have in mind, or book a visit here: {{bookingLink}}

${SIGN_OFF}`,
  },
  {
    id: "civic-invite",
    name: "A home for community gatherings",
    category: "Civic",
    kind: "Invitation",
    description: "Invite civic groups to hold community events.",
    subject: "A home for community gatherings",
    previewText: "Meetings, live music and neighborhood events.",
    body: `Hi {{firstName}},

From meetings to live music, Historic Broyhill is a place for the community to gather. Our hall has a stage, and The Dock offers a covered outdoor stage with room for seating and food trucks.

If you're planning a civic or community event, tell us about it, or book a visit here: {{bookingLink}}

${SIGN_OFF}`,
  },
  {
    id: "charities-invite",
    name: "Host your next fundraiser",
    category: "Charities",
    kind: "Invitation",
    description: "Invite a charity to hold a fundraiser or gala.",
    subject: "Host your next fundraiser",
    previewText: "A landmark setting for your cause.",
    body: `Hi {{firstName}},

Historic Broyhill is a landmark 1920s school building in Clemmons, a memorable setting for a dinner, gala or community fundraiser for {{organization}}. Our event planners can walk you through the spaces and options.

To see the building in person, book a visit here: {{bookingLink}}

${SIGN_OFF}`,
  },
  {
    id: "corporate-invite",
    name: "Meetings and events at Historic Broyhill",
    category: "Corporate",
    kind: "Invitation",
    description: "Invite a company to hold meetings, trainings or celebrations.",
    subject: "Meetings and events at Historic Broyhill",
    previewText: "Boardrooms, a stage hall and The Loft.",
    body: `Hi {{firstName}},

For team meetings, trainings, presentations or company celebrations, Historic Broyhill offers The Boardrooms and The Loft for smaller groups, and a stage hall for larger ones.

Tell us what you're planning, or book a visit here: {{bookingLink}}

${SIGN_OFF}`,
  },
  {
    id: "office-suites-invite",
    name: "Class A offices in Clemmons",
    category: "Office suites",
    kind: "Invitation",
    description: "Introduce the executive office suites and virtual office.",
    subject: "Class A offices in Clemmons",
    previewText: "Move-in-ready suites in a landmark building.",
    body: `Hi {{firstName}},

Historic Broyhill offers Class A executive office suites in a landmark building in Clemmons, along with a virtual office program and meeting rooms for tenants. Sizes and availability are on request.

To take a look, reply to this email or book a visit here: {{bookingLink}}

${SIGN_OFF}`,
  },
  {
    id: "seasonal-holidays-invite",
    name: "Celebrate the season",
    category: "Seasonal holidays",
    kind: "Invitation",
    description: "Invite groups to hold a holiday party or seasonal gathering.",
    subject: "Celebrate the season with us",
    previewText: "Holiday parties and seasonal gatherings.",
    body: `Hi {{firstName}},

The holidays are a wonderful time to gather, and Historic Broyhill is a warm place to do it. Whether you're planning {{holidayEvent}} for your team, your family or your community, we'd be glad to help.

Tell us what you have in mind, or book a visit here: {{bookingLink}}

${SIGN_OFF}`,
  },
  {
    id: "clemmons-advance-invite",
    name: "Your neighbors in Clemmons and Advance",
    category: "Clemmons-Advance",
    kind: "Invitation",
    description: "Invite the local community to celebrate close to home.",
    subject: "Celebrate close to home in Clemmons",
    previewText: "Showers, birthdays, graduations and more.",
    body: `Hi {{firstName}},

Historic Broyhill is right here in Clemmons, and we love hosting our neighbors in Clemmons and Advance. Showers, birthdays, graduations, anniversaries and community gatherings all feel at home in our spaces.

Tell us what you're celebrating, or book a visit here: {{bookingLink}}

${SIGN_OFF}`,
  },
  {
    id: "winston-salem-invite",
    name: "A landmark minutes from downtown",
    category: "Winston-Salem",
    kind: "Invitation",
    description: "Invite Winston-Salem groups to host events in Clemmons.",
    subject: "A landmark minutes from downtown",
    previewText: "Event space just outside Winston-Salem.",
    body: `Hi {{firstName}},

Historic Broyhill is a landmark 1920s school building in Clemmons, minutes from downtown Winston-Salem. It's a memorable setting for meetings, celebrations and community events, with onsite event planners to help with the details.

To see it for yourself, book a visit here: {{bookingLink}}

${SIGN_OFF}`,
  },
  {
    id: "novant-health-invite",
    name: "Space for your team's events",
    category: "Novant Health",
    kind: "Invitation",
    description: "Invite a healthcare team to hold meetings, trainings or celebrations.",
    subject: "Space for your team's next event",
    previewText: "Meetings, trainings and celebrations in Clemmons.",
    body: `Hi {{firstName}},

For department meetings, trainings, retreats or team celebrations, Historic Broyhill offers The Boardrooms and The Loft for smaller groups, and a stage hall for larger ones. We're right here in Clemmons.

Tell us about your event, or book a visit here: {{bookingLink}}

${SIGN_OFF}`,
  },
  {
    id: "atrium-wake-forest-invite",
    name: "Space for your team's events",
    category: "Atrium Wake Forest",
    kind: "Invitation",
    description: "Invite a healthcare team to hold meetings, trainings or celebrations.",
    subject: "Space for your team's next event",
    previewText: "Meetings, trainings and celebrations in Clemmons.",
    body: `Hi {{firstName}},

For department meetings, trainings, retreats or team celebrations, Historic Broyhill offers The Boardrooms and The Loft for smaller groups, and a stage hall for larger ones. We're right here in Clemmons.

Tell us about your event, or book a visit here: {{bookingLink}}

${SIGN_OFF}`,
  },
];

export const getTemplate = (id: string) => CAMPAIGN_TEMPLATES.find((t) => t.id === id);

// Text-message starters. Every marketing text names the venue and says how to opt out.
// Same merge-tag rules as email. MMS templates also carry a picture link, which starts as a blank.
export interface TextTemplate {
  id: string;
  channel: "sms" | "mms";
  name: string;
  category: Category;
  kind: Kind;
  description: string;
  body: string;
  mediaUrl?: string;
}

export const TEXT_TEMPLATES: TextTemplate[] = [
  {
    id: "sms-tour-invite", channel: "sms", name: "Tour invitation", category: "New inquiry", kind: "Invitation",
    description: "Invite someone to visit.",
    body: "Hi {{firstName}}, it's Historic Broyhill in Clemmons. Want to see the building in person? Book a visit: {{bookingLink}} Reply STOP to opt out.",
  },
  {
    id: "sms-inquiry-follow-up", channel: "sms", name: "Inquiry follow-up", category: "New inquiry", kind: "Follow-up",
    description: "Acknowledge an inquiry.",
    body: "Hi {{firstName}}, thanks for asking Historic Broyhill about {{inquiryTopic}}. Our team will follow up with details. Reply STOP to opt out.",
  },
  {
    id: "sms-event-reminder", channel: "sms", name: "Event reminder", category: "General", kind: "Reminder",
    description: "Remind guests of an event.",
    body: "Reminder from Historic Broyhill: {{eventName}} is {{eventDate}}. We look forward to seeing you! Reply STOP to opt out.",
  },
  {
    id: "sms-thank-you", channel: "sms", name: "Thank you after an event", category: "Previous clients", kind: "Thank you",
    description: "Thank guests after they visit.",
    body: "Thanks for joining us at Historic Broyhill, {{firstName}}! Thinking of hosting your own event? Just reply here. Reply STOP to opt out.",
  },
  {
    id: "sms-previous-clients", channel: "sms", name: "Welcome back", category: "Previous clients", kind: "Re-engage",
    description: "Invite a past client to plan something new.",
    body: "Hi {{firstName}}, it's Historic Broyhill. Planning another event? We'd love to host you again. Reply here or visit {{bookingLink}} Reply STOP to opt out.",
  },
  {
    id: "mms-venue-photo", channel: "mms", name: "Venue photo invitation", category: "General", kind: "Invitation",
    description: "A picture plus an invitation to visit.",
    body: "Hi {{firstName}}, here's a look at Historic Broyhill in Clemmons. Come see it in person: {{bookingLink}} Reply STOP to opt out.",
    mediaUrl: "{{photoUrl}}",
  },
  {
    id: "mms-event-flyer", channel: "mms", name: "Event flyer", category: "General", kind: "Invitation",
    description: "Send a flyer image for an event.",
    body: "{{eventName}} at Historic Broyhill, {{eventDate}}. Details are on the flyer. Reply STOP to opt out.",
    mediaUrl: "{{flyerUrl}}",
  },
];

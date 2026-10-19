// Starter email templates for the Campaigns page.
//
// Merge tags:
//  - {{firstName}} is filled per recipient (falls back to "there"). The only tag that may stay in the text.
//  - Any other {{tag}} is a blank for staff to fill in (event, date, link...). Review & test blocks the
//    campaign until none remain.
//
// Venue facts used here are the only verified ones: a 1920s school building in Clemmons, NC,
// converted to offices and event space around 2006; spaces named Magnolia Room, The Boardrooms,
// The Dock and The Loft. No capacities, sizes, amenities, pricing, dates or availability are stated.

export interface CampaignTemplate {
  id: string;
  name: string;
  category: "Invitation" | "Follow-up" | "Thank you" | "Re-engage";
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
    category: "Invitation",
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
    category: "Follow-up",
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
    category: "Thank you",
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
    category: "Re-engage",
    description: "A light touch for someone who has gone quiet.",
    subject: "Still thinking about your event?",
    previewText: "We're here when you're ready.",
    body: `Hi {{firstName}},

It's been a little while since we last spoke about {{inquiryTopic}}. If your plans are still in motion, we'd be happy to pick the conversation back up.

If the timing isn't right, no problem at all. Reply with a quick note and we'll check in later instead.

${SIGN_OFF}`,
  },
];

export const getTemplate = (id: string) => CAMPAIGN_TEMPLATES.find((t) => t.id === id);

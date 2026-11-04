"use client";

import type { Section } from "./Dashboard";

// What each planned studio will do when built. Listed in the rail as real
// rows; this panel is what they open until the studio itself ships.
const PLANS: Partial<Record<Section, { name: string; blurb: string; uses: string[] }>> = {
  textstudio: {
    name: "Text studio",
    blurb: "Compose and preview SMS/MMS outreach for campaigns.",
    uses: ["Write texts from lead + brand context", "Preview with media attached", "Send through the review queue — nothing outbound without approval"],
  },
  lpstudio: {
    name: "Landing page studio",
    blurb: "Compose a live landing page from a brand + audience using the template catalog.",
    uses: ["Pick audience and goal", "Compose copy + hero from venue photos", "Publish to a real URL under review"],
  },
  adstudio: {
    name: "Ad studio",
    blurb: "Build ad sets from real venue photos and verified facts.",
    uses: ["Audience-specific ad cards (weddings, corporate, holiday)", "Images from the Photo library", "Meta-ready export — spend stays gated"],
  },
  mailer: {
    name: "Mailer studio",
    blurb: "Print pieces — postcards, rack cards, event programs.",
    uses: ["Postcard + rack-card layouts from brand tokens", "Event program drafts", "Print-ready export"],
  },
  podcast: {
    name: "Podcast studio",
    blurb: "Audio spots and podcast creative for the on-site HB Podcast Studio.",
    uses: ["Script audio spots from campaign briefs", "Show-notes drafts", "Attach spots to journeys"],
  },
  call: {
    name: "Call studio",
    blurb: "Scripted follow-up calls for tour-request leads.",
    uses: ["Call scripts from lead context", "Follow-up cadence per journey", "Outcome logging to the lead record"],
  },
  proposal: {
    name: "Proposal studio",
    blurb: "Auto-build the client proposal deck from an inquiry.",
    uses: ["Deck from inquiry details + room fit", "Matches the proposal page already generated for leads", "Export for the client"],
  },
};

export default function PlannedStudioPanel({ studio }: { studio: Section }) {
  const plan = PLANS[studio];
  if (!plan) return null;
  return (
    <div className="ibox p-6 max-w-2xl">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-accent">Planned</p>
      <h3 className="hb-display text-[26px] text-ink mt-1">{plan.name}</h3>
      <p className="text-[15px] text-muted mt-2 leading-relaxed">{plan.blurb}</p>
      <ul className="mt-4 space-y-2">
        {plan.uses.map((u) => (
          <li key={u} className="flex gap-2.5 text-[14px] text-ink">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent shrink-0" aria-hidden="true" />
            {u}
          </li>
        ))}
      </ul>
      <p className="text-[13px] text-muted mt-5 border-t border-line pt-4">
        Not built yet — this is the build order card. Say the word and it becomes a working studio.
      </p>
    </div>
  );
}

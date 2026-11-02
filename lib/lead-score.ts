// Conventional CRM lead rating: fit (0–50) + engagement (0–50) → 0–100,
// tiered Hot/Warm/Cool/Cold. Fit rewards a complete, enriched record;
// engagement rewards recent positive responses and decays for silence —
// the same shape HubSpot/Mailchimp lead scoring uses.

export interface ScoreBreakdown { fit: { label: string; pts: number }[]; engagement: { label: string; pts: number }[]; }
export interface LeadScore { total: number; tier: "Hot" | "Warm" | "Cool" | "Cold"; fit: number; engagement: number; breakdown: ScoreBreakdown; }

const FIT: [string, (l: any) => boolean, number][] = [
  ["Has phone", (l) => !!l.phone, 8],
  ["Has company", (l) => !!l.company, 6],
  ["LinkedIn linked", (l) => !!l.linkedinId, 6],
  ["Location known", (l) => !!(l.city && l.state), 5],
  ["Enriched", (l) => !!l.enrichedAt, 10],
  ["Microsegment assigned", (l) => !!(l.customFields?.microsegment?.length), 8],
  ["Estimated value set", (l) => l.estimatedValue != null, 7],
];

const ENGAGEMENT: [RegExp, string, number][] = [
  [/contract|booking|booked|purchased/i, "Contract / booking", 30],
  [/rsvp|confirmed|registered/i, "RSVP'd", 15],
  [/click/i, "Clicked", 12],
  [/open/i, "Opened", 6],
  [/call.?back|recall|replied|response/i, "Called back / replied", 10],
  [/sent|delivered|published/i, "Campaign delivered", 1],
  [/unopened|not.?opened/i, "Unopened", -2],
  [/bounce|unsub|opt.?out|spam/i, "Bounced / unsubscribed", -20],
];

export function computeLeadScore(lead: any, events: { label: string; detail?: unknown; at?: string | Date }[]): LeadScore {
  const breakdown: ScoreBreakdown = { fit: [], engagement: [] };
  let fit = 0;
  for (const [label, test, pts] of FIT) {
    if (test(lead)) { fit += pts; breakdown.fit.push({ label, pts }); }
  }
  fit = Math.min(50, fit);

  let engagement = 0;
  let lastPositive = 0;
  for (const e of events) {
    const hay = `${e.label} ${e.detail ?? ""}`;
    for (const [re, label, pts] of ENGAGEMENT) {
      if (re.test(hay)) {
        engagement += pts;
        breakdown.engagement.push({ label, pts });
        if (pts > 0) {
          const t = e.at ? new Date(e.at).getTime() : 0;
          if (t > lastPositive) lastPositive = t;
        }
        break;
      }
    }
  }
  // Silence decay: nothing positive in 90+ days costs 15.
  if (lastPositive && Date.now() - lastPositive > 90 * 86400_000) {
    engagement -= 15;
    breakdown.engagement.push({ label: "Silent 90+ days", pts: -15 });
  }
  engagement = Math.max(0, Math.min(50, engagement));

  const total = Math.max(0, Math.min(100, fit + engagement));
  const tier = total >= 80 ? "Hot" : total >= 50 ? "Warm" : total >= 25 ? "Cool" : "Cold";
  return { total, tier, fit, engagement, breakdown };
}

export function tierFromScore(score: number): "Hot" | "Warm" | "Cool" | "Cold" {
  return score >= 80 ? "Hot" : score >= 50 ? "Warm" : score >= 25 ? "Cool" : "Cold";
}

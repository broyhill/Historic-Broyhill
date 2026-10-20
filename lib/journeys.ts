import { z } from "zod";

// Journey step definitions. A journey is an ordered list of these, stored as JSON on the Journey row.
// Messages always come from saved templates (see lib/campaign-templates.ts) so wording stays reviewed.

export const TRIGGERS = ["INQUIRY_RECEIVED", "TOUR_BOOKED", "EVENT_COMPLETED", "MANUAL"] as const;
export type Trigger = (typeof TRIGGERS)[number];

const email = z.object({ type: z.literal("email"), template: z.string().min(1) });
// Texts only ever go to leads with recorded text consent (enforced by the runner, not by this shape).
const sms = z.object({ type: z.literal("sms"), template: z.string().min(1) });
const wait = z.object({ type: z.literal("wait"), hours: z.number().int().min(1).max(24 * 90) });

export const stepSchema = z.discriminatedUnion("type", [email, sms, wait]);
export const stepsSchema = z.array(stepSchema).max(30);
export type JourneyStep = z.infer<typeof stepSchema>;

export const journeyInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  trigger: z.enum(TRIGGERS),
  approvalMode: z.enum(["REVIEW", "AUTO"]).default("REVIEW"),
  steps: stepsSchema,
});

// Starter journeys use only templates that already exist. All start PAUSED and in REVIEW mode.
export const STARTER_JOURNEYS: { name: string; trigger: Trigger; steps: JourneyStep[] }[] = [
  {
    name: "New inquiry",
    trigger: "INQUIRY_RECEIVED",
    steps: [
      { type: "email", template: "inquiry-follow-up" },
      { type: "wait", hours: 48 },
      { type: "sms", template: "sms-inquiry-follow-up" },
      { type: "wait", hours: 96 },
      { type: "email", template: "reengage" },
    ],
  },
  {
    name: "Tour booked",
    trigger: "TOUR_BOOKED",
    steps: [
      { type: "email", template: "tour-invite" },
      { type: "wait", hours: 24 },
      { type: "sms", template: "sms-tour-invite" },
    ],
  },
  {
    name: "After an event",
    trigger: "EVENT_COMPLETED",
    steps: [
      { type: "email", template: "event-thank-you" },
      { type: "wait", hours: 72 },
      { type: "sms", template: "sms-thank-you" },
    ],
  },
];

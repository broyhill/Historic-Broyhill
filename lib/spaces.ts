import spacesJson from "@/app/data/spaces.json";
import availabilityJson from "@/app/data/availability.json";

/* Event-space data for the public site. Pure helpers only: safe to import from
   server and client components. Facts live in app/data/*.json (see _about there). */

export type Capacity = { setup: string; guests: string };

export type Space = {
  id: string;
  name: string;
  kind: string;
  indoor: boolean;
  /** Largest published guest count, or null when the venue has not published one. */
  maxGuests: number | null;
  capacities: Capacity[];
  setups: string[];
  features: string[];
  sizeSqFt: number | null;
  story: string;
  photo: string | null;
  photoAlt: string;
};

export type Status = "open" | "held" | "booked";

export type Availability = {
  sample: boolean;
  defaultStatus: Status;
  rooms: Record<string, Record<string, Status>>;
};

export const SPACES: Space[] = spacesJson.spaces as Space[];
export const AVAILABILITY: Availability = availabilityJson as Availability;

export const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function spaceById(id: string): Space | undefined {
  return SPACES.find((space) => space.id === id);
}

/** Keep only ids that are real spaces, in the order given, without duplicates. */
export function validSpaceIds(raw: string | string[] | undefined): string[] {
  const joined = Array.isArray(raw) ? raw.join(",") : raw ?? "";
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of joined.split(",")) {
    const trimmed = id.trim();
    if (trimmed && !seen.has(trimmed) && spaceById(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}

export function validDate(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !DATE_KEY.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(y, m - 1, d);
  const valid = probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d;
  return valid ? value : null;
}

export function statusFor(spaceId: string, dateKey: string, data: Availability = AVAILABILITY): Status {
  return data.rooms[spaceId]?.[dateKey] ?? data.defaultStatus;
}

/** A room passes the guest filter when it can hold the party, or when its capacity is not published yet. */
export function fitsGuests(space: Space, minGuests: number): boolean {
  return space.maxGuests === null || space.maxGuests >= minGuests;
}

export function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

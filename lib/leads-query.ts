import type { Prisma } from "@prisma/client";

// Filters shared by the lead directory (/api/admin/leads) and its CSV export,
// so "export what I'm looking at" always matches the on-screen list.
export interface LeadFilters {
  q?: string | null;
  track?: string | null;
  status?: string | null;
  // "no-name" / "no-company" surface leads missing that field (e.g. email-only
  // contacts). "has-company-linkedin" shows enriched ones.
  gap?: string | null;
}

export function buildLeadWhere({ q, track, status, gap }: LeadFilters): Prisma.LeadProfileWhereInput {
  const where: Prisma.LeadProfileWhereInput = {};
  const and: Prisma.LeadProfileWhereInput[] = [];

  const term = q?.trim();
  if (term) {
    and.push({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { company: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phone: { contains: term, mode: "insensitive" } },
      ],
    });
  }
  if (track && track !== "ALL") where.primaryTrack = track;
  if (status && status !== "ALL") where.leadStatus = status;
  if (gap === "no-name") and.push({ OR: [{ name: null }, { name: "" }] });
  else if (gap === "no-company") and.push({ OR: [{ company: null }, { company: "" }] });
  else if (gap === "has-company-linkedin") where.companyLinkedin = { not: null };

  if (and.length) where.AND = and;
  return where;
}

// The one set of columns the directory and the export agree on, in display order.
export const LEAD_SELECT = {
  id: true,
  name: true,
  company: true,
  email: true,
  phone: true,
  linkedinId: true,
  companyLinkedin: true,
  city: true,
  state: true,
  leadScore: true,
  leadStatus: true,
  primaryTrack: true,
  leadSource: true,
  estimatedValue: true,
  createdAt: true,
} satisfies Prisma.LeadProfileSelect;

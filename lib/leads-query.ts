import type { Prisma } from "@prisma/client";

// Filters shared by the lead directory (/api/admin/leads) and its CSV export,
// so "export what I'm looking at" always matches the on-screen list.
export interface LeadFilters {
  q?: string | null;
  track?: string | null;
  status?: string | null;
}

export function buildLeadWhere({ q, track, status }: LeadFilters): Prisma.LeadProfileWhereInput {
  const where: Prisma.LeadProfileWhereInput = {};
  const term = q?.trim();
  if (term) {
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { company: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
    ];
  }
  if (track && track !== "ALL") where.primaryTrack = track;
  if (status && status !== "ALL") where.leadStatus = status;
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
  leadScore: true,
  leadStatus: true,
  primaryTrack: true,
  leadSource: true,
  estimatedValue: true,
  createdAt: true,
} satisfies Prisma.LeadProfileSelect;

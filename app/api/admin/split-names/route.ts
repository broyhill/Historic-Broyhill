import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseName } from "@/lib/parse-name";

export const maxDuration = 60;

// Split existing display names into salutation/first/middle/last. Pure local
// parsing (no AI). Processes a batch per call and reports how many remain so the
// client can loop. Only fills leads that have a name but no firstName yet.
export async function POST() {
  try {
    const batch = await prisma.leadProfile.findMany({
      where: { name: { not: null }, firstName: null },
      take: 500,
      select: { id: true, name: true },
    });

    if (batch.length === 0) {
      return NextResponse.json({ success: true, done: true, remaining: 0, updated: 0 });
    }

    // Chunk the individual updates so we don't open 500 statements at once.
    let updated = 0;
    for (let i = 0; i < batch.length; i += 50) {
      const slice = batch.slice(i, i + 50);
      await prisma.$transaction(
        slice.map((lead) => {
          const p = parseName(lead.name);
          return prisma.leadProfile.update({
            where: { id: lead.id },
            data: {
              salutation: p.salutation,
              firstName: p.firstName,
              middleName: p.middleName,
              lastName: p.lastName,
            },
          });
        })
      );
      updated += slice.length;
    }

    const remaining = await prisma.leadProfile.count({ where: { name: { not: null }, firstName: null } });
    return NextResponse.json({ success: true, done: remaining === 0, remaining, updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

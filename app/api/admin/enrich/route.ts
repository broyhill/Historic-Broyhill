import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enrichDomains, domainOf, isFreeDomain, nameFromEmail } from "@/lib/enrich";

// How many distinct company domains to resolve per request. Kept small so each
// call stays well under the serverless time limit; the client loops until done.
const DOMAINS_PER_CALL = 25;
const WINDOW = 600; // how many un-enriched leads to scan per call

// Bulk lead enrichment from email domains. The client calls this repeatedly
// (each call makes progress and returns how many remain) until remaining = 0.
// Auth is enforced by the /api/admin middleware. Nothing is emailed.
export async function POST() {
  try {
    const window = await prisma.leadProfile.findMany({
      where: { enrichedAt: null },
      orderBy: { createdAt: "asc" },
      take: WINDOW,
      select: { id: true, email: true, name: true },
    });

    if (window.length === 0) {
      return NextResponse.json({ success: true, done: true, remaining: 0 });
    }

    const now = new Date();
    const freeIds: string[] = [];
    const domainToLeads = new Map<string, { id: string; email: string; name: string | null }[]>();

    for (const lead of window) {
      const d = domainOf(lead.email);
      if (!d || isFreeDomain(d)) { freeIds.push(lead.id); continue; }
      if (!domainToLeads.has(d)) domainToLeads.set(d, []);
      domainToLeads.get(d)!.push(lead);
    }

    // Resolve up to N distinct company domains this round.
    const targetDomains = Array.from(domainToLeads.keys()).slice(0, DOMAINS_PER_CALL);
    const enrichment = await enrichDomains(targetDomains);

    let leadsUpdated = 0;
    for (const domain of targetDomains) {
      const e = enrichment.get(domain);
      const leads = domainToLeads.get(domain)!;
      const data: Record<string, unknown> = { enrichedAt: now };
      if (e?.company) data.company = e.company;
      if (e?.companyLinkedin) data.companyLinkedin = e.companyLinkedin;
      if (e?.city) data.city = e.city;
      if (e?.state) data.state = e.state;
      const res = await prisma.leadProfile.updateMany({ where: { id: { in: leads.map((l) => l.id) } }, data });
      leadsUpdated += res.count;
    }

    // Personal-domain leads can't be company-enriched; mark them done so they
    // don't get rescanned every round.
    if (freeIds.length) {
      await prisma.leadProfile.updateMany({ where: { id: { in: freeIds } }, data: { enrichedAt: now } });
    }

    // Backfill a contact name from the email where one is clearly encoded and
    // the lead has no name yet (applies to everyone processed this round).
    const processed = [...freeIds.map((id) => window.find((w) => w.id === id)!), ...targetDomains.flatMap((d) => domainToLeads.get(d)!)];
    let namesFilled = 0;
    for (const lead of processed) {
      if (!lead || lead.name) continue;
      const guessed = nameFromEmail(lead.email);
      if (guessed) { await prisma.leadProfile.update({ where: { id: lead.id }, data: { name: guessed } }); namesFilled++; }
    }

    const remaining = await prisma.leadProfile.count({ where: { enrichedAt: null } });

    return NextResponse.json({
      success: true,
      done: remaining === 0,
      remaining,
      domainsEnriched: targetDomains.length,
      leadsUpdated,
      skippedPersonal: freeIds.length,
      namesFilled,
      aiAvailable: Boolean(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes("your-openai-api-key")),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Development seed (runs only behind scripts/guard-dev-db.mjs — local database, schema
// wizard_agency). Creates the agency, its kill switch (ENGAGED), the default BroyhillGOP silo,
// and backfills existing LeadProfile / AiContentPipeline / Business rows into that silo.
// No default password is shipped: the admin is created only when the operator provides one.

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth/password';
import {
  AGENCY_NAME,
  DEFAULT_FROM_EMAIL,
  DEFAULT_FROM_NAME,
  DEFAULT_PHYSICAL_ADDRESS,
  DEFAULT_SILO_NAME,
  DEFAULT_SILO_SLUG,
} from '../lib/config';
import { normalizeEmail } from '../lib/identity';

const prisma = new PrismaClient();

async function main() {
  const agency = (await prisma.agency.findFirst({ where: { name: AGENCY_NAME } })) ?? (await prisma.agency.create({ data: { name: AGENCY_NAME } }));
  await prisma.agencyControl.upsert({ where: { agencyId: agency.id }, create: { agencyId: agency.id }, update: {} });

  const silo = await prisma.candidateSilo.upsert({
    where: { slug: DEFAULT_SILO_SLUG },
    create: {
      agencyId: agency.id,
      slug: DEFAULT_SILO_SLUG,
      name: DEFAULT_SILO_NAME,
      fromName: DEFAULT_FROM_NAME,
      fromEmail: DEFAULT_FROM_EMAIL,
      physicalAddress: DEFAULT_PHYSICAL_ADDRESS,
      // candidateName stays null: the agency silo is not a named candidate, so it can never send.
    },
    update: {},
  });

  // Backfill: existing records without a silo belong to the default silo (Track A step 2).
  const [leads, campaigns, businesses] = await Promise.all([
    prisma.leadProfile.updateMany({ where: { candidateId: null }, data: { candidateId: silo.id } }),
    prisma.aiContentPipeline.updateMany({ where: { candidateId: null }, data: { candidateId: silo.id } }),
    prisma.business.updateMany({ where: { candidateId: null }, data: { candidateId: silo.id } }),
  ]);

  const email = normalizeEmail(process.env.WIZARD_SEED_ADMIN_EMAIL);
  const password = process.env.WIZARD_SEED_ADMIN_PASSWORD;
  let admin = 'skipped (set WIZARD_SEED_ADMIN_EMAIL and WIZARD_SEED_ADMIN_PASSWORD)';
  if (email && password) {
    await prisma.candidateUser.upsert({
      where: { candidateId_email: { candidateId: silo.id, email } },
      create: { candidateId: silo.id, email, passwordHash: await hashPassword(password), role: 'AGENCY_ADMIN', displayName: 'Agency admin' },
      update: {},
    });
    admin = email;
  }

  console.log(JSON.stringify({
    agency: agency.name,
    killSwitch: 'ENGAGED',
    defaultSilo: { slug: silo.slug, name: silo.name, fromName: silo.fromName, physicalAddress: silo.physicalAddress },
    backfilled: { leadProfiles: leads.count, aiContentPipeline: campaigns.count, businesses: businesses.count },
    admin,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

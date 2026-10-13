import { PrismaClient, SuiteStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 10) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (10+ characters) to create the first admin user.');
  }
  await prisma.adminUser.upsert({
    where: { email },
    create: { email, name: process.env.ADMIN_NAME ?? 'Administrator', role: 'ADMIN', passwordHash: await bcrypt.hash(password, 12) },
    update: {},
  });
  console.log(`Admin user ready: ${email}`);

  if (process.env.SEED_SAMPLE_DATA !== 'true') return;

  // SAMPLE DATA ONLY: placeholder values. Replace with the real suite list and event spaces.
  for (let i = 0; i < 35; i++) {
    const floor = Math.floor(i / 7) + 1;
    const number = `${floor}${String((i % 7) + 1).padStart(2, '0')}`;
    await prisma.suite.upsert({
      where: { number },
      create: { number, floor, squareFeet: 800 + (i % 7) * 150, monthlyRate: null, status: SuiteStatus.OCCUPIED, description: 'Class A office suite (sample data)' },
      update: {},
    });
  }
  const spaces = [
    { name: 'Grand Hall', capacity: 400, hourlyRate: 250, description: 'Sample data: large event hall for weddings, chamber events and conferences.' },
    { name: 'Conference Room', capacity: 60, hourlyRate: 90, description: 'Sample data: conference and training room.' },
  ];
  for (const s of spaces) await prisma.eventSpace.upsert({ where: { name: s.name }, create: s, update: {} });
  console.log('Sample suites and event spaces seeded');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

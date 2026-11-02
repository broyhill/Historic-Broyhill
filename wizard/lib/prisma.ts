import { PrismaClient } from '@prisma/client';

// One client per process. Constructing it opens no connection; the first query does.
const globalForPrisma = globalThis as unknown as { wizardAgencyPrisma?: PrismaClient };
export const prisma = globalForPrisma.wizardAgencyPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.wizardAgencyPrisma = prisma;

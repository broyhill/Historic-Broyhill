import { PrismaClient } from '@generated/wizard-prisma';

// The wizard's own generated client (wizard/prisma/schema.prisma → wz_* tables).
// One client per process; the first query opens the connection.
const globalForPrisma = globalThis as unknown as { wizardPrisma?: PrismaClient };
export const prisma = globalForPrisma.wizardPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.wizardPrisma = prisma;

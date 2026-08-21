import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

declare global {
  var __memoriesPrisma__: PrismaClient | undefined;
}

const createPrismaClient = () =>
  new PrismaClient({
    datasourceUrl: env.databaseUrl,
    log: ['warn', 'error'],
  });

export const prisma = globalThis.__memoriesPrisma__ ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__memoriesPrisma__ = prisma;
}

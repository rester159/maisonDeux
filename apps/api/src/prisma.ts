import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __luxefinderPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.__luxefinderPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__luxefinderPrisma = prisma;
}

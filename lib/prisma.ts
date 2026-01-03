import { PrismaClient } from "@prisma/client";

declare global {
  // allow global `var` to avoid multiple instances in dev
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") global.prisma = prisma;

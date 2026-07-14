import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

// Next.js dev's hot-reload re-executes this module on every edit, which would otherwise create a
// new PrismaClient (and a new DB connection pool) each time - caching it on globalThis survives
// reloads. Production doesn't hot-reload, so this is a no-op there.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prisma 7 requires an explicit driver adapter instead of a bare connection string on the client
// (the schema's datasource block intentionally has no `url` - that's only used by the Prisma CLI
// via prisma.config.ts).
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

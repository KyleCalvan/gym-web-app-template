import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client/index.js";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required. See the root .env.example.");

// pg does not interpret Prisma's ?schema= option. Pass it to the adapter so
// runtime queries use the same schema as Prisma's migration CLI.
const schema = new URL(connectionString).searchParams.get("schema") ?? "public";
// PrismaPg normalizes timestamptz text as UTC; request UTC from PostgreSQL so
// timestamps retain their actual instant on hosts whose local zone is not UTC.
const pool = globalForPrisma.pool ?? new Pool({ connectionString, options: '-c TimeZone=UTC' });
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter: new PrismaPg(pool, { schema }),
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool;
  globalForPrisma.prisma = prisma;
}

export { prisma };

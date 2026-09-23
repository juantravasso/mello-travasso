import { PrismaClient } from "@prisma/client";
import "./env.server";

// Evita criar um novo PrismaClient a cada hot-reload em desenvolvimento
// (cada instância abre seu próprio pool de conexões com o Postgres).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

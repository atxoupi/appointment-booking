import type { PrismaClient, User } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export async function createWorker(
  input: { email: string; password: string; name: string; lastName: string; phone?: string },
  db: PrismaClient = defaultPrisma
): Promise<User> {
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("EMAIL_TAKEN");

  return db.user.create({
    data: {
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: "WORKER",
      name: input.name,
      lastName: input.lastName,
      phone: input.phone,
    },
  });
}

export function listWorkers(db: PrismaClient = defaultPrisma): Promise<User[]> {
  return db.user.findMany({ where: { role: "WORKER" }, orderBy: { name: "asc" } });
}

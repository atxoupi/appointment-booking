import type { PrismaClient, Service } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

export function listServices(db: PrismaClient = defaultPrisma): Promise<Service[]> {
  return db.service.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export function createService(
  input: { name: string; durationMinutes: number },
  db: PrismaClient = defaultPrisma
): Promise<Service> {
  return db.service.create({ data: input });
}

export function updateService(
  id: string,
  input: { name?: string; durationMinutes?: number; active?: boolean },
  db: PrismaClient = defaultPrisma
): Promise<Service> {
  return db.service.update({ where: { id }, data: input });
}

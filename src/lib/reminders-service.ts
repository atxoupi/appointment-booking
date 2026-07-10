import type { Appointment, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

export async function findAppointmentsNeedingReminder(
  now: Date,
  db: PrismaClient = defaultPrisma
): Promise<Appointment[]> {
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );

  return db.appointment.findMany({
    where: { status: "CONFIRMED", date: tomorrow },
  });
}

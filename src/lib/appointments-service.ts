import type { Appointment, PrismaClient, Role } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/availability-service";
import { timeToMinutes, minutesToTime } from "@/lib/availability";

export type CreateAppointmentResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; reason: "SLOT_UNAVAILABLE" };

export async function createAppointment(
  params: {
    clientId: string;
    workerId: string;
    serviceId: string;
    date: Date;
    startTime: string;
    createdBy: "CLIENT" | "STAFF";
  },
  db: PrismaClient = defaultPrisma
): Promise<CreateAppointmentResult> {
  try {
    return await db.$transaction(async (tx) => {
      const service = await tx.service.findUniqueOrThrow({ where: { id: params.serviceId } });
      const available = await getAvailableSlots(
        { serviceId: params.serviceId, date: params.date, workerId: params.workerId },
        tx
      );
      const workerSlots = available.find((a) => a.workerId === params.workerId)?.slots ?? [];
      if (!workerSlots.includes(params.startTime)) {
        return { ok: false, reason: "SLOT_UNAVAILABLE" } as const;
      }

      const endTime = minutesToTime(timeToMinutes(params.startTime) + service.durationMinutes);
      const appointment = await tx.appointment.create({
        data: {
          clientId: params.clientId,
          workerId: params.workerId,
          serviceId: params.serviceId,
          date: params.date,
          startTime: params.startTime,
          endTime,
          createdBy: params.createdBy,
        },
      });

      return { ok: true, appointment } as const;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, reason: "SLOT_UNAVAILABLE" };
    }
    throw err;
  }
}

export async function listAppointmentsForUser(
  userId: string,
  role: Role,
  db: PrismaClient = defaultPrisma
): Promise<Appointment[]> {
  if (role === "ADMIN") {
    return db.appointment.findMany({ orderBy: { date: "asc" } });
  }
  if (role === "WORKER") {
    return db.appointment.findMany({ where: { workerId: userId }, orderBy: { date: "asc" } });
  }
  return db.appointment.findMany({ where: { clientId: userId }, orderBy: { date: "asc" } });
}
